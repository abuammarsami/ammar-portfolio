"use client";

/**
 * The About signature flourish: renders the identity as a two-state quantum
 * system whose amplitudes "collapse" when the visitor measures it by choosing
 * a lens (applyLens → LENS_EVENT). Unmeasured visitors see the 1/√2 ⊗ 1/√2
 * superposition. Plain rAF interpolation — no motion dep, ~1 kB of JS — and
 * fixed-width tabular number slots so the animation can never shift layout.
 * Ket labels are site copy: content/about.md "## State vector" via getAbout().
 */

import { useEffect, useRef, useState } from "react";
import { LENS_EVENT, LENS_STORAGE_KEY, type Lens, currentLens, isLens } from "@/lib/agent/lens";
import {
  type Amplitudes,
  SUPERPOSITION,
  amplitudesForLens,
  easeOutCubic,
  formatAmplitude,
} from "./state-vector-logic";

const COLLAPSE_MS = 600;

/** The lens the visitor explicitly measured (persisted by applyLens), or null while unobserved. */
function measuredLens(): Lens | null {
  try {
    const v = localStorage.getItem(LENS_STORAGE_KEY);
    return isLens(v) ? v : null;
  } catch {
    return null; // storage unavailable — treat as unmeasured until an event fires
  }
}

export function StateVector({ kets }: { kets: readonly [string, string] }) {
  // SSR and first client render always show the superposition — no hydration mismatch.
  const [amps, setAmps] = useState<Amplitudes>(SUPERPOSITION);
  const ampsRef = useRef<Amplitudes>(SUPERPOSITION);
  const rafRef = useRef(0);

  useEffect(() => {
    const set = (v: Amplitudes) => {
      ampsRef.current = v;
      setAmps(v);
    };

    const show = (target: Amplitudes, animate: boolean) => {
      cancelAnimationFrame(rafRef.current);
      if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        set(target); // reduced motion: jump instantly, no collapse animation
        return;
      }
      const from = ampsRef.current;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / COLLAPSE_MS);
        const e = easeOutCubic(t);
        set({ a0: from.a0 + (target.a0 - from.a0) * e, a1: from.a1 + (target.a1 - from.a1) * e });
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    // A returning visitor's stored lens already measured the state — snap, don't dance.
    show(amplitudesForLens(measuredLens()), false);
    const onLens = () => show(amplitudesForLens(currentLens()), true);
    window.addEventListener(LENS_EVENT, onLens);
    return () => {
      window.removeEventListener(LENS_EVENT, onLens);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <p
      role="img"
      aria-label={`identity state vector: superposition of ${kets[0]} and ${kets[1]}, collapsing with the active lens`}
      className="mt-6 font-mono text-sm text-muted"
    >
      <span aria-hidden="true">
        <span className="text-ink">|ammar⟩</span>
        {" = "}
        <span className="inline-block w-[4ch] text-right tabular-nums">{formatAmplitude(amps.a0)}</span>
        {" "}
        <span className="text-q0">|{kets[0]}⟩</span>
        {" + "}
        <span className="inline-block w-[4ch] text-right tabular-nums">{formatAmplitude(amps.a1)}</span>
        {" "}
        <span className="text-q1">|{kets[1]}⟩</span>
      </span>
    </p>
  );
}
