import { FEED_LIBRARY, FEED_BY_ID, FeedItem } from "./feedLibrary";
import { mineralMixtureIdForLocation } from "./location";
import { regionForState } from "./india-regions";
import type { FarmerLocation, Region } from "./types";

const ROUGHAGE_GROUPS = new Set([
  "Grass",
  "Green Fodder",
  "Hay",
  "Straw",
  "Silage",
  "Leaves",
  "Other Rough",
]);

const CONCENTRATE_GROUPS = new Set([
  "Bran",
  "Chunni",
  "Compound Feed",
  "DOC/Meal",
  "Grain/Seed",
  "Husk",
  "Oil Cake",
  "Other conc.",
]);

/** Seasonal feeds commonly available by agro-climatic region */
const REGION_SEASON_FEEDS: Record<Region, Record<string, string[]>> = {
  north: {
    rabi: ["barseem_fodder", "wheat_fodder", "lucerne_fodder", "wheat_straw", "mustard_cake", "wheat_bran"],
    kharif: ["maize_fodder", "jowar_fodder", "napier_bajra___nb_21", "paddy_straw", "rice_bran_deoiled"],
    summer: ["napier_bajra___nb_21", "paddy_straw", "grass_hay", "maize_grain", "cattle_feed_bis_ii"],
  },
  west: {
    rabi: ["barseem_fodder", "jowar_fodder", "wheat_straw", "groundnut_cake", "cottonseed_meal"],
    kharif: ["maize_fodder", "jowar_fodder", "bajra_fodder", "paddy_straw", "cotton_seed_cake"],
    summer: ["napier_bajra___nb_21", "paddy_straw", "jowar_hay", "maize_grain", "cattle_feed_bis_i"],
  },
  south: {
    rabi: ["barseem_fodder", "lucerne_fodder", "cowpea_fodder", "paddy_straw", "groundnut_cake"],
    kharif: ["maize_fodder", "napier_bajra___nb_21", "cowpea_fodder", "paddy_straw", "rice_bran__16%_oil"],
    summer: ["napier_bajra___nb_21", "paddy_straw", "rhodes_grass", "maize_grain", "cattle_feed_bis_ii"],
  },
  east: {
    rabi: ["barseem_fodder", "mustard_fodder", "wheat_straw", "mustard_cake", "rice_bran_deoiled"],
    kharif: ["maize_fodder", "jowar_fodder", "paddy_straw", "rice_grain", "rice_bran_deoiled"],
    summer: ["paddy_straw", "grass_hay", "maize_fodder", "mustard_cake", "cattle_feed_bis_ii"],
  },
  central: {
    rabi: ["barseem_fodder", "wheat_fodder", "wheat_straw", "mustard_cake", "soyabean_meal"],
    kharif: ["maize_fodder", "jowar_fodder", "paddy_straw", "cottonseed_meal", "maize_grain"],
    summer: ["napier_bajra___nb_21", "paddy_straw", "jowar_hay", "wheat_bran", "cattle_feed_bis_i"],
  },
};

const MARKET_FALLBACK = [
  "barseem_fodder",
  "maize_fodder",
  "jowar_fodder",
  "wheat_straw",
  "paddy_straw",
  "wheat_bran",
  "mustard_cake",
  "groundnut_cake",
  "soyabean_meal",
  "maize_grain",
  "cattle_feed_bis_i",
  "cattle_feed_bis_ii",
  "molasses",
];

export function regionFromLocation(loc: FarmerLocation | null): Region {
  if (loc?.stateCode) return regionForState(loc.stateCode);
  const text = `${loc?.state ?? ""} ${loc?.district ?? ""}`.toLowerCase();
  if (/gujarat|rajasthan|madhya/.test(text)) return "west";
  if (/karnataka|tamil|kerala|andhra|telangana/.test(text)) return "south";
  if (/bengal|bihar|odisha|assam|jharkhand/.test(text)) return "east";
  if (/maharashtra|chhattisgarh/.test(text)) return "central";
  return "north";
}

export function seasonalFeedIds(region: Region, season: string): string[] {
  const map = REGION_SEASON_FEEDS[region];
  const ids = map[season] ?? map.rabi;
  return [...new Set([...ids, ...MARKET_FALLBACK])];
}

export function feedsForLocation(
  loc: FarmerLocation | null,
  season: string,
  includeAll = false
): FeedItem[] {
  if (includeAll) return FEED_LIBRARY;
  const region = regionFromLocation(loc);
  const ids = new Set(seasonalFeedIds(region, season));
  const mineralId = mineralMixtureIdForLocation(loc?.district ?? "", loc?.state ?? "");
  ids.add(mineralId);
  return FEED_LIBRARY.filter((f) => ids.has(f.id) || ROUGHAGE_GROUPS.has(f.group) && f.rate <= 15);
}

export function searchFeeds(query: string, pool: FeedItem[] = FEED_LIBRARY): FeedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return pool.slice(0, 40);
  return pool.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.group.toLowerCase().includes(q) ||
      f.id.includes(q.replace(/\s+/g, "_"))
  );
}

export function feedById(id: string): FeedItem | undefined {
  return FEED_BY_ID[id];
}

export { FEED_LIBRARY, FEED_BY_ID };
