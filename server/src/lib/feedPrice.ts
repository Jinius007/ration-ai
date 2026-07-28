import type { FeedItem } from "./feedLibrary.js";

const CATEGORY_DEFAULT_RS: Record<string, number> = {
  roughage: 2,
  concentrate: 18,
  mineral: 30,
};

/** Use farmer price when given; otherwise library / category default (never 0). */
export function resolveFeedPrice(
  priceRs: number | undefined,
  feed: FeedItem
): { price: number; estimated: boolean } {
  if (priceRs != null && Number.isFinite(priceRs) && priceRs > 0) {
    return { price: priceRs, estimated: false };
  }
  if (feed.rate > 0) {
    return { price: feed.rate, estimated: true };
  }
  return { price: CATEGORY_DEFAULT_RS[feed.category] ?? 5, estimated: true };
}

export function formatEstimatedPriceNote(
  entries: { name: string; price: number }[],
  lang: "hi" | "en"
): string {
  if (!entries.length) return "";
  const count = new Set(entries.map((e) => e.name)).size;
  return lang === "hi"
    ? `- ${count} चारों का दाम आपने नहीं बताया — हमने जिले की अनुमानित कीमत लगाई है (कुल खर्च में शामिल)।`
    : `- Price not given for ${count} feed(s) — regional library estimate used (included in total cost).`;
}
