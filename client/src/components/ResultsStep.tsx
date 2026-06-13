import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IndianRupee, Leaf, RefreshCw } from "lucide-react";
import { useAdvisory } from "../context/AdvisoryContext";
import { formatPlanSummary } from "../lib/rationService";
import type { AnimalRationPlan } from "../lib/rationService";
import type { RationLine } from "../lib/rationOptimizer";
import { StatCard } from "./ui";

export function ResultsStep({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
  const { session, report, compute } = useAdvisory();
  const hi = session.lang !== "en";
  const data = report ?? compute();

  const nutrientChart = data.plans.flatMap((p: AnimalRationPlan) => {
    if (!p.result.feasible) return [];
    return [
      {
        name: p.animal.label,
        TDN_req: Math.round(p.result.requirement.tdn),
        TDN_got: p.result.supply.tdn,
        CP_req: Math.round(p.result.requirement.cp),
        CP_got: p.result.supply.cp,
      },
    ];
  });

  const summaryText = formatPlanSummary(data, hi ? "hi" : "en");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-1">{hi ? "✅ Santulit khurak" : "✅ Balanced ration plan"}</h2>
        <p className="text-sm text-[var(--muted)]">
          {hi
            ? "Kam lagat wali santulit khurak — poshan, kharch aur chara sab cover."
            : "Least-cost balanced ration — nutrition, cost and feeds covered."}
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <StatCard icon={IndianRupee} label={hi ? "Nayi lagat / din" : "New cost / day"} value={`₹${data.totalDailyCost}`} sub={`${hi ? "Pehle" : "Was"} ₹${data.totalCurrentCost}`} />
        <StatCard
          icon={Leaf}
          label={hi ? "Bachat" : "Saving"}
          value={data.savings > 0 ? `₹${data.savings}` : "—"}
          sub={hi ? "Har din" : "Per day"}
        />
        <StatCard icon={RefreshCw} label={hi ? "Mausam" : "Season"} value={data.season} />
      </div>

      {nutrientChart.length > 0 && (
        <div className="card p-4 h-72">
          <h3 className="text-sm font-semibold mb-3">{hi ? "Poshan — maang vs mila" : "Nutrients — required vs supplied"}</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={nutrientChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3544" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a2332", border: "1px solid #2a3544" }} />
              <Legend />
              <Bar dataKey="TDN_req" fill="#64748b" name="TDN req" />
              <Bar dataKey="TDN_got" fill="#3cb896" name="TDN supply" />
              <Bar dataKey="CP_req" fill="#475569" name="CP req" />
              <Bar dataKey="CP_got" fill="#e8a838" name="CP supply" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.plans.map((plan: AnimalRationPlan) => (
        <div key={plan.animal.id} className="card p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2">
            <h3 className="font-bold">
              🐄 {plan.animal.label} · {plan.animal.inMilk ? `${plan.animal.milkYieldKg} L` : hi ? "Sukhi" : "Dry"}
            </h3>
            {!plan.result.feasible && (
              <span className="text-amber-400 text-sm">{hi ? "Aur chara chahiye" : "Need more feeds"}</span>
            )}
          </div>
          {plan.result.feasible && (
            <>
              <div className="text-xs text-[var(--muted)]">
                TDN {plan.result.supply.tdn}/{Math.round(plan.result.requirement.tdn)} g · CP {plan.result.supply.cp}/
                {Math.round(plan.result.requirement.cp)} g · DM {plan.result.supply.dm} g · Concentrate{" "}
                {plan.result.concentratePctOfDm}% (max {plan.result.maxConcentratePct}%)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--muted)] text-left">
                    <th className="py-1">{hi ? "Chara" : "Feed"}</th>
                    <th>kg</th>
                    <th>₹</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.result.lines.map((line: RationLine) => (
                    <tr key={line.feed.id} className="border-t border-[var(--border)]">
                      <td className="py-2">
                        {line.feed.name}
                        {line.suggested && (
                          <span className="ml-1 text-xs text-[var(--accent-light)]">+</span>
                        )}
                      </td>
                      <td>{line.qty}</td>
                      <td>{line.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plan.result.relaxed.length > 0 && (
                <p className="text-xs text-amber-400">
                  {hi ? "Note: " : "Relaxed: "}
                  {plan.result.relaxed.join(", ")}
                </p>
              )}
            </>
          )}
        </div>
      ))}

      <pre className="card p-4 text-xs whitespace-pre-wrap text-[var(--muted)] max-h-48 overflow-y-auto">{summaryText}</pre>

      <div className="flex gap-3">
        <button type="button" className="btn btn-secondary flex-1" onClick={onBack}>
          {hi ? "Feeds badlo" : "Edit feeds"}
        </button>
        <button type="button" className="btn btn-warm flex-1" onClick={onRestart}>
          {hi ? "Naya session" : "New session"}
        </button>
      </div>
    </div>
  );
}
