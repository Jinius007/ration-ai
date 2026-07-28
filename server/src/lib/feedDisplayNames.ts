import { feedById } from "./regionalFeeds.js";

/** Devanagari display names for common library feeds (Hindi chat). */
const FEED_HI: Record<string, string> = {
  maize_fodder: "मक्के का हरा चारा",
  wheat_straw: "गेहूँ का भूसा",
  paddy_straw: "धान की पराली",
  mustard_cake: "सरसों की खली",
  groundnut_cake: "मूँगफली की खली",
  cattle_feed_bis_ii: "पशु आहार (अमूल/कंपाउंड दान)",
  mineral_mixture_bis: "खनिज मिश्रण",
  napier_bajra___nb_21: "नेपियर बाजरा",
  grass_hybrid_napier: "हाइब्रिड नेपियर घास",
  barseem_fodder: "बरसीम का चारा",
  lucerne_fodder: "रिजका/लुसर्न",
  jowar_fodder: "ज्वार का चारा",
  wheat_bran: "गेहूँ की चोकर",
  maize_grain: "मक्का दाना",
};

export function displayFeedName(
  feedId: string,
  lang: "hi" | "en",
  spokenName?: string
): string {
  const lib = feedById(feedId);
  if (lang === "en") return spokenName ?? lib?.name ?? feedId;
  if (spokenName && /[\u0900-\u097F]/.test(spokenName)) return spokenName;
  return FEED_HI[feedId] ?? spokenName ?? lib?.name ?? feedId;
}
