import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ result: "POST only" });
    return;
  }

  try {
    const { normalizeVoiceWebhookBody } = await import("../../../server/src/webhookNormalize.js");
    const { computeFromVoiceRequest } = await import("../../../server/src/rationBridge.js");
    const { normalizeVoiceText } = await import("../../../server/src/lib/voiceText.js");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const normalized = normalizeVoiceWebhookBody(body as Record<string, unknown>);
    const voice = computeFromVoiceRequest(normalized);

    if (voice.ok) {
      const warn = voice.warnings.length > 0 ? `\n(${voice.warnings.join("; ")})` : "";
      const text = normalizeVoiceText(`${voice.chatText}${warn}`);
      res.status(200).json({
        result: text,
        chat_text: text,
        step: voice.step,
        warnings: voice.warnings,
      });
      return;
    }

    res.status(200).json({
      result: voice.error ?? "Could not compute ration.",
      warnings: voice.warnings,
    });
  } catch (e) {
    res.status(500).json({ result: `LP engine error: ${String(e)}` });
  }
}
