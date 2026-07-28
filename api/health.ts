import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({
    ok: true,
    service: "ration-ai-lp-webhook-api",
    note: "Conversation runs on ElevenLabs. This API serves LP ration computation only.",
    endpoints: [
      "POST /api/webhook/elevenlabs/compute-ration",
      "POST /api/ration/regional-feeds",
      "POST /api/ration/nutrient-requirements",
    ],
  });
}
