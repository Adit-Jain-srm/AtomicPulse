import "server-only";
import { acquireGraphToken, isEntraConfigured } from "@/lib/auth/msal-adapter";

/**
 * Transactional email via Microsoft Graph sendMail API.
 *
 * When GRAPH_MAIL_ENABLED=true and Entra is configured, sends real emails
 * via the Graph /sendMail endpoint using the MAIL_FROM_USER_ID mailbox.
 * Falls back to console log when not configured.
 */

const baseUrl = () => process.env.APP_BASE_URL ?? "http://localhost:3000";

export async function sendOutlookMail(p: {
  to: string;
  subject: string;
  bodyHtml: string;
}): Promise<{ ok: boolean }> {
  const enabled = process.env.GRAPH_MAIL_ENABLED === "true";
  const fromUserId = process.env.MAIL_FROM_USER_ID;

  if (!enabled || !fromUserId || !isEntraConfigured()) {
    console.info("[outlook.mail.stub]", { to: p.to, subject: p.subject });
    return { ok: true };
  }

  try {
    const token = await acquireGraphToken();
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${fromUserId}/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: p.subject,
          body: { contentType: "HTML", content: p.bodyHtml },
          toRecipients: [{ emailAddress: { address: p.to } }],
        },
        saveToSentItems: false,
      }),
    });
    if (!res.ok) {
      console.warn("[outlook.mail.error]", res.status, await res.text().catch(() => ""));
    }
    return { ok: res.ok || res.status === 202 };
  } catch (e) {
    console.warn("[outlook.mail.error]", e);
    return { ok: false };
  }
}

/**
 * Pre-built email templates for key goal events.
 */
export async function emailGoalSubmitted(opts: { toEmail: string; employeeName: string; goalCount: number; sheetId: string }) {
  return sendOutlookMail({
    to: opts.toEmail,
    subject: `[AtomicPulse] ${opts.employeeName} submitted goals for review`,
    bodyHtml: `
      <h2>Goal Sheet Submitted</h2>
      <p><strong>${opts.employeeName}</strong> has submitted ${opts.goalCount} goals for your review.</p>
      <p><a href="${baseUrl()}/goals/${opts.sheetId}">Review and approve →</a></p>
    `,
  });
}

export async function emailGoalApproved(opts: { toEmail: string; sheetId: string; comment?: string }) {
  return sendOutlookMail({
    to: opts.toEmail,
    subject: "[AtomicPulse] Your goals have been approved",
    bodyHtml: `
      <h2>Goals Approved & Locked</h2>
      <p>Your goal sheet has been approved and locked. Quarterly check-ins are now open.</p>
      ${opts.comment ? `<p><em>Manager note: ${opts.comment}</em></p>` : ""}
      <p><a href="${baseUrl()}/goals/${opts.sheetId}">View your locked goals →</a></p>
    `,
  });
}

export async function emailGoalReturned(opts: { toEmail: string; sheetId: string; comment: string }) {
  return sendOutlookMail({
    to: opts.toEmail,
    subject: "[AtomicPulse] Your goals were returned for rework",
    bodyHtml: `
      <h2>Goals Returned</h2>
      <p>Your manager returned your goal sheet for revision:</p>
      <blockquote>${opts.comment}</blockquote>
      <p><a href="${baseUrl()}/goals/${opts.sheetId}">Edit your goals →</a></p>
    `,
  });
}

export async function emailCheckInReminder(opts: { toEmail: string; employeeName: string; period: string; daysLeft: number }) {
  return sendOutlookMail({
    to: opts.toEmail,
    subject: `[AtomicPulse] ${opts.period} check-in reminder — ${opts.daysLeft} days left`,
    bodyHtml: `
      <h2>${opts.period} Check-in Reminder</h2>
      <p>Hi ${opts.employeeName},</p>
      <p>The ${opts.period} check-in window closes in <strong>${opts.daysLeft} days</strong>. Please log your achievement.</p>
      <p><a href="${baseUrl()}/check-ins">Submit check-in →</a></p>
    `,
  });
}
