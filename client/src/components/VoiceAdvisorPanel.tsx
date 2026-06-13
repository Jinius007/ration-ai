import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { Loader2, Mic, Phone, PhoneOff, Volume2 } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import {
  callComputeRation,
  callListRegionalFeeds,
  computeRequirementsLocal,
} from "../lib/voiceRationTools";

interface ElevenLabsConfig {
  configured: boolean;
  agentId?: string;
  agentName?: string;
}

interface ChatLine {
  role: "user" | "agent";
  text: string;
}

function TranscriptPanel({ lines, hi }: { lines: ChatLine[]; hi: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  if (!lines.length) {
    return (
      <p className="text-xs text-[var(--muted)] italic">
        {hi ? "Call shuru karo — yahan baat-cheet dikhegi." : "Start a call — conversation appears here."}
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-52 overflow-y-auto text-sm pr-1">
      {lines.map((m, i) => (
        <div
          key={i}
          className={`rounded-lg px-3 py-2 ${
            m.role === "user" ? "bg-[var(--accent)]/15 ml-4" : "bg-[var(--border)]/40 mr-4"
          }`}
        >
          <span className="text-[10px] uppercase text-[var(--muted)] block mb-0.5">
            {m.role === "user" ? (hi ? "Aap" : "You") : "Pashu Sahayak"}
          </span>
          {m.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function VoiceControls({
  hi,
  lines,
  onClear,
}: {
  hi: boolean;
  lines: ChatLine[];
  onClear: () => void;
}) {
  const { session } = useAdvisory();
  const { startSession, endSession } = useConversationControls();
  const { status } = useConversationStatus();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const live = status === "connected" || status === "connecting";

  const startCall = useCallback(async () => {
    setError(null);
    onClear();
    setConnecting(true);
    try {
      const resp = await fetch("/api/elevenlabs/signed-url");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not start voice session");
      await startSession({
        signedUrl: data.signed_url,
        connectionType: "websocket",
        dynamicVariables: {
          farmer_name: session.farmerName || "farmer",
          district: session.location?.district || "",
          state: session.location?.state || "",
          animal_count: String(session.animals.length),
          lang: session.lang,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, [session, startSession, onClear]);

  const statusLabel: Record<string, string> = hi
    ? { disconnected: "band", connecting: "jud raha", connected: "live", disconnecting: "band ho raha" }
    : { disconnected: "off", connecting: "connecting", connected: "live", disconnecting: "ending" };

  return (
    <div className="card p-4 space-y-4 border-[var(--warm)]/40 bg-gradient-to-b from-[var(--card)] to-[#15202b]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold flex items-center gap-2 text-lg">
            <Volume2 size={20} className="text-[var(--warm)]" />
            {hi ? "Pashu Sahayak se baat karein" : "Talk to Pashu Sahayak"}
          </h3>
          <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
            {hi
              ? "Seedha boliye — jaise gaon ke livestock officer se. Hindi ya aapki bhasha mein, ek-ek sawal karke khurak samjhaye ga."
              : "Speak naturally like with a village livestock officer. Hindi or your language — one question at a time."}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full shrink-0 ${
            status === "connected" ? "bg-green-500/20 text-green-300" : "bg-[var(--border)]"
          }`}
        >
          {statusLabel[status] ?? status}
        </span>
      </div>

      <TranscriptPanel lines={lines} hi={hi} />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        {!live ? (
          <button type="button" className="btn btn-warm flex-1 py-3" onClick={startCall} disabled={connecting}>
            {connecting ? <Loader2 className="animate-spin" size={20} /> : <Phone size={20} />}
            {hi ? "Awaz se shuru karein" : "Start voice conversation"}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary flex-1 py-3" onClick={() => endSession()}>
            <PhoneOff size={20} /> {hi ? "Baat khatam" : "End conversation"}
          </button>
        )}
      </div>

      <p className="text-[10px] text-[var(--muted)] text-center">Agent: ration-ai · ElevenLabs</p>
    </div>
  );
}

function VoiceSession({ agentId, hi }: { agentId: string; hi: boolean }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const clear = useCallback(() => setLines([]), []);

  return (
    <ConversationProvider
      agentId={agentId}
      clientTools={{
        compute_balanced_ration: async (params: Record<string, unknown>) => {
          return callComputeRation(params);
        },
        list_regional_feeds: async (params: { district?: string; state?: string }) => {
          return callListRegionalFeeds({
            district: String(params.district ?? ""),
            state: String(params.state ?? ""),
          });
        },
        get_nutrient_requirements: async (params: Record<string, unknown>) => {
          return computeRequirementsLocal(params as Parameters<typeof computeRequirementsLocal>[0]);
        },
      }}
      onMessage={(ev) => {
        const source = ev.source === "user" ? "user" : "agent";
        const text = ev.message?.trim();
        if (!text) return;
        setLines((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === source) {
            return [...prev.slice(0, -1), { role: source, text }];
          }
          return [...prev, { role: source, text }];
        });
      }}
    >
      <VoiceControls hi={hi} lines={lines} onClear={clear} />
    </ConversationProvider>
  );
}

export function VoiceAdvisorPanel() {
  const { session } = useAdvisory();
  const hi = session.lang === "hi";
  const [config, setConfig] = useState<ElevenLabsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/elevenlabs/config")
      .then((r) => r.json())
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 className="animate-spin" size={16} /> {hi ? "Voice taiyar ho raha…" : "Loading voice…"}
      </div>
    );
  }

  if (!config?.configured || !config.agentId) {
    return (
      <div className="card p-4 text-sm text-[var(--muted)]">
        <Mic size={18} className="inline mr-2" />
        {hi ? "ElevenLabs configure nahi hai." : "ElevenLabs not configured."}
      </div>
    );
  }

  return <VoiceSession agentId={config.agentId} hi={hi} />;
}

export function useSyncSessionToServer() {
  const { session } = useAdvisory();
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch("/api/ration/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [session]);
}
