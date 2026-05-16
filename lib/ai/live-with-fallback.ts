import type { AiMode } from "./gateway";

/**
 * Helpers for wrapping live AI calls with a timeout and graceful fallback to stubs.
 *
 * IMPORTANT: never log prompts, messages, or any user / business content here.
 * Only the small `FallbackEvent` shape below is allowed.
 *
 * Note: this module deliberately omits `import "server-only"` so the deterministic
 * eval script (`scripts/ai-eval.ts`, run via `tsx`) can import `classifyError` /
 * `logAiFallback` without tripping the React server-component marker. Every
 * runtime caller is a Next.js Route Handler that already runs server-side.
 */

export const AI_CALL_TIMEOUT_MS = 8000;

export function timeoutSignal(ms: number = AI_CALL_TIMEOUT_MS): AbortSignal {
  return AbortSignal.timeout(ms);
}

export type FallbackEvent = {
  phase: "skill" | "chat";
  skill?: string;
  mode: AiMode;
  reason: "timeout" | "error";
  code?: string;
};

export function logAiFallback(event: FallbackEvent): void {
  // eslint-disable-next-line no-console
  console.warn("[ai.fallback]", JSON.stringify(event));
}

export function classifyError(err: unknown): { reason: "timeout" | "error"; code?: string } {
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name?: string }).name;
    if (name === "AbortError" || name === "TimeoutError") return { reason: "timeout", code: name };
    return { reason: "error", code: name };
  }
  return { reason: "error" };
}
