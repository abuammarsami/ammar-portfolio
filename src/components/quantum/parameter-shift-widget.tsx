"use client";

import { useEffect, useMemo, useState } from "react";
import { HALF_PI, descendStep, shiftGradient, sweep } from "./param-shift";
import type { Params } from "./statevector";

/**
 * L5's stage: the parameter-shift rule made watchable (ADR-0017). Zero WebGL —
 * pure SVG/DOM over the tested `statevector` engine. Pick a dial, see ⟨Z⟩(θ),
 * the two θ±π/2 evaluations that define the gradient, the tangent whose slope
 * *is* that gradient, then let it descend into the trough.
 */

const X = 0.9; // a fixed encoded data point; the dials do the moving
const INITIAL: Params = [0.7, -1.2, 0.4, 2.1];
const LR = 0.35;

// plot geometry (SVG user units)
const W = 340;
const H = 200;
const PAD = { l: 34, r: 12, t: 14, b: 26 };
const THETA_MIN = -HALF_PI;
const THETA_MAX = 2 * Math.PI + HALF_PI;
const Z_MIN = -1.15;
const Z_MAX = 1.15;

const xOf = (theta: number) => PAD.l + ((theta - THETA_MIN) / (THETA_MAX - THETA_MIN)) * (W - PAD.l - PAD.r);
const yOf = (z: number) => PAD.t + ((Z_MAX - z) / (Z_MAX - Z_MIN)) * (H - PAD.t - PAD.b);

const sliderCls = "w-full accent-[var(--color-q0)] cursor-pointer";
const chip = (on: boolean) =>
  `rounded-sm border px-2 py-1 font-mono text-[11px] transition-colors ${
    on ? "border-q0 bg-surface text-q0" : "rule-hair text-muted hover:text-ink"
  }`;
const btnCls =
  "rounded-sm border rule-hair px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:border-q0 hover:text-q0 disabled:opacity-40 disabled:hover:border-[color:inherit] disabled:hover:text-muted";

export function ParameterShiftWidget() {
  const [params, setParams] = useState<Params>(INITIAL);
  const [k, setK] = useState(0);
  const [running, setRunning] = useState(false);

  const theta = params[k]!;
  const { center, plus, minus, gradient } = useMemo(() => shiftGradient(X, params, k), [params, k]);
  // widen the sampled domain past [0,2π] so the ±π/2 markers always sit on the curve
  const curve = useMemo(() => sweep(X, params, k, 120, THETA_MIN, THETA_MAX), [params, k]);
  const path = useMemo(
    () => curve.map((pt, i) => `${i === 0 ? "M" : "L"}${xOf(pt.theta).toFixed(1)} ${yOf(pt.z).toFixed(1)}`).join(" "),
    [curve],
  );

  // auto-descent: re-arms after each step (params change → effect re-runs) and
  // stops once the slope flattens. The stop/step happen in the async timeout
  // callback, never synchronously in the effect body.
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => {
      if (Math.abs(shiftGradient(X, params, k).gradient) < 1e-3) setRunning(false);
      else setParams((p) => descendStep(X, p, k, LR));
    }, 90);
    return () => clearTimeout(id);
  }, [running, params, k]);

  const setTheta = (v: number) => {
    setRunning(false);
    setParams((p) => {
      const q = [...p] as Params;
      q[k] = v;
      return q;
    });
  };

  // a short tangent segment at (θ, center) whose slope is the parameter-shift gradient
  const dθ = 1.1;
  const tangent = {
    x1: xOf(theta - dθ),
    y1: yOf(center - gradient * dθ),
    x2: xOf(theta + dθ),
    y2: yOf(center + gradient * dθ),
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: 380 }}
        role="img"
        aria-label={`Plot of expectation value Z against angle theta for parameter theta-${k}. At theta ${theta.toFixed(
          2,
        )}, Z(theta+pi/2) is ${plus.toFixed(2)}, Z(theta-pi/2) is ${minus.toFixed(
          2,
        )}, and the parameter-shift gradient is ${gradient.toFixed(2)}.`}
        className="font-mono"
      >
        {/* frame + zero baseline */}
        <line x1={PAD.l} y1={yOf(0)} x2={W - PAD.r} y2={yOf(0)} stroke="var(--color-muted)" strokeOpacity="0.35" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--color-muted)" strokeOpacity="0.35" />
        {/* θ ticks at 0, π, 2π */}
        {[0, Math.PI, 2 * Math.PI].map((t, i) => (
          <g key={t}>
            <line x1={xOf(t)} y1={H - PAD.b} x2={xOf(t)} y2={H - PAD.b + 3} stroke="var(--color-muted)" strokeOpacity="0.5" />
            <text x={xOf(t)} y={H - PAD.b + 14} textAnchor="middle" fontSize="9" fill="var(--color-muted)">
              {["0", "π", "2π"][i]}
            </text>
          </g>
        ))}
        <text x={PAD.l - 6} y={yOf(1) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">+1</text>
        <text x={PAD.l - 6} y={yOf(-1) + 3} textAnchor="end" fontSize="9" fill="var(--color-muted)">−1</text>

        {/* ⟨Z⟩(θ) curve */}
        <path d={path} fill="none" stroke="var(--color-muted)" strokeWidth="1.5" strokeOpacity="0.9" />

        {/* the two ±π/2 evaluations: drop-lines + dots */}
        {[
          { th: theta + HALF_PI, z: plus, c: "var(--color-q1)", label: "θ+π/2" },
          { th: theta - HALF_PI, z: minus, c: "var(--color-q0)", label: "θ−π/2" },
        ].map((m) => (
          <g key={m.label}>
            <line x1={xOf(m.th)} y1={yOf(m.z)} x2={xOf(m.th)} y2={yOf(0)} stroke={m.c} strokeWidth="1" strokeDasharray="2 2" strokeOpacity="0.7" />
            <circle cx={xOf(m.th)} cy={yOf(m.z)} r="3.5" fill={m.c} />
            <text x={xOf(m.th)} y={yOf(0) + 12} textAnchor="middle" fontSize="8.5" fill={m.c}>{m.label}</text>
          </g>
        ))}

        {/* tangent whose slope = parameter-shift gradient */}
        <line x1={tangent.x1} y1={tangent.y1} x2={tangent.x2} y2={tangent.y2} stroke="var(--color-q0)" strokeWidth="1.5" strokeOpacity="0.9" />
        {/* current operating point */}
        <line x1={xOf(theta)} y1={PAD.t} x2={xOf(theta)} y2={H - PAD.b} stroke="var(--color-ink)" strokeOpacity="0.25" />
        <circle cx={xOf(theta)} cy={yOf(center)} r="4.5" fill="var(--color-ink)" stroke="var(--color-q0)" strokeWidth="1.5" />
      </svg>

      {/* readout — the accessible source of truth */}
      <div className="grid w-full max-w-[360px] grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="rounded-sm border rule-hair px-2 py-1.5 text-center">
          <div className="text-q0">⟨Z⟩(θ−π/2)</div>
          <div className="text-ink">{minus.toFixed(3)}</div>
        </div>
        <div className="rounded-sm border rule-hair px-2 py-1.5 text-center">
          <div className="text-q1">⟨Z⟩(θ+π/2)</div>
          <div className="text-ink">{plus.toFixed(3)}</div>
        </div>
        <div className="rounded-sm border border-q0 bg-surface px-2 py-1.5 text-center">
          <div className="text-muted">∂⟨Z⟩/∂θ</div>
          <div className="text-q0">{gradient >= 0 ? "+" : ""}{gradient.toFixed(3)}</div>
        </div>
      </div>
      <p className="max-w-[360px] text-center font-mono text-[10.5px] text-muted">
        gradient = (⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)) / 2 — exact, no finite-difference step
      </p>

      {/* which dial */}
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span className="mr-1">dial</span>
        {[0, 1, 2, 3].map((i) => (
          <button key={i} type="button" className={chip(i === k)} onClick={() => { setRunning(false); setK(i); }}>
            θ{i}
          </button>
        ))}
      </div>

      <label className="block w-full max-w-[300px] font-mono text-xs text-muted">
        θ{k} = {theta.toFixed(2)}
        <input type="range" min={THETA_MIN} max={THETA_MAX} step="0.01" value={theta} onChange={(e) => setTheta(+e.target.value)} className={sliderCls} />
      </label>

      <div className="flex gap-2">
        <button type="button" className={btnCls} onClick={() => { setRunning(false); setParams((p) => descendStep(X, p, k, LR)); }}>
          descend ▸
        </button>
        <button type="button" className={btnCls} onClick={() => setRunning((r) => !r)}>
          {running ? "pause ⏸" : "run ▶"}
        </button>
        <button type="button" className={btnCls} onClick={() => { setRunning(false); setParams(INITIAL); }}>
          reset
        </button>
      </div>
    </div>
  );
}
