import { FEED_LIBRARY } from "./feedLibrary";
import { INDIAN_STATES } from "./india-regions";
import { agentLine, ConvStage, reprompt } from "./conversationScripts";
import { feedsForLocation } from "./regionalFeeds";
import { formatPlanSummary, computeHerdRation } from "./rationService";
import type { AdvisorySession, FarmerFeedEntry, LangCode, Species } from "./types";
import { defaultWeight, detectSeason, uid } from "./types";

export interface ConvDraft {
  name: string;
  district: string;
  village: string;
  state: string;
  stateCode: string;
  species: Species;
  inMilk: boolean;
  milkYieldKg: number;
  pregnant: boolean;
  roughageText: string;
  concentrateText: string;
  feeds: FarmerFeedEntry[];
}

export function emptyDraft(): ConvDraft {
  return {
    name: "",
    district: "",
    village: "",
    state: "",
    stateCode: "GJ",
    species: "cattle",
    inMilk: true,
    milkYieldKg: 8,
    pregnant: false,
    roughageText: "",
    concentrateText: "",
    feeds: [],
  };
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstNumber(text: string): number | null {
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function parseYes(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/^(haan|ha|han|yes|yep|yeah|ji|हाँ|हां|हा|आ|हो|छे|छ|है)/i.test(t) || /\b(yes|haan|ha|ji)\b/i.test(t)) return true;
  if (/^(nahi|na|no|nah|नही|नहीं|न|mat)/i.test(t) || /\b(no|nahi|na)\b/i.test(t)) return false;
  return null;
}

export function parseSpecies(text: string): Species | null {
  const t = text.toLowerCase();
  if (/bhains|buffalo|मह(?:ी|ि)?(?:स|ष)|भैंस|ભેંસ|भैंस/i.test(t)) return "buffalo";
  if (/gaay|gai|cow|cattle|गाय|गै|ગાય|cow/i.test(t)) return "cattle";
  return null;
}

function matchState(text: string): { name: string; code: string } | null {
  const t = clean(text).toLowerCase();
  for (const s of INDIAN_STATES) {
    if (t.includes(s.name.toLowerCase()) || t.includes(s.code.toLowerCase())) return s;
  }
  const aliases: Record<string, string> = {
    up: "UP",
    mp: "MP",
    gj: "GJ",
    gujarat: "GJ",
    maharashtra: "MH",
    punjab: "PB",
    haryana: "HR",
    bihar: "BR",
    rajasthan: "RJ",
    karnataka: "KA",
    tamil: "TN",
    telangana: "TS",
    kerala: "KL",
    bengal: "WB",
    odisha: "OR",
    assam: "AS",
  };
  for (const [key, code] of Object.entries(aliases)) {
    if (t.includes(key)) {
      const st = INDIAN_STATES.find((x) => x.code === code);
      if (st) return st;
    }
  }
  if (t.length >= 2) return { name: clean(text), code: "GJ" };
  return null;
}

const FEED_ALIASES: Record<string, string> = {
  wheat: "wheat_straw",
  bhusa: "wheat_straw",
  gehu: "wheat_straw",
  paddy: "paddy_straw",
  parali: "paddy_straw",
  berseem: "barseem_fodder",
  barseem: "barseem_fodder",
  lucerne: "lucerne_fodder",
  rijka: "lucerne_fodder",
  maize: "maize_fodder",
  makka: "maize_fodder",
  jowar: "jowar_fodder",
  mustard: "mustard_cake",
  sarson: "mustard_cake",
  khali: "mustard_cake",
  chokar: "wheat_bran",
  bran: "wheat_bran",
  groundnut: "groundnut_cake",
  moongphali: "groundnut_cake",
  cotton: "cotton_seed_cake",
  binola: "cotton_seed_cake",
  napier: "napier_bajra___nb_21",
  ghas: "grass_hay",
  hay: "grass_hay",
};

function resolveFeedId(spoken: string, location: AdvisorySession["location"]): FarmerFeedEntry | null {
  const t = spoken.toLowerCase();
  let feedId: string | undefined;
  for (const [alias, id] of Object.entries(FEED_ALIASES)) {
    if (t.includes(alias)) {
      feedId = id;
      break;
    }
  }
  if (!feedId) {
    const hit = FEED_LIBRARY.find(
      (f) => t.includes(f.name.toLowerCase().slice(0, 6)) || f.name.toLowerCase().includes(t.slice(0, 5))
    );
    feedId = hit?.id;
  }
  if (!feedId && location) {
    const regional = feedsForLocation(location, detectSeason());
    const r = regional.find((f) => t.includes(f.name.toLowerCase().slice(0, 5)));
    feedId = r?.id;
  }
  const lib = FEED_LIBRARY.find((f) => f.id === feedId);
  if (!lib) return null;
  const qty = firstNumber(spoken) ?? (lib.category === "roughage" ? 25 : 4);
  return {
    feedId: lib.id,
    feedName: lib.name,
    qtyKg: qty,
    priceRs: lib.rate,
    category: lib.category === "mineral" ? "mineral" : lib.category === "concentrate" ? "concentrate" : "roughage",
  };
}

function parseFeedsFromSpeech(text: string, location: AdvisorySession["location"]): FarmerFeedEntry[] {
  const parts = text.split(/,| aur | and | तथा | व |\+/i).map(clean).filter(Boolean);
  const out: FarmerFeedEntry[] = [];
  for (const part of parts.length ? parts : [text]) {
    const entry = resolveFeedId(part, location);
    if (entry) out.push(entry);
  }
  if (!out.length) {
    const fallback = resolveFeedId(text, location);
    if (fallback) out.push(fallback);
  }
  return out;
}

export function draftToSession(draft: ConvDraft, lang: LangCode): AdvisorySession {
  const label = [draft.village, draft.district, draft.state].filter(Boolean).join(", ");
  return {
    farmerName: draft.name,
    lang,
    location: draft.district
      ? {
          district: draft.district,
          state: draft.state,
          stateCode: draft.stateCode,
          village: draft.village,
          label,
        }
      : null,
    animals: [
      {
        id: uid(),
        label: draft.species === "buffalo" ? "Bhains 1" : "Gaay 1",
        species: draft.species,
        weightKg: defaultWeight(draft.species),
        calvings: 1,
        inMilk: draft.inMilk,
        monthsAfterCalving: 4,
        milkYieldKg: draft.milkYieldKg,
        milkFatPct: draft.species === "buffalo" ? 7 : 4,
        milkPriceRs: 34,
        pregnant: draft.pregnant,
        pregnancyMonth: draft.pregnant ? 5 : 0,
      },
    ],
    feeds: draft.feeds,
  };
}

export interface ProcessResult {
  reply: string;
  stage: ConvStage;
  draft: ConvDraft;
  session?: AdvisorySession;
  summary?: string;
  invalid?: boolean;
}

function buildCtx(draft: ConvDraft, extra: Record<string, string | number> = {}): Record<string, string | number> {
  return {
    name: draft.name,
    district: draft.district,
    village: draft.village,
    state: draft.state,
    species: draft.species,
    inMilk: draft.inMilk ? 1 : 0,
    pregnant: draft.pregnant ? 1 : 0,
    milkYieldKg: draft.milkYieldKg,
    roughageText: draft.roughageText.slice(0, 48),
    ...extra,
  };
}

export function processInput(
  lang: LangCode,
  stage: ConvStage,
  draft: ConvDraft,
  input: string
): ProcessResult {
  const text = clean(input);
  if (!text) {
    return { reply: reprompt(lang, stage, buildCtx(draft)), stage, draft, invalid: true };
  }

  switch (stage) {
    case "name": {
      draft.name = text.split(/\s+/)[0].replace(/ji$|bhai$|ben$/i, "") || text;
      return { reply: agentLine(lang, "name", buildCtx(draft)), stage: "district", draft };
    }
    case "district": {
      draft.district = text.replace(/\s*jila\s*$/i, "").trim();
      return { reply: agentLine(lang, "district", buildCtx(draft)), stage: "village", draft };
    }
    case "village": {
      draft.village = text.replace(/\s*gaanv\s*$/i, "").trim();
      return { reply: agentLine(lang, "village", buildCtx(draft)), stage: "state", draft };
    }
    case "state": {
      const st = matchState(text);
      if (!st) {
        return { reply: reprompt(lang, "state", buildCtx(draft)), stage, draft, invalid: true };
      }
      draft.state = st.name;
      draft.stateCode = st.code;
      return { reply: agentLine(lang, "state", buildCtx(draft)), stage: "species", draft };
    }
    case "species": {
      const sp = parseSpecies(text);
      if (!sp) {
        return { reply: reprompt(lang, "species", buildCtx(draft)), stage, draft, invalid: true };
      }
      draft.species = sp;
      return { reply: agentLine(lang, "species", buildCtx(draft)), stage: "milk_status", draft };
    }
    case "milk_status": {
      const yn = parseYes(text);
      const lower = text.toLowerCase();
      if (/doodh|milk|दूध|दुध|lit/i.test(lower) || (yn === true && !/garbh|pregnant|sukhi|dry/i.test(lower))) {
        draft.inMilk = true;
      } else if (/garbh|pregnant|garbha/i.test(lower)) {
        draft.inMilk = false;
        draft.pregnant = true;
      } else if (/sukhi|dry|suuk|suukhi/i.test(lower)) {
        draft.inMilk = false;
        draft.pregnant = false;
      } else if (yn === true) {
        draft.inMilk = true;
      } else if (yn === false) {
        draft.inMilk = false;
      } else {
        return { reply: reprompt(lang, "milk_status", buildCtx(draft)), stage, draft, invalid: true };
      }

      if (draft.inMilk) {
        return {
          reply: agentLine(lang, "milk_status", buildCtx(draft)),
          stage: "milk_yield",
          draft,
        };
      }
      if (draft.pregnant) {
        return {
          reply: agentLine(lang, "milk_status", buildCtx(draft)),
          stage: "feed_roughage",
          draft,
        };
      }
      const followUp =
        lang === "en"
          ? `Okay, she's dry. One more thing, ${draft.name} — is she pregnant right now? Yes or no.`
          : `Theek hai, sukhi hai. ${draft.name} ji, ek aur baat — kya abhi garbh hai? Haan ya nahi boliye.`;
      return { reply: followUp, stage: "pregnancy", draft };
    }
    case "milk_yield": {
      const n = firstNumber(text);
      if (!n || n <= 0 || n > 40) {
        return { reply: reprompt(lang, "milk_yield", buildCtx(draft)), stage, draft, invalid: true };
      }
      draft.milkYieldKg = n;
      return {
        reply: agentLine(lang, "milk_yield", buildCtx(draft)),
        stage: "feed_roughage",
        draft,
      };
    }
    case "pregnancy": {
      const yn = parseYes(text);
      if (yn === null && !/garbh|pregnant/i.test(text)) {
        return { reply: reprompt(lang, "pregnancy", buildCtx(draft)), stage, draft, invalid: true };
      }
      draft.pregnant = yn === true || /garbh|pregnant/i.test(text);
      return {
        reply: agentLine(lang, "pregnancy", buildCtx(draft)),
        stage: "feed_roughage",
        draft,
      };
    }
    case "feed_roughage": {
      draft.roughageText = text;
      const loc = draft.district
        ? {
            district: draft.district,
            state: draft.state,
            stateCode: draft.stateCode,
            village: draft.village,
            label: `${draft.village}, ${draft.state}`,
          }
        : null;
      const rough = parseFeedsFromSpeech(text, loc);
      draft.feeds = [...rough];
      return { reply: agentLine(lang, "feed_roughage", buildCtx(draft)), stage: "feed_concentrate", draft };
    }
    case "feed_concentrate": {
      draft.concentrateText = text;
      const loc = draft.district
        ? {
            district: draft.district,
            state: draft.state,
            stateCode: draft.stateCode,
            village: draft.village,
            label: `${draft.village}, ${draft.state}`,
          }
        : null;
      const conc = parseFeedsFromSpeech(text, loc);
      draft.feeds = [...draft.feeds, ...conc];
      if (draft.feeds.length < 2) {
        const regional = loc ? feedsForLocation(loc, detectSeason()).slice(0, 2) : FEED_LIBRARY.slice(0, 2);
        for (const f of regional) {
          if (!draft.feeds.some((x) => x.feedId === f.id)) {
            draft.feeds.push({
              feedId: f.id,
              feedName: f.name,
              qtyKg: f.category === "roughage" ? 20 : 3,
              priceRs: f.rate,
              category: f.category === "concentrate" ? "concentrate" : "roughage",
            });
          }
        }
      }
      const session = draftToSession(draft, lang);
      const report = computeHerdRation(session);
      const summary = formatPlanSummary(report, lang === "en" ? "en" : "hi");
      const ctx = buildCtx(draft, { summary });
      const closing = `${agentLine(lang, "feed_concentrate", ctx)}\n\n${agentLine(lang, "compute", ctx)}`;
      return {
        reply: closing,
        stage: "done",
        draft,
        session,
        summary,
      };
    }
    default:
      return { reply: agentLine(lang, "done", buildCtx(draft)), stage: "done", draft };
  }
}

export function initialStage(): ConvStage {
  return "name";
}

export function openingLine(lang: LangCode): string {
  return agentLine(lang, "greeting");
}
