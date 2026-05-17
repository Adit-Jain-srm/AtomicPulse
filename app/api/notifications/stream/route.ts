import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getRecentNotifications } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      let lastSeen = Date.now();
      // initial dump
      const initial = await getRecentNotifications(session.userId, 10);
      send({ type: "initial", items: initial });

      const interval = setInterval(async () => {
        try {
          const items = await getRecentNotifications(session.userId, 10);
          const fresh = items.filter((n) => n.createdAt.getTime() > lastSeen);
          if (fresh.length) {
            lastSeen = Date.now();
            send({ type: "delta", items: fresh });
          } else {
            send({ type: "ping", at: Date.now() });
          }
        } catch (e) {
          send({ type: "error", message: (e as Error).message });
        }
      }, 8000);

      // close after 4 minutes (Vercel function ceiling friendly)
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 4 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
