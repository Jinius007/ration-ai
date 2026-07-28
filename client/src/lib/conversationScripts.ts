import type { LangCode } from "./types";

export type ConvStage =
  | "greeting"
  | "name"
  | "district"
  | "village"
  | "state"
  | "species"
  | "milk_status"
  | "milk_yield"
  | "pregnancy"
  | "feed_roughage"
  | "feed_concentrate"
  | "compute"
  | "done";

type ScriptFn = (ctx: Record<string, string | number>) => string;

const HI: Record<ConvStage, ScriptFn> = {
  greeting: () =>
    "Namaste! Main aapka Pashu Sahayak hoon — bilkul waise hi jaise gaon ka livestock officer. Thodi si baat karke aapke pashu ke liye santulit khurak banaunga. Shuru karte hain — aap apna naam batayiye.",
  name: (c) =>
    `${c.name} ji! Bahut achha. ${c.name} ji, aap kis jile mein rehte hain? Jila ka naam boliye.`,
  district: (c) =>
    `${c.district} jila — theek hai, note kar liya. ${c.name} ji, aapka gaanv ka naam kya hai?`,
  village: (c) =>
    `${c.village} gaanv — achha hai. Ab batayiye, ye gaanv kis rajya mein pada hai? Jaise Gujarat, UP, Maharashtra…`,
  state: (c) =>
    `${c.state} — samajh gaya. Toh ${c.name} ji, ab ek zaroori baat — aapke paas gaay hai ya bhains?`,
  species: (c) =>
    c.species === "buffalo"
      ? "Bhains hai — theek. Kya ye abhi doodh de rahi hai? Ya sukhi hai, ya phir garbh hai?"
      : "Gaay hai — theek. Kya ye abhi doodh de rahi hai? Ya sukhi hai, ya phir garbh hai?",
  milk_status: (c) =>
    c.inMilk === 1
      ? `Achha, doodh de rahi hai — badhiya. Roz kitna doodh milta hai? Litron mein boliye, jaise 6, 8 ya 10.`
      : c.pregnant === 1
        ? "Theek — garbh hai. Ab batayiye, roz kya chara khilate ho? Har chara ka naam aur variety batayiye — kitna kilogram, aur kilogram ka daam?"
        : "Samajh gaya — sukhi hai. Ab batayiye, roz kya chara khilate ho? Har chara ka naam aur variety batayiye — kitna kilogram, aur kilogram ka daam?",
  milk_yield: (c) =>
    c.milkYieldKg
      ? `${c.milkYieldKg} litre roz — note kar liya. Ab chara ke baare mein batayiye — subah shaam kya dalte ho? Har chara ka naam aur variety batayiye, jaise hybrid napier ghaas, berseem, gehu bhusa — kitna kilogram dete ho, aur ek kilogram ka kitna rupaya dete ho?`
      : "Ab chara ke baare mein batayiye — subah shaam kya dalte ho? Har chara ka naam aur variety batayiye, jaise hybrid napier ghaas, berseem, gehu bhusa — kitna kilogram, aur ek kilogram ka daam?",
  pregnancy: () =>
    "Theek hai. Ab chara ke baare mein — roz kya dalte ho? Har ek ka naam aur variety batayiye, kitna kilogram, aur kilogram ka daam?",
  feed_roughage: (c) =>
    c.roughageText
      ? `Achha, ${c.roughageText} — sun liya. Ab concentrate kya dete ho? Sarson khali, chokar, dan? Har ek ka naam, kitna kilogram, aur kilogram ka daam batayiye. Agar daam pata nahi ho to "pata nahi" boliye.`
      : "Sun liya. Ab concentrate — sarson khali, chokar, moongphali khali? Naam, kitna kilogram, aur kilogram ka daam batayiye. Agar daam pata nahi ho to boliye.",
  feed_concentrate: (c) =>
    `${c.name} ji, sab samajh aa gaya — dhanyavaad. Main ab aapke ${c.district} ke hisaab se santulit khurak nikal raha hoon… bas ek pal rukiye.`,
  compute: (c) =>
    typeof c.summary === "string" && c.summary
      ? `${c.summary}\n\n${c.name} ji, aur kuch poochna ho to boliye. Warna neeche poori detail bhi dekh sakte hain.`
      : `${c.name} ji, khurak tayyar hai. Neeche detail dekhein. Aur sawal ho to poochhiye.`,
  done: () =>
    "Bahut achha raha yeh baat-cheet. Phir kabhi zaroorat ho to dubara call shuru kar lijiye. Dhanyavaad!",
};

const EN: Record<ConvStage, ScriptFn> = {
  greeting: () =>
    "Hello! I'm your Pashu Sahayak — like the livestock officer in your village. I'll ask a few simple questions and work out a balanced ration. Let's start — what's your name?",
  name: (c) =>
    `Nice to meet you, ${c.name}! Which district do you live in?`,
  district: (c) =>
    `${c.district} — got it, I've noted that. And what's your village name, ${c.name}?`,
  village: (c) =>
    `${c.village} — lovely. Which state is that in? For example Gujarat, UP, Maharashtra…`,
  state: (c) =>
    `${c.state} — understood. Now ${c.name}, do you have a cow or a buffalo?`,
  species: (c) =>
    c.species === "buffalo"
      ? "A buffalo — okay. Is she giving milk right now, or dry, or pregnant?"
      : "A cow — okay. Is she giving milk right now, or dry, or pregnant?",
  milk_status: (c) =>
    c.inMilk === 1
      ? "Good, she's in milk. Roughly how many litres per day? Say a number like 6, 8 or 10."
      : c.pregnant === 1
        ? "Understood — she's pregnant. What roughage do you feed daily? Name each variety, kilogram amount, and price per kilogram."
        : "Got it — she's dry. What roughage do you feed daily? Name each variety, kilogram amount, and price per kilogram.",
  milk_yield: (c) =>
    c.milkYieldKg
      ? `${c.milkYieldKg} litres a day — noted. Now tell me about fodder — what do you give morning and evening? Name each variety, like hybrid napier grass, berseem, wheat straw — how many kilogram, and price per kilogram?`
      : "Tell me about fodder — what do you give morning and evening? Name each variety — how many kilogram, and price per kilogram?",
  pregnancy: () =>
    "Okay. What roughage do you give each day? Name each variety, kilogram amount, and price per kilogram.",
  feed_roughage: (c) =>
    c.roughageText
      ? `Got it — ${c.roughageText}. What concentrates do you use? Mustard cake, bran, grain? Name, kilogram, and price per kilogram for each. Say "don't know" if you're unsure of the price.`
      : "Thanks. Now concentrates — mustard cake, bran, groundnut cake? Name, kilogram, and price per kilogram. Say if you don't know the price.",
  feed_concentrate: (c) =>
    `${c.name}, that's everything I need — thank you. I'm working out a balanced ration for ${c.district}… just a moment.`,
  compute: (c) =>
    typeof c.summary === "string" && c.summary
      ? `${c.summary}\n\n${c.name}, ask me anything else, or see the full details below.`
      : `${c.name}, your ration plan is ready. See the details below.`,
  done: () => "Great talking with you. Come back anytime you need help. Thank you!",
};

/** Warm reprompts when we didn't understand — feels like a real follow-up */
export function reprompt(lang: LangCode, stage: ConvStage, ctx: Record<string, string | number>): string {
  const n = ctx.name ? `${ctx.name} ji, ` : "";
  if (lang === "en") {
    const en: Partial<Record<ConvStage, string>> = {
      name: "Sorry, I didn't catch your name. Could you say it again?",
      district: `${n}which district are you in?`,
      village: `${n}what's your village called?`,
      state: "Which state — Gujarat, UP, Maharashtra…?",
      species: "Just to confirm — cow or buffalo?",
      milk_status: "Is she in milk now, or dry, or pregnant?",
      milk_yield: "How many litres of milk per day? A number like 8 or 10.",
      pregnancy: "Is she pregnant? Yes or no.",
      feed_roughage: "What fodder do you give? Name, variety, kilogram amount, and price per kilogram.",
      feed_concentrate: "What concentrate — mustard cake, bran? Name, kilogram, and price per kilogram?",
    };
    return en[stage] ?? "Could you say that once more?";
  }
  const hi: Partial<Record<ConvStage, string>> = {
    name: "Maaf kijiye, naam clear nahi suna. Ek baar phir apna naam boliye.",
    district: `${n}kis jile mein rehte hain? Jile ka naam boliye.`,
    village: `${n}aapke gaanv ka naam kya hai?`,
    state: "Kaunsa rajya hai — Gujarat, UP, Maharashtra…?",
    species: "Ek baar phir batayiye — gaay hai ya bhains?",
    milk_status: "Abhi doodh de rahi hai, ya sukhi hai, ya garbh hai?",
    milk_yield: "Roz kitna litre doodh milta hai? Jaise 6, 8 ya 10.",
    pregnancy: "Kya garbh hai? Haan ya nahi boliye.",
    feed_roughage: "Roz kya chara dalte ho? Naam aur variety, kitna kilogram, aur kilogram ka daam batayiye.",
    feed_concentrate: "Concentrate kya dete ho — sarson khali, chokar? Naam, kitna kilogram, aur daam?",
  };
  return hi[stage] ?? "Thoda clear boliye, main phir se sun leta hoon.";
}

const SCRIPTS: Partial<Record<LangCode, Record<ConvStage, ScriptFn>>> = { hi: HI, en: EN };

export function agentLine(lang: LangCode, stage: ConvStage, ctx: Record<string, string | number> = {}): string {
  const pack = SCRIPTS[lang] ?? HI;
  return pack[stage](ctx);
}

export function nextStage(stage: ConvStage, ctx: { inMilk?: boolean }): ConvStage {
  const flow: Record<ConvStage, ConvStage> = {
    greeting: "name",
    name: "district",
    district: "village",
    village: "state",
    state: "species",
    species: "milk_status",
    milk_status: ctx.inMilk ? "milk_yield" : "pregnancy",
    milk_yield: "feed_roughage",
    pregnancy: "feed_roughage",
    feed_roughage: "feed_concentrate",
    feed_concentrate: "compute",
    compute: "done",
    done: "done",
  };
  return flow[stage];
}
