"use client";

import { useEffect, useRef, useState } from "react";
import { cnot01, expZ, ry, zeroState } from "./statevector";

const N = 8; // input grid
const CELL = 26;
const OUT_CELL = 13;

/**
 * Interactive quanvolution (from the thesis): draw on an 8×8 grid; a 2×2 quantum
 * filter sweeps it. Each patch's 4 pixels drive RY encodings on 2 qubits (2 layers),
 * entangled by CNOT — the 4 output channels are ⟨Z⟩ readouts under 4 fixed filters.
 */
export function QuanvolutionDemo() {
  const [grid, setGrid] = useState<number[]>(() => {
    const g = new Array<number>(N * N).fill(0);
    // seed: a small "7" so the demo isn't blank
    for (let c = 1; c < 7; c++) g[1 * N + c] = 1;
    for (let i = 0; i < 5; i++) g[(2 + i) * N + (6 - i)] = 1;
    return g;
  });
  const drawing = useRef<0 | 1 | null>(null);

  useEffect(() => {
    const up = () => (drawing.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  function paint(i: number, start = false) {
    setGrid((g) => {
      if (start) drawing.current = g[i] ? 0 : 1;
      if (drawing.current === null) return g;
      if (g[i] === drawing.current) return g;
      const next = [...g];
      next[i] = drawing.current;
      return next;
    });
  }

  // 4 filter channels: fixed rotation offsets (deterministic, no randomness)
  const FILTERS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

  function quanv(patch: [number, number, number, number], offset: number): number {
    let s = zeroState();
    s = ry(s, 0, patch[0] * Math.PI + offset);
    s = ry(s, 1, patch[1] * Math.PI + offset);
    s = cnot01(s);
    s = ry(s, 0, patch[2] * Math.PI);
    s = ry(s, 1, patch[3] * Math.PI);
    s = cnot01(s);
    return expZ(s, 1); // −1 … +1
  }

  const OUT = N / 2;
  const maps: number[][] = FILTERS.map((offset) => {
    const m: number[] = [];
    for (let r = 0; r < OUT; r++) {
      for (let c = 0; c < OUT; c++) {
        const p: [number, number, number, number] = [
          grid[2 * r * N + 2 * c]!,
          grid[2 * r * N + 2 * c + 1]!,
          grid[(2 * r + 1) * N + 2 * c]!,
          grid[(2 * r + 1) * N + 2 * c + 1]!,
        ];
        m.push(quanv(p, offset));
      }
    }
    return m;
  });

  return (
    <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-start">
      {/* input grid */}
      <div>
        <div
          className="grid touch-none select-none gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${N}, ${CELL}px)` }}
          role="img"
          aria-label="Drawable 8 by 8 pixel grid feeding the quantum filter"
        >
          {grid.map((v, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onPointerDown={(e) => {
                e.preventDefault();
                paint(i, true);
              }}
              onPointerEnter={() => paint(i)}
              className="rounded-[2px] border rule-hair transition-colors"
              style={{
                width: CELL,
                height: CELL,
                background: v ? "var(--color-ink)" : "var(--color-surface)",
              }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-muted">draw here — 8×8 input</p>
      </div>

      {/* 4 feature maps */}
      <div>
        <div className="flex flex-wrap gap-5">
          {maps.map((m, k) => (
            <div key={k}>
              <div
                className="grid gap-[2px]"
                style={{ gridTemplateColumns: `repeat(${OUT}, ${OUT_CELL}px)` }}
              >
                {m.map((v, i) => {
                  // −1 → q1 violet, +1 → q0 teal
                  const t = (v + 1) / 2;
                  return (
                    <div
                      key={i}
                      style={{
                        width: OUT_CELL,
                        height: OUT_CELL,
                        borderRadius: 2,
                        background: `color-mix(in srgb, var(--color-q0) ${Math.round(t * 100)}%, var(--color-q1))`,
                        opacity: 0.35 + 0.65 * Math.abs(v),
                      }}
                    />
                  );
                })}
              </div>
              <p className="mt-1.5 text-center font-mono text-[10px] text-muted">
                ch{k} · φ={FILTERS[k]!.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 max-w-sm font-mono text-xs leading-relaxed text-muted">
          each 2×2 patch → RY encodings on 2 qubits, entangled by CNOT → four ⟨Z⟩ readout
          channels. The same statevector engine that trains the hero.
        </p>
      </div>
    </div>
  );
}
