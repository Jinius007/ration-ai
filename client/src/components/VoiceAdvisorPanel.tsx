import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { ElevenLabsVoicePanel } from "./ElevenLabsVoicePanel";
import { LocalVoicePanel } from "./LocalVoicePanel";
import { t } from "../lib/i18n";

interface ElevenLabsConfig {
  configured: boolean;
  agentId?: string;
  missing?: string[];
}

/**
 * Uses ElevenLabs Conversational AI when server env is configured (natural voice + LLM).
 * Falls back to free browser speech otherwise.
 */
export function VoiceAdvisorPanel({ autoStart = false }: { autoStart?: boolean }) {
  const { session } = useAdvisory();
  const lang = session.lang;
  const [config, setConfig] = useState<ElevenLabsConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/elevenlabs/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ configured: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 className="animate-spin" size={20} /> {t(lang, "voiceLoading")}
      </div>
    );
  }

  const agentId = config?.agentId || import.meta.env.VITE_ELEVENLABS_AGENT_ID;
  if (config?.configured && agentId) {
    return <ElevenLabsVoicePanel agentId={agentId} autoStart={autoStart} />;
  }

  return <LocalVoicePanel autoStart={autoStart} />;
}

export function useSyncSessionToServer() {
  const { session } = useAdvisory();
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetch("/api/ration/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [session]);
}
