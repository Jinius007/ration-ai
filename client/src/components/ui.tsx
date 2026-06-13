import { clsx } from "clsx";
import { LucideIcon } from "lucide-react";

export function StepProgress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={clsx(
              "step-dot",
              i === current && "active",
              i < current && "done"
            )}
          />
          <span className={clsx("text-xs sm:text-sm", i === current ? "text-white" : "text-[var(--muted)]")}>
            {label}
          </span>
          {i < steps.length - 1 && <span className="text-[var(--border)] hidden sm:inline">→</span>}
        </div>
      ))}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}
      {children}
    </label>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-4 flex gap-3 items-start">
      <div className="p-2 rounded-lg bg-[var(--accent)]/20 text-[var(--accent-light)]">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xs text-[var(--muted)]">{label}</div>
        <div className="text-lg font-bold">{value}</div>
        {sub && <div className="text-xs text-[var(--muted)] mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}
