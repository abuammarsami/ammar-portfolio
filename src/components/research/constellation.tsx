"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { Constellation } from "@/lib/research/graph";

const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

/** prefers-reduced-motion as an external store — no setState-in-effect. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_MQ);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MQ).matches,
    () => true,
  );
}

function cssColor(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Offscreen radial-gradient glow sprite (same technique as the hero canvas). */
function glowSprite(color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

type XY = { x: number; y: number };

function bezierPoint(a: XY, b: XY, t: number): XY {
  // gentle sag toward the stage center gives edges an orbital feel
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + Math.abs(a.y - b.y) * 0.18 + 14;
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * mx + t * t * b.x,
    y: u * u * a.y + 2 * u * t * my + t * t * b.y,
  };
}

/**
 * The research constellation (ADR-0008): real links laid out as a map of the
 * space; this client shell only animates the entangled edges on a 2D canvas
 * beneath them. No WebGL, no dependencies. Pauses off-screen; reduced motion
 * renders a single static frame.
 */
export function ConstellationStage({ graph }: { graph: Constellation }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let q0 = "";
    let q1 = "";
    let muted = "";
    const spriteCache = new Map<string, HTMLCanvasElement>();
    const sprite = (color: string): HTMLCanvasElement => {
      let s = spriteCache.get(color);
      if (!s) {
        s = glowSprite(color);
        spriteCache.set(color, s);
      }
      return s;
    };
    const readColors = () => {
      q0 = cssColor(wrap, "--color-q0", "#5FC9BF");
      q1 = cssColor(wrap, "--color-q1", "#9D8CFF");
      muted = cssColor(wrap, "--color-muted", "#8B93A7");
    };
    readColors();

    let raf = 0;
    let frame = 0;
    let live = true;
    let w = 0;
    let h = 0;

    const positions = (): Map<string, XY> => {
      const m = new Map<string, XY>();
      for (const n of graph.nodes) m.set(n.id, { x: (n.x / 100) * w, y: (n.y / 100) * h });
      return m;
    };

    const draw = () => {
      const pos = positions();
      ctx.clearRect(0, 0, w, h);
      const hovered = hoverRef.current;

      for (const e of graph.edges) {
        const a = pos.get(e.a);
        const b = pos.get(e.b);
        if (!a || !b) continue;
        const hot = hovered !== null && (e.a === hovered || e.b === hovered);
        ctx.beginPath();
        ctx.setLineDash(e.dashed ? [3, 5] : []);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, q0);
        grad.addColorStop(1, q1);
        ctx.strokeStyle = hot ? grad : muted;
        ctx.globalAlpha = hot ? 0.9 : 0.28;
        ctx.lineWidth = hot ? 1.4 : 1;
        const steps = 24;
        for (let s = 0; s <= steps; s++) {
          const p = bezierPoint(a, b, s / steps);
          if (s === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // photons riding the edges (skipped under reduced motion)
      if (!reduced) {
        ctx.globalCompositeOperation = "lighter";
        graph.edges.forEach((e, i) => {
          const a = pos.get(e.a);
          const b = pos.get(e.b);
          if (!a || !b) return;
          const t = ((frame * 0.4 + i * 37) % 240) / 240;
          const p = bezierPoint(a, b, t);
          const glow = i % 2 === 0 ? sprite(q0) : sprite(q1);
          ctx.globalAlpha = 0.7;
          ctx.drawImage(glow, p.x - 6, p.y - 6, 12, 12);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // halos under the DOM nodes
      ctx.globalCompositeOperation = "lighter";
      for (const n of graph.nodes) {
        const p = pos.get(n.id)!;
        const glow = n.type === "project" ? sprite(q1) : sprite(q0);
        const r = n.type === "paper" ? 26 : 18;
        ctx.globalAlpha = hoverRef.current === n.id ? 0.45 : 0.15;
        ctx.drawImage(glow, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const loop = () => {
      frame++;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // next-themes toggles data-theme on <html>; re-read tokens and repaint
    // (covers the reduced-motion static frame, which has no rAF loop)
    const mo = new MutationObserver(() => {
      readColors();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const io = new IntersectionObserver(([entry]) => {
      const visible = entry?.isIntersecting ?? false;
      if (visible && !live) {
        live = true;
        if (!reduced) raf = requestAnimationFrame(loop);
      } else if (!visible && live) {
        live = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(wrap);
    if (!reduced) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
    };
  }, [graph, reduced]);

  return (
    <div
      ref={wrapRef}
      className="relative aspect-[7/8] w-full overflow-hidden rounded-sm border rule-hair bg-surface sm:aspect-[12/5]"
      data-constellation
    >
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      {graph.nodes.map((n) => (
        <Link
          key={n.id}
          href={n.href}
          onMouseEnter={() => (hoverRef.current = n.id)}
          onMouseLeave={() => (hoverRef.current = null)}
          onFocus={() => (hoverRef.current = n.id)}
          onBlur={() => (hoverRef.current = null)}
          className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        >
          <span
            className={`mx-auto block rounded-full border ${
              n.type === "paper"
                ? "h-3 w-3 border-q0 bg-q0/30"
                : n.type === "learn"
                  ? "h-2.5 w-2.5 border-q0 bg-q1/30"
                  : "h-2 w-2 border-q1 bg-q1/20"
            } transition-transform group-hover:scale-150 group-focus-visible:scale-150`}
          />
          <span className="mt-1.5 block max-w-28 font-serif text-xs leading-snug text-ink underline-offset-2 group-hover:underline sm:max-w-40 sm:text-sm">
            {n.label}
          </span>
          <span className="block font-mono text-[10px] text-muted">{n.sub}</span>
        </Link>
      ))}
    </div>
  );
}
