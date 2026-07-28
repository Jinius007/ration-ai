import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    res.status(405).json({ result: "POST only" });
    return;
  }

  try {
    const { computeRequirement } = await import("../../server/src/lib/nutrientRequirements.js");
    const { defaultWeight } = await import("../../server/src/lib/types.js");
    const { normalizeVoiceText } = await import("../../server/src/lib/voiceText.js");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const species = body.species === "buffalo" ? "buffalo" : "cattle";
    const weight = Number(body.weight_kg) || defaultWeight(species);
    const req_ = computeRequirement({
      species,
      weight,
      adult: (Number(body.calvings) || 1) > 0,
      pregnant: !!body.pregnant,
      pregnancyMonth: Number(body.pregnancy_month) || 0,
      inMilk: body.in_milk ?? (Number(body.milk_yield_litres) || 0) > 0,
      milkYield: Number(body.milk_yield_litres) || 0,
      milkFat: Number(body.milk_fat_percent) || (species === "buffalo" ? 7 : 4),
      monthsAfterCalving: Number(body.months_after_calving) || 4,
      milkPrice: 34,
    });
    res.status(200).json({
      result: normalizeVoiceText(
        `Roz ki zaroorat (INAPH): TDN ${Math.round(req_.total.tdn)} gram, CP ${Math.round(req_.total.cp)} gram, Calcium ${req_.total.ca.toFixed(1)} gram, Phosphorus ${req_.total.p.toFixed(1)} gram.`
      ),
    });
  } catch (e) {
    res.status(500).json({ result: `Error: ${String(e)}` });
  }
}
