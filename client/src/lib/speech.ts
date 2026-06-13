/** Browser Web Speech API — free, no API keys (Chrome/Edge/Safari). */

export type SpeechStatus = "idle" | "speaking" | "listening" | "unsupported";

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: { isFinal: boolean; [index: number]: { transcript: string } };
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((ev: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    SpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

const LANG_TO_BCP47: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  gu: "gu-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
  or: "or-IN",
  as: "as-IN",
  ur: "ur-IN",
};

export function speechLang(code: string): string {
  return LANG_TO_BCP47[code] ?? "hi-IN";
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const hasStt = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
  return hasStt && "speechSynthesis" in window;
}

function getRecognitionCtor(): (new () => BrowserSpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function pickVoice(langCode: string): SpeechSynthesisVoice | undefined {
  const prefix = langCode.split("-")[0];
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === langCode) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    voices.find((v) => v.lang.includes("IN"))
  );
}

export function speak(text: string, langCode: string): Promise<void> {
  return speakNatural(text, langCode);
}

/** Pause between sentences — feels more like a real phone call */
export async function speakNatural(text: string, langCode: string): Promise<void> {
  speechSynthesis.cancel();
  const parts = text.split(/(?<=[.!?؟])\s+|\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks = parts.length ? parts : [text];

  for (let i = 0; i < chunks.length; i++) {
    await new Promise<void>((resolve) => {
      const utter = new SpeechSynthesisUtterance(chunks[i]);
      utter.lang = langCode;
      utter.rate = 0.9;
      utter.pitch = 1;
      const voice = pickVoice(langCode);
      if (voice) utter.voice = voice;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      speechSynthesis.speak(utter);
    });
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
}

export function speakSingle(text: string, langCode: string): Promise<void> {
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = langCode;
    utter.rate = 0.9;
    utter.pitch = 1;
    const voice = pickVoice(langCode);
    if (voice) utter.voice = voice;
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    speechSynthesis.speak(utter);
  });
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
}

export interface ListenResult {
  transcript: string;
  isFinal: boolean;
}

export function listenOnce(langCode: string, onPartial?: (text: string) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      reject(new Error("Speech recognition not supported"));
      return;
    }

    const rec = new Ctor();
    rec.lang = langCode;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const part = ev.results[i][0].transcript.trim();
        if (ev.results[i].isFinal) finalText = part;
        else interim = part;
      }
      onPartial?.(finalText || interim);
    };

    rec.onerror = (ev: { error: string }) => {
      if (ev.error === "no-speech") resolve(finalText);
      else reject(new Error(ev.error));
    };

    rec.onend = () => resolve(finalText);

    rec.start();
  });
}

/** Warm up voice list (Chrome loads async). */
export function preloadVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
