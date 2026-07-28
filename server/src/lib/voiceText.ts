/** Normalize farmer-facing text so voice engines read numbers and units naturally. */
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