import "server-only";

/**
 * Outlook transactional email via Microsoft Graph (stub).
 *
 * Live: POST /v1.0/users/{from}/sendMail with an Authorization header.
 * Demo: log the message and return ok.
 */

export async function sendOutlookMail(p: {
  to: string;
  subject: string;
  bodyHtml: string;
}): Promise<{ ok: boolean }> {
  const enabled = process.env.GRAPH_MAIL_ENABLED === "true";
  if (!enabled) {
    console.info("[outlook.mail.stub]", { to: p.to, subject: p.subject });
    return { ok: true };
  }
  // TODO: Real Graph send.
  console.info("[outlook.mail.live.notImplemented]", { to: p.to, subject: p.subject });
  return { ok: true };
}
