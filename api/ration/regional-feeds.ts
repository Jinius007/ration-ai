import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    res.status(405).json({ result: "POST only" });
    return;
  }

  try {
    const { feedsForLocation } = await import("../../server/src/lib/regionalFeeds.js");
    const { detectSeason } = await import("../../server/src/lib/types.js");
    const { normalizeVoiceText } = await import("../../server/src/lib/voiceText.js");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const district = String(body.district ?? "");
    const state = String(body.state ?? "");
    if (!district) {
      res.status(200).json({ result: "District name chahiye — kisan se poochhiye." });
      return;
    }
    const season = detectSeason();
    const feeds = feedsForLocation({ district, state, label: `${district}, ${state}` }, season).slice(0, 30);
    const lines = feeds.map((f) => `• ${f.name} — ₹${f.rate} per kilogram (${f.group})`);
    res.status(200).json({
      result: normalizeVoiceText(`Mausam: ${season}. ${district}, ${state} ke common chara:\n${lines.join("\n")}`),
    });
  } catch (e) {
    res.status(500).json({ result: `Error: ${String(e)}` });
  }
}
