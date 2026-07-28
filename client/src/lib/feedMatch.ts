import { FEED_LIBRARY, FeedItem } from "./feedLibrary";

/** Devanagari + romanized farmer names → library feed id */
const FEED_ALIASES: Record<string, string> = {
  "wheat straw": "wheat_straw",
  "gehu bhusa": "wheat_straw",
  "gehu ka bhusa": "wheat_straw",
  paddy: "paddy_straw",
  parali: "paddy_straw",
  berseem: "barseem_fodder",
  barseem: "barseem_fodder",
  lucerne: "lucerne_fodder",
  rijka: "lucerne_fodder",
  "maize fodder": "maize_fodder",
  "makka chara": "maize_fodder",
  "makai chara": "maize_fodder",
  "maize grain": "maize_grain",
  "makka dan": "maize_grain",
  "makka dana": "maize_grain",
  "makai dan": "maize_grain",
  "makai dana": "maize_grain",
  "makke ka dana": "maize_grain",
  "mustard cake": "mustard_cake",
  "sarson khali": "mustard_cake",
  "groundnut cake": "groundnut_cake",
  "wheat bran": "wheat_bran",
  chokar: "wheat_bran",
  "rice bran": "rice_bran_deoiled",
  "cotton cake": "cotton_seed_cake",
  "binola khali": "cotton_seed_cake",
  "mineral mixture": "mineral_mixture_bis",
  napier: "grass_hybrid_napier",
  "hybrid napier": "grass_hybrid_napier",
  "napier ghass": "grass_hybrid_napier",
  "napier ghaas": "grass_hybrid_napier",
  "napier ghas": "grass_hybrid_napier",
  "napier grass": "grass_hybrid_napier",
  "hybrid napier ghaas": "grass_hybrid_napier",
  "napier bajra": "napier_bajra___nb_21",
  "नेपियर घास": "grass_hybrid_napier",
  "मक्का दाना": "maize_grain",
  "मकई दाना": "maize_grain",
};

const FEED_HI_BY_ID: Record<string, string> = {
  grass_hybrid_napier: "हाइब्रिड नेपियर घास",
  napier_bajra___nb_21: "नेपियर बाजरा",
  maize_grain: "मक्का दाना",
  maize_fodder: "मक्के का हरा चारा",
};

function normalizeRomanQuery(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bghaa?s+\b/g, "grass");
}

function expandTokens(query: string): string[] {
  const base = query.split(/\s+/).filter((t) => t.length > 1);
  const out = new Set(base);
  const synonyms: Record<string, string[]> = {
    makai: ["maize", "makka"],
    makka: ["maize", "makai"],
    dana: ["grain"],
    dan: ["grain"],
    napier: ["napier", "grass"],
    grass: ["grass", "napier"],
  };
  for (const t of base) {
    for (const s of synonyms[t] ?? []) out.add(s);
  }
  return [...out];
}

function tokenScore(query: string, feed: FeedItem): number {
  const fn = feed.name.toLowerCase();
  const fid = feed.id.replace(/_/g, " ").toLowerCase();
  const tokens = expandTokens(normalizeRomanQuery(query));
  let score = 0;
  for (const t of tokens) {
    if (fn.includes(t) || fid.includes(t)) score += t.length;
  }
  const q = query.toLowerCase();
  if (/makai|makka|maize/.test(q) && /\bdan/.test(q) && feed.id === "maize_grain") score += 25;
  if (/napier/.test(q) && /ghaa?s|grass/.test(q) && feed.id.includes("napier")) score += 20;
  return score;
}

function matchDevanagari(raw: string): FeedItem | undefined {
  const trimmed = raw.trim();
  if (!/[\u0900-\u097F]/.test(trimmed)) return undefined;
  if (FEED_ALIASES[trimmed]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[trimmed]);
  }
  if (/नेपियर/.test(trimmed) && /घास/.test(trimmed)) {
    return FEED_LIBRARY.find((f) => f.id === "grass_hybrid_napier");
  }
  if (/मक(?:्का|ई)/.test(trimmed) && /दान/.test(trimmed)) {
    return FEED_LIBRARY.find((f) => f.id === "maize_grain");
  }
  for (const [id, hi] of Object.entries(FEED_HI_BY_ID)) {
    if (trimmed.includes(hi) || hi.includes(trimmed)) {
      return FEED_LIBRARY.find((f) => f.id === id);
    }
  }
  return undefined;
}

export function matchFeedByName(name: string): FeedItem | undefined {
  const raw = name.trim();
  if (!raw) return undefined;

  const dev = matchDevanagari(raw);
  if (dev) return dev;

  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  if (FEED_ALIASES[lower]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[lower]);
  }

  const exact = FEED_LIBRARY.find((f) => f.name.toLowerCase() === lower);
  if (exact) return exact;

  let best: { feed: FeedItem; score: number } | null = null;
  for (const f of FEED_LIBRARY) {
    const score = tokenScore(lower, f);
    if (score > 0 && (!best || score > best.score)) best = { feed: f, score };
  }
  if (best && best.score >= 8) return best.feed;

  return FEED_LIBRARY.find(
    (f) => f.name.toLowerCase().includes(lower) || lower.includes(f.name.toLowerCase().slice(0, 8))
  );
}
