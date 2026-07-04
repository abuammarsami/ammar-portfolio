import { getStats } from "@/lib/content/loader";
import { Reveal } from "./reveal";

export function StatsStrip() {
  const stats = getStats();
  if (!stats.length) return null;
  return (
    <section className="border-t rule-hair">
      <Reveal stagger className="mx-auto grid max-w-4xl grid-cols-2 gap-y-10 px-6 py-14 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="pr-6">
            <p className="stat-value">{s.value}</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-muted">{s.label}</p>
          </div>
        ))}
      </Reveal>
    </section>
  );
}
