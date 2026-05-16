import "server-only";

/**
 * Teams Adaptive Cards (stub).
 *
 * Posts an Adaptive Card 1.5 payload to the configured incoming webhook.
 * Falls back to a console log if the webhook is not configured.
 */

type CardPayload = {
  title: string;
  subtitle?: string;
  text?: string;
  facts?: { title: string; value: string }[];
  openUrl?: { label: string; url: string };
};

export async function postAdaptiveCard(p: CardPayload): Promise<{ ok: boolean }> {
  const url = process.env.TEAMS_WEBHOOK_URL;
  const card = {
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
            p.subtitle && {
              type: "TextBlock",
              text: p.subtitle,
              spacing: "None",
              isSubtle: true,
              wrap: true,
            },
            p.text && { type: "TextBlock", text: p.text, wrap: true },
            p.facts && { type: "FactSet", facts: p.facts },
          ].filter(Boolean),
          actions: p.openUrl
            ? [
                {
                  type: "Action.OpenUrl",
                  title: p.openUrl.label,
                  url: p.openUrl.url,
                },
              ]
            : [],
        },
      },
    ],
  };
  if (!url) {
    console.info("[teams.adaptiveCard.stub]", JSON.stringify(card));
    return { ok: true };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
    return { ok: res.ok };
  } catch (e) {
    console.warn("[teams.adaptiveCard.error]", e);
    return { ok: false };
  }
}
