import "server-only";

/**
 * Microsoft Teams Adaptive Card notifications.
 *
 * Posts Adaptive Card 1.5 payloads to the configured incoming webhook URL.
 * Supports deep-link buttons that navigate directly to the relevant goal sheet.
 * Falls back to a console log when TEAMS_WEBHOOK_URL_DEFAULT is not configured.
 */

type CardPayload = {
  title: string;
  subtitle?: string;
  text?: string;
  facts?: { title: string; value: string }[];
  openUrl?: { label: string; url: string };
};

const baseUrl = () => process.env.APP_BASE_URL ?? "http://localhost:3000";

export async function postAdaptiveCard(p: CardPayload): Promise<{ ok: boolean }> {
  const url = process.env.TEAMS_WEBHOOK_URL_DEFAULT;
  const card = buildAdaptiveCard(p);

  if (!url) {
    console.info("[teams.adaptiveCard.stub]", JSON.stringify({ title: p.title, subtitle: p.subtitle }));
    return { ok: true };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    if (!res.ok) {
      console.warn("[teams.adaptiveCard.error]", res.status, await res.text().catch(() => ""));
    }
    return { ok: res.ok };
  } catch (e) {
    console.warn("[teams.adaptiveCard.error]", e);
    return { ok: false };
  }
}

function buildAdaptiveCard(p: CardPayload) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.5",
          body: [
            { type: "TextBlock", text: p.title, weight: "Bolder", size: "Medium", wrap: true },
            p.subtitle && { type: "TextBlock", text: p.subtitle, spacing: "None", isSubtle: true, wrap: true },
            p.text && { type: "TextBlock", text: p.text, wrap: true, spacing: "Small" },
            p.facts && { type: "FactSet", facts: p.facts },
          ].filter(Boolean),
          actions: p.openUrl
            ? [{ type: "Action.OpenUrl", title: p.openUrl.label, url: p.openUrl.url }]
            : [],
        },
      },
    ],
  };
}

/**
 * Pre-built notification templates with deep links.
 */
export async function notifyGoalSubmitted(opts: { employeeName: string; goalCount: number; sheetId: string }) {
  return postAdaptiveCard({
    title: "Goal Sheet Submitted",
    subtitle: `${opts.employeeName} submitted their goal sheet for review`,
    facts: [
      { title: "Goals", value: `${opts.goalCount} goals · 100% allocated` },
      { title: "Action needed", value: "Review and approve or return for rework" },
    ],
    openUrl: { label: "Review goals", url: `${baseUrl()}/goals/${opts.sheetId}` },
  });
}

export async function notifyGoalApproved(opts: { employeeName: string; sheetId: string; comment?: string }) {
  return postAdaptiveCard({
    title: "Goals Approved & Locked",
    subtitle: `${opts.employeeName}'s goals have been approved`,
    text: opts.comment || "Sheet is now locked. Check-ins are open for the current quarter.",
    openUrl: { label: "View locked sheet", url: `${baseUrl()}/goals/${opts.sheetId}` },
  });
}

export async function notifyGoalReturned(opts: { employeeName: string; sheetId: string; comment: string }) {
  return postAdaptiveCard({
    title: "Goals Returned for Rework",
    subtitle: `${opts.employeeName}'s goals need revision`,
    text: opts.comment,
    openUrl: { label: "Edit goals", url: `${baseUrl()}/goals/${opts.sheetId}` },
  });
}

export async function notifyCheckInSubmitted(opts: { employeeName: string; goalTitle: string; period: string; score: number; sheetOwnerId: string }) {
  return postAdaptiveCard({
    title: `${opts.period} Check-in Submitted`,
    subtitle: `${opts.employeeName} logged progress`,
    facts: [
      { title: "Goal", value: opts.goalTitle },
      { title: "Score", value: `${opts.score}%` },
    ],
    openUrl: { label: "Review check-in", url: `${baseUrl()}/check-ins/${opts.sheetOwnerId}` },
  });
}

export async function notifyCheckInReminder(opts: { employeeName: string; period: string; daysLeft: number }) {
  return postAdaptiveCard({
    title: `${opts.period} Check-in Reminder`,
    subtitle: `${opts.employeeName} — ${opts.daysLeft} days left in the window`,
    text: "Please log your quarterly achievement before the window closes.",
    openUrl: { label: "Submit check-in", url: `${baseUrl()}/check-ins` },
  });
}

export async function notifyEscalation(opts: { targetName: string; trigger: string; entityRef: string; link?: string }) {
  return postAdaptiveCard({
    title: "Escalation · Action Required",
    subtitle: `${opts.targetName} — ${opts.trigger.replace(/_/g, " ")}`,
    text: `Escalation raised for: ${opts.entityRef}`,
    openUrl: { label: "Open AtomicPulse", url: opts.link ?? baseUrl() },
  });
}
