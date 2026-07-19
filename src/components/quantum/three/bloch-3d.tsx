"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { BlochSvg } from "@/components/quantum/bloch-svg";
import type { BlochTarget } from "./bloch-stage";

// The only import path that pulls three.js — route-scoped per ADR-0006.
// The parent reserves the height (zero CLS); the loading placeholder just fills
// the reserved box while the three.js chunk fetches, instead of a blank gap.
const BlochStage = dynamic(() => import("./bloch-stage"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[240px] w-full items-center justify-center font-mono text-xs text-muted" aria-hidden>
      rendering the Bloch sphere …
    </div>
  ),
});

const REDUCED_MQ = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_MQ);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_MQ).matches,
    () => true, // server: assume reduced → SVG in the HTML
  );
}

let webglCache: boolean | null = null;
function cachedWebgl(): boolean {
  if (webglCache === null) webglCache = webglAvailable();
  return webglCache;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Fallback ladder (ADR-0006): WebGL stage → SVG Bloch figures.
 * SVG renders in SSR/first paint (zero CLS: fixed height), 3D swaps in when safe.
 * `onDrag` (ADR-0017) makes a single-qubit arrow draggable — desktop only, so
 * touch scrolling is never hijacked; the SVG fallback keeps the lesson sliders.
 */
export function Bloch3D({
  targets,
  height = 300,
  onDrag,
}: {
  targets: BlochTarget[];
  height?: number;
  onDrag?: (theta: number, phi: number) => void;
}) {
  const reduced = usePrefersReducedMotion();
  // client-only constant; server snapshot false keeps SVG in SSR HTML
  const webgl = useSyncExternalStore(
    () => () => {},
    () => cachedWebgl(),
    () => false,
  );

  const use3d = !reduced && webgl;
  // pointer:fine gates both the (expensive) postprocessing and drag interaction —
  // on touch the stage stays display-only so vertical scroll keeps working
  const fine = use3d && typeof window !== "undefined" && matchMedia("(pointer: fine)").matches;
  const effects = fine;
  const interactive = fine;

  const colors =
    typeof window !== "undefined"
      ? (() => {
          const cs = getComputedStyle(document.documentElement);
          const v = (n: string) => cs.getPropertyValue(n).trim();
          return { q0: v("--color-q0"), q1: v("--color-q1"), muted: v("--color-muted") };
        })()
      : undefined;

  return (
    <div style={{ minHeight: height }} className="flex items-center justify-center">
      {use3d ? (
        <div className="w-full">
          <BlochStage targets={targets} effects={effects} height={height} colors={colors} interactive={interactive} onDrag={onDrag} />
        </div>
      ) : (
        <div className="flex gap-6">
          {targets.map((t, i) => (
            <BlochSvg key={i} x={t.x} z={t.z} label={t.label} size={targets.length > 1 ? 140 : 190} />
          ))}
        </div>
      )}
    </div>
  );
}
