import { FEED_LIBRARY, FeedItem } from "./feedLibrary.js";

/** Devanagari + romanized farmer names → library feed id */
const FEED_ALIASES: Record<string, string> = {
  // straw / roughage
  "wheat straw": "wheat_straw",
  "gehu bhusa": "wheat_straw",
  "gehu ka bhusa": "wheat_straw",
  "gehun ka bhoosa": "wheat_straw",
  "gehun ki bhoosi": "wheat_straw",
  "gehun ka bhusa": "wheat_straw",
  "paddy straw": "paddy_straw",
  parali: "paddy_straw",
  "dhan ki pural": "paddy_straw",
  berseem: "barseem_fodder",
  barseem: "barseem_fodder",
  rijka: "lucerne_fodder",
  lucerne: "lucerne_fodder",
  // maize fodder (green)
  "maize fodder": "maize_fodder",
  "makka chara": "maize_fodder",
  "makai chara": "maize_fodder",
  "makke ka hara chara": "maize_fodder",
  "makka hara chara": "maize_fodder",
  "makke ka hara": "maize_fodder",
  "makai ka hara chara": "maize_fodder",
  // maize grain (dan/dana)
  "maize grain": "maize_grain",
  "makka dan": "maize_grain",
  "makka dana": "maize_grain",
  "makai dan": "maize_grain",
  "makai dana": "maize_grain",
  "makke ka dan": "maize_grain",
  "makke ka dana": "maize_grain",
  "makai ka dana": "maize_grain",
  "maize dana": "maize_grain",
  "maize dan": "maize_grain",
  "makka": "maize_grain",
  "makai": "maize_grain",
  jowar: "jowar_fodder",
  "jowar fodder": "jowar_fodder",
  // concentrates
  "mustard cake": "mustard_cake",
  "sarson khali": "mustard_cake",
  "sarson ki khali": "mustard_cake",
  "groundnut cake": "groundnut_cake",
  "moongphali khali": "groundnut_cake",
  "wheat bran": "wheat_bran",
  chokar: "wheat_bran",
  "rice bran": "rice_bran_deoiled",
  "cotton cake": "cotton_seed_cake",
  "binola khali": "cotton_seed_cake",
  "cattle feed": "cattle_feed_bis_ii",
  "compound feed": "cattle_feed_bis_ii",
  "amul daan": "cattle_feed_bis_ii",
  "amul dan": "cattle_feed_bis_ii",
  "mineral mixture": "mineral_mixture_bis",
  "mineral mix": "mineral_mixture_bis",
  // napier / grass — all common Hindi spellings
  napier: "grass_hybrid_napier",
  "hybrid napier": "grass_hybrid_napier",
  "napier hybrid": "grass_hybrid_napier",
  "napier hybrid grass": "grass_hybrid_napier",
  "hybrid napier grass": "grass_hybrid_napier",
  "hybrid napier ghass": "grass_hybrid_napier",
  "hybrid napier ghaas": "grass_hybrid_napier",
  "napier ghass": "grass_hybrid_napier",
  "napier ghaas": "grass_hybrid_napier",
  "napier ghas": "grass_hybrid_napier",
  "napier grass": "grass_hybrid_napier",
  "napier ghaas hybrid": "grass_hybrid_napier",
  "napier bajra": "napier_bajra___nb_21",
  "napier bajra ghaas": "napier_bajra___nb_21",
  "nb 21": "napier_bajra___nb_21",
  "nb-21": "napier_bajra___nb_21",
  // Devanagari (farmer / voice ASR)
  "नेपियर घास": "grass_hybrid_napier",
  "हाइब्रिड नेपियर घास": "grass_hybrid_napier",
  "नेपियर बाजरा": "napier_bajra___nb_21",
  "मक्का दाना": "maize_grain",
  "मकई दाना": "maize_grain",
  "मक्के का दाना": "maize_grain",
  "मक्के का हरा चारा": "maize_fodder",
  "गेहूँ का भूसा": "wheat_straw",
  "गेहूं का भूसा": "wheat_straw",
  "धान की पराली": "paddy_straw",
  "सरसों की खली": "mustard_cake",
  "मूँगफली की खली": "groundnut_cake",
  "मूंगफली की खली": "groundnut_cake",
  "गेहूँ की चोकर": "wheat_bran",
  "बरसीम": "barseem_fodder",
  "बरसीम का चारा": "barseem_fodder",
};

/** Hindi display names keyed by feed id (for partial Devanagari match). */
const FEED_HI_BY_ID: Record<string, string> = {
  maize_fodder: "मक्के का हरा चारा",
  wheat_straw: "गेहूँ का भूसा",
  paddy_straw: "धान की पराली",
  mustard_cake: "सरसों की खली",
  groundnut_cake: "मूँगफली की खली",
  cattle_feed_bis_ii: "पशु आहार",
  mineral_mixture_bis: "खनिज मिश्रण",
  napier_bajra___nb_21: "नेपियर बाजरा",
  grass_hybrid_napier: "हाइब्रिड नेपियर घास",
  barseem_fodder: "बरसीम का चारा",
  lucerne_fodder: "रिजका",
  jowar_fodder: "ज्वार का चारा",
  wheat_bran: "गेहूँ की चोकर",
  maize_grain: "मक्का दाना",
};

function normalizeRomanQuery(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\bghaa?s+\b/g, "grass")
    .replace(/\bchara\b/g, "fodder")
    .replace(/\bchaara\b/g, "fodder");
}

function expandTokens(query: string): string[] {
  const base = query.split(/\s+/).filter((t) => t.length > 1);
  const out = new Set(base);
  const synonyms: Record<string, string[]> = {
    makai: ["maize", "makka"],
    makka: ["maize", "makai"],
    maize: ["maize"],
    dana: ["grain"],
    dan: ["grain"],
    grain: ["grain"],
    napier: ["napier", "grass"],
    grass: ["grass", "napier"],
    hybrid: ["hybrid"],
    bajra: ["bajra", "napier"],
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
  if (/napier/.test(q) && /ghaa?s|grass|chara|fodder/.test(q) && feed.id.includes("napier")) score += 20;
  if (q.includes("napier") && fn.includes("napier")) score += 10;
  if (q.includes("hybrid") && fn.includes("hybrid")) score += 8;
  if (/ghaa?s|grass/.test(q) && fn.includes("grass")) score += 6;
  return score;
}

function matchDevanagari(raw: string): FeedItem | undefined {
  const trimmed = raw.trim();
  if (!/[\u0900-\u097F]/.test(trimmed)) return undefined;

  if (FEED_ALIASES[trimmed]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[trimmed]);
  }

  for (const [id, hi] of Object.entries(FEED_HI_BY_ID)) {
    if (trimmed === hi || trimmed.includes(hi) || hi.includes(trimmed)) {
      return FEED_LIBRARY.find((f) => f.id === id);
    }
  }

  if (/नेपियर/.test(trimmed) && /घास/.test(trimmed)) {
    return FEED_LIBRARY.find((f) => f.id === "grass_hybrid_napier");
  }
  if (/मक(?:्का|ई)/.test(trimmed) && /दान/.test(trimmed)) {
    return FEED_LIBRARY.find((f) => f.id === "maize_grain");
  }

  return undefined;
}

export function matchFeedByName(name: string): FeedItem | undefined {
  const raw = name.trim();
  if (!raw) return undefined;

  const dev = matchDevanagari(raw);
  if (dev) return dev;

  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  const norm = normalizeRomanQuery(raw);

  if (FEED_ALIASES[lower]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[lower]);
  }
  if (FEED_ALIASES[norm]) {
    return FEED_LIBRARY.find((f) => f.id === FEED_ALIASES[norm]);
  }

  const exact = FEED_LIBRARY.find(
    (f) => f.name.toLowerCase() === lower || f.name.toLowerCase() === norm
  );
  if (exact) return exact;

  let best: { feed: FeedItem; score: number } | null = null;
  for (const f of FEED_LIBRARY) {
    const score = tokenScore(lower, f);
    if (score > 0 && (!best || score > best.score)) best = { feed: f, score };
  }
  if (best && best.score >= 8) return best.feed;

  return FEED_LIBRARY.find(
    (f) =>
      f.name.toLowerCase().includes(norm) ||
      norm.includes(f.name.toLowerCase().slice(0, 8)) ||
      f.id.replace(/_/g, " ").includes(norm)
  );
}
