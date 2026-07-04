"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LESSON_COMPONENTS } from "./lessons";

const GATE_GLYPHS = ["RY", "H", "⊕", "📏", "∂θ", "⊞"] as const;

export type LessonMeta = { slug: string; title: string; order: number };

/**
 * Scrollytelling shell: fixed progress rail (a qubit wire with 6 gates),
 * sticky interactive stage, and IO-driven step detection. Lesson prose arrives
 * as server-rendered children; interactives are DOM/SVG (P4 baseline — the
 * WebGL stage of ADR-0006 P5 upgrades the stage without touching this shell).
 */
export function LearnJourney({
  lessons,
  children,
}: {
  lessons: LessonMeta[];
  children: ReactNode[]; // one rendered section per lesson, same order
}) {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = sectionRefs.current.indexOf(e.target as HTMLElement);
            if (i >= 0) setActive(i);
          }
        }
      },
      { rootMargin: "-40% 0px -50% 0px" },
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const Stage = LESSON_COMPONENTS[active] ?? LESSON_COMPONENTS[0];

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* ── progress rail: a qubit wire with 6 gates ── */}
      <nav
        aria-label="Lesson progress"
        className="fixed top-1/2 left-3 z-30 hidden -translate-y-1/2 lg:block"
      >
        <div className="relative flex flex-col items-center gap-5 py-3">
          <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[color-mix(in_srgb,var(--color-muted)_35%,transparent)]" />
          {lessons.map((l, i) => (
            <a
              key={l.slug}
              href={`#${l.slug}`}
              aria-current={i === active ? "step" : undefined}
              title={l.title}
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-sm border font-mono text-[10px] transition-all ${
                i === active
                  ? "border-q0 bg-surface text-q0 shadow-[0_0_12px_color-mix(in_srgb,var(--color-q0)_45%,transparent)]"
                  : "rule-hair bg-bg text-muted hover:text-ink"
              }`}
            >
              {GATE_GLYPHS[i]}
            </a>
          ))}
        </div>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        {/* ── prose column ── */}
        <div>
          {children.map((child, i) => (
            <section
              key={lessons[i]?.slug ?? i}
              id={lessons[i]?.slug}
              ref={(el) => {
                sectionRefs.current[i] = el;
              }}
              className="flex min-h-[85vh] flex-col justify-center py-16"
            >
              {child}
              {/* mobile: interactive inline under each lesson's prose */}
              <div className="mt-8 rounded-sm border rule-hair bg-surface p-4 lg:hidden">
                <LessonStageFor index={i} active />
              </div>
            </section>
          ))}
        </div>

        {/* ── sticky stage (desktop) ── */}
        <div className="hidden lg:block">
          <div className="sticky top-16 flex min-h-[85vh] items-center">
            <div
              className="w-full rounded-sm border rule-hair bg-surface/70 p-6 backdrop-blur-sm"
              aria-live="polite"
            >
              <p className="mb-4 font-mono text-xs text-muted">
                Fig. {active + 1} — {lessons[active]?.title.toLowerCase()} · interactive
              </p>
              <Stage key={active} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mobile inline stage — only mounts the active-ish lesson to stay light. */
function LessonStageFor({ index, active }: { index: number; active: boolean }) {
  const C = LESSON_COMPONENTS[index];
  if (!C || !active) return null;
  return <C />;
}
