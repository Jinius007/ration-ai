import type { FeedItem } from "./feedLibrary.js";

/** Max fresh weight (kg/day) for dry roughage — straw, hay, bhusa. */
export const DRY_FODDER_MAX_KG = 8;

/** Green fodder dm ~200; dry straw/hay typically dm > 400 g/kg. */
export function isDryFodder(feed: FeedItem): boolean {
  return feed.category === "roughage" && feed.dm > 400;
}

export function capFeedQty(feed: FeedItem, qty: number): number {
  if (isDryFodder(feed) && qty > DRY_FODDER_MAX_KG) {
    return DRY_FODDER_MAX_KG;
  }
  return Math.round(qty * 100) / 100;
}

export function rbpMaxQty(feed: FeedItem, currentQty: number): number {
  const rbp = Math.round(currentQty * 1.25 * 100) / 100;
  return capFeedQty(feed, rbp);
}

export function rbpMinQty(feed: FeedItem, currentQty: number): number {
  const rbp = Math.round(currentQty * 0.75 * 100) / 100;
  return capFeedQty(feed, rbp);
}
