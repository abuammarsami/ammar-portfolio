import { STAGE_DONE_EVENT } from "@/lib/agent/autopilot-event";
import { getHeroSnapshot, requestHeroData } from "@/lib/agent/hero-bridge";
import { applyLens, currentLens, type Lens } from "@/lib/agent/lens";
import { claimStage, releaseStage } from "@/lib/agent/stage-lock";
import { validateTourPlan } from "@/lib/agent/tour-plan";
import { TOUR, type TourStep } from "@/lib/agent/tour-script";
import { createWebmcpTools } from "@/lib/agent/webmcp-tools";

import { browserDeps } from "./webmcp-mount";

/**
 * The autopilot runner (plan-0005): performs the tour-script through the
 * real WebMCP tool layer with a synthetic cursor + caption bar. Imperative
 * DOM (no React) so it can survive route changes it causes itself; fully
 * lazy-loaded, 0 eager bytes. Escape, wheel, touch, or any click cancels.
 * Visitor state it touched (lens, hero data points) is restored at the end.
 */

let running = false;

/** Interview mode and the autopilot share the stage — one driver at a time. */
export function isTourRunning(): boolean {
  return running;
}

const Z = "2147483000"; // above everything, incl. the palette (z-50)

function el(tag: string, css: string): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = css;
  return node;
}

export async function runTour(navigate: (path: string) => void, opts: { interest?: string } = {}): Promise<void> {
  if (running || !claimStage("autopilot")) return; // never fight interview mode for the stage
  running = true;

  // everything the finally block tears down — assigned inside the try so a
  // setup throw can't wedge `running` or leak half-built stage pieces
  let cursor: HTMLElement | null = null;
  let bar: HTMLElement | null = null;
  let onKey: ((e: KeyboardEvent) => void) | null = null;
  let cancelFn: (() => void) | null = null;
  let lensBefore: Lens | null = null;
  let heroXs: number[] | null = null;

  try {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tools = new Map(createWebmcpTools(browserDeps(navigate)).map((t) => [t.name, t]));

    // remember what we're about to touch
    lensBefore = currentLens();
    const heroBefore = getHeroSnapshot();
    heroXs = heroBefore.mounted ? heroBefore.data.map((d) => d.x) : null;

    void fetch("/api/beacon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: "autopilot", surface: "autopilot" }),
    }).catch(() => {});

    // ── the stage: cursor + caption bar, inline-styled so no CSS ships eagerly
    cursor = el(
      "div",
      `position:fixed;left:0;top:0;width:22px;height:22px;pointer-events:none;z-index:${Z};` +
        `border:2px solid var(--color-q0);border-radius:50%;background:color-mix(in srgb, var(--color-q0) 25%, transparent);` +
        `box-shadow:0 0 12px var(--color-q0);transform:translate(-50%,-50%);will-change:left,top;`,
    );
    cursor.style.left = `${window.innerWidth / 2}px`;
    cursor.style.top = `${window.innerHeight / 2}px`;

    bar = el(
      "div",
      `position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:${Z};max-width:min(680px,calc(100vw - 32px));` +
        `background:var(--color-surface);color:var(--color-ink);border:1px solid color-mix(in srgb, var(--color-muted) 35%, transparent);` +
        `border-radius:2px;padding:12px 16px;font-family:var(--font-mono);font-size:13px;line-height:1.5;box-shadow:0 8px 32px rgb(0 0 0 / 0.35);`,
    );
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    const caption = el("p", "margin:0;");
    const result = el("p", "margin:6px 0 0;color:var(--color-q0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;");
    const hint = el("p", "margin:6px 0 0;color:var(--color-muted);font-size:11px;");
    hint.textContent = "autopilot · ⟨esc⟩ or scroll to stop";
    bar.append(caption, result, hint);
    document.body.append(cursor, bar);

    // ── cancellation: any human intent stops the machine
    let cancelled = false;
    cancelFn = () => {
      cancelled = true;
    };
    onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelled = true;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", cancelFn, { passive: true });
    window.addEventListener("touchmove", cancelFn, { passive: true });
    window.addEventListener("pointerdown", cancelFn);

    const sleep = async (ms: number) => {
      for (let t = 0; t < ms && !cancelled; t += 100) await new Promise((r) => setTimeout(r, 100));
    };

    const moveTo = async (x: number, y: number) => {
      if (!cursor) return;
      if (reduced) {
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        return;
      }
      const anim = cursor.animate(
        [
          { left: cursor.style.left, top: cursor.style.top },
          { left: `${x}px`, top: `${y}px` },
        ],
        { duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      await anim.finished.catch(() => {});
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };

    const pulse = () => {
      if (reduced || !cursor) return;
      cursor.animate(
        [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: "translate(-50%,-50%) scale(0.6)" }, { transform: "translate(-50%,-50%) scale(1)" }],
        { duration: 320, easing: "ease-out" },
      );
    };

    // dynamic mode (plan-0006): ask the server for a personalized plan, but
    // trust nothing — the returned steps are revalidated here against the
    // same closed grammar. Any failure means the static tour, never no tour.
    let steps: TourStep[] = TOUR;
    if (opts.interest && !cancelled) {
      caption.textContent = `planning a tour about “${opts.interest}” …`;
      try {
        const res = await fetch("/api/tour", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ interest: opts.interest }),
        });
        if (res.ok) {
          const data = (await res.json()) as { steps?: unknown };
          steps = validateTourPlan(data.steps) ?? TOUR;
        }
      } catch {
        /* static tour */
      }
    }

    for (const step of steps) {
      if (cancelled) break;
      caption.textContent = step.caption;
      result.textContent = "";

      if (step.waitForHero) {
        for (let t = 0; t < 2500 && !getHeroSnapshot().mounted && !cancelled; t += 100) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      if (step.target) {
        const target = document.querySelector(step.target);
        if (target) {
          const r = target.getBoundingClientRect();
          await moveTo(r.left + r.width / 2, r.top + r.height / 2);
        }
      }
      if (cancelled) break;
      if (step.tool) {
        const tool = tools.get(step.tool.name);
        if (tool) {
          pulse();
          const res = await tool.execute(step.tool.args ?? {}).catch(() => "");
          if (step.showResult && res) {
            result.textContent = res.replace(/\s+/g, " ").slice(0, 110) + "…";
          }
        }
      }
      await sleep(step.dwellMs);
    }
  } finally {
    // put the visitor's world back the way we found it
    if (lensBefore && currentLens() !== lensBefore) applyLens(lensBefore);
    if (heroXs && getHeroSnapshot().mounted) requestHeroData(heroXs[0], heroXs[1]);
    if (onKey) window.removeEventListener("keydown", onKey);
    if (cancelFn) {
      window.removeEventListener("wheel", cancelFn);
      window.removeEventListener("touchmove", cancelFn);
      window.removeEventListener("pointerdown", cancelFn);
    }
    cursor?.remove();
    bar?.remove();
    running = false;
    releaseStage("autopilot");
    window.dispatchEvent(new Event(STAGE_DONE_EVENT));
  }
}
