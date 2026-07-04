"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import { BlochSvg } from "@/components/learn/bloch-svg";
import type { BlochTarget } from "./bloch-stage";

// The only import path that pulls three.js — route-scoped per ADR-0006.
const BlochStage = dynamic(() => import("./bloch-stage"), { ssr: false });

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
 */
export function Bloch3D({ targets, height = 300 }: { targets: BlochTarget[]; height?: number }) {
  const reduced = usePrefersReducedMotion();
  // client-only constant; server snapshot false keeps SVG in SSR HTML
  const webgl = useSyncExternalStore(
    () => () => {},
    () => cachedWebgl(),
    () => false,
  );

  const use3d = !reduced && webgl;
  const effects = use3d && typeof window !== "undefined" && matchMedia("(pointer: fine)").matches;

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
          <BlochStage targets={targets} effects={effects} height={height} colors={colors} />
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
