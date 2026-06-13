import { useMemo, useState } from "react";
import { Plus, Search, Wheat } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { detectSeason } from "../lib/types";
import { feedsForLocation, searchFeeds } from "../lib/regionalFeeds";
import type { FeedItem } from "../lib/feedLibrary";
import { seasonLabel } from "../lib/india-regions";
import { Field } from "./ui";

export function FeedsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { session, addFeed, updateFeed, removeFeed } = useAdvisory();
  const [query, setQuery] = useState("");
  const hi = session.lang === "hi";
  const season = detectSeason();

  const pool = useMemo(
    () => feedsForLocation(session.location, season),
    [session.location, season]
  );
  const suggestions = useMemo(() => searchFeeds(query, pool).slice(0, 12), [query, pool]);

  const addFromPool = (feedId: string, name: string, category: "roughage" | "concentrate" | "mineral", rate: number) => {
    addFeed({
      feedId,
      feedName: name,
      qtyKg: category === "mineral" ? 0.15 : category === "roughage" ? 15 : 2,
      priceRs: rate,
      category,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">{hi ? "🌾 Charo aur daane" : "🌾 Feeds & prices"}</h2>
        <p className="text-sm text-[var(--muted)]">
          {seasonLabel(season, session.lang === "hi" ? "hi" : "en")} — {hi ? "jo khilate ho woh jodo; LP ±25% range mein optimize karega." : "Add what you feed; LP optimizes within ±25% of entered qty."}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 text-[var(--muted)]" size={16} />
        <input
          className="input pl-9"
          placeholder={hi ? "Berseem, bhusa, khali..." : "Search berseem, straw, cake..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
        {suggestions.map((f: FeedItem) => (
          <button
            key={f.id}
            type="button"
            className="card p-2 text-left text-sm hover:border-[var(--accent)] transition-colors"
            onClick={() => addFromPool(f.id, f.name, f.category, f.rate)}
          >
            <div className="font-medium truncate">{f.name}</div>
            <div className="text-xs text-[var(--muted)]">
              ₹{f.rate}/kg · {f.group}
            </div>
          </button>
        ))}
      </div>

      {session.feeds.length === 0 && (
        <div className="card p-4 text-sm text-[var(--muted)] flex gap-2">
          <Wheat size={18} />
          {hi
            ? "Kam se kam ek hara chara aur ek sukha chara jodo. Mineral mixture auto add hoga."
            : "Add at least one green and one dry roughage. Mineral mixture is added automatically."}
        </div>
      )}

      <div className="space-y-3">
        {session.feeds.map((f) => (
          <div key={f.feedId} className="card p-3 grid sm:grid-cols-4 gap-2 items-end">
            <div className="sm:col-span-2">
              <div className="font-medium text-sm">{f.feedName}</div>
              <div className="text-xs text-[var(--muted)]">{f.category}</div>
            </div>
            <Field label={hi ? "Kg/day" : "Kg/day"}>
              <input
                type="number"
                step="0.1"
                className="input"
                value={f.qtyKg}
                onChange={(e) => updateFeed(f.feedId, { qtyKg: Number(e.target.value) })}
              />
            </Field>
            <Field label="₹/kg">
              <input
                type="number"
                step="0.5"
                className="input"
                value={f.priceRs}
                onChange={(e) => updateFeed(f.feedId, { priceRs: Number(e.target.value) })}
              />
            </Field>
            <button type="button" className="text-xs text-red-400 sm:col-span-4 text-left" onClick={() => removeFeed(f.feedId)}>
              {hi ? "Hatao" : "Remove"}
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" onClick={onBack}>
          {hi ? "Peeche" : "Back"}
        </button>
        <button type="button" className="btn btn-primary flex-1" onClick={onNext} disabled={session.feeds.length < 2}>
          <Plus size={18} /> {hi ? "Ration banayein" : "Compute ration"}
        </button>
      </div>
    </div>
  );
}
