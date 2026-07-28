/** Convert farmer-facing chat/voice text to forms TTS reads naturally. */
const ROMAN_NUM_WORDS: Record<string, string> = {
  shunya: "0",
  ek: "1",
  do: "2",
  teen: "3",
  chaar: "4",
  char: "4",
  paanch: "5",
  panch: "5",
  chhah: "6",
  cheh: "6",
  saat: "7",
  aath: "8",
  nau: "9",
  das: "10",
  gyarah: "11",
  baarah: "12",
  barah: "12",
  terah: "13",
  chaudah: "14",
  pandrah: "15",
  solah: "16",
  satrah: "17",
  atharah: "18",
  unnis: "19",
  bees: "20",
};

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

/** Standalone Devanagari number words only (whole-word, not single letters). */
const DEVANAGARI_NUM_WORDS: Record<string, string> = {
  "एक": "1",
  "दो": "2",
  "तीन": "3",
  "चार": "4",
  "पांच": "5",
  "पाँच": "5",
  "छह": "6",
  "सात": "7",
  "आठ": "8",
  "नौ": "9",
  "दस": "10",
  "ग्यारह": "11",
  "बारह": "12",
  "तेरह": "13",
  "चौदह": "14",
  "पंद्रह": "15",
  "पन्द्रह": "15",
  "सोलह": "16",
  "सत्रह": "17",
  "अठारह": "18",
  "उन्नीस": "19",
  "बीस": "20",
};

export function normalizeChatNumbers(text: string): string {
  let out = text;
  for (const [d, digit] of Object.entries(DEVANAGARI_DIGITS)) {
    out = out.split(d).join(digit);
  }
  for (const [word, digit] of Object.entries(DEVANAGARI_NUM_WORDS)) {
    out = out.replace(new RegExp(word, "g"), digit);
  }
  for (const [word, digit] of Object.entries(ROMAN_NUM_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "gi"), digit);
  }
  out = normalizeVoiceText(out);
  return out;
}

export function normalizeVoiceText(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/g, (_, a, b) =>
      `${Math.round(parseFloat(a))} to ${Math.round(parseFloat(b))}`
    )
    .replace(/₹(\d+(?:\.\d+)?)/g, (_, n) => `₹${Math.round(parseFloat(n))}`)
    .replace(/(\d+)\.(\d+)/g, (_, int, dec) => String(Math.round(parseFloat(`${int}.${dec}`))))
    .replace(/\bkg\/day\b/gi, "kilogram per day")
    .replace(/\bkg\b/gi, "kilogram")
    .replace(/किग्रा/g, "किलोग्राम")
    .replace(/कि\.?\s*ग्रा\.?/g, "किलोग्राम");
}
