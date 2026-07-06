"use client";

import { useState } from "react";
import { QuantumCircuitCanvas } from "@/components/hero/quantum-circuit-canvas";
import { mulberry32 } from "@/components/quantum/qml";
import { QuanvolutionDemo } from "@/components/quantum/quanvolution-demo";
import {
  blochVector,
  cnot01,
  collapseZ,
  expZZ,
  h,
  probabilities,
  probZ,
  ry,
  rz,
  zeroState,
  type State,
} from "@/components/quantum/statevector";
import { Bloch3D } from "@/components/quantum/three/bloch-3d";
import { ProbBars } from "@/components/quantum/bloch-svg";

const sliderCls =
  "w-full accent-[var(--color-q0)] cursor-pointer";
const btnCls =
  "rounded-sm border rule-hair px-3 py-1.5 font-mono text-xs text-ink transition-colors hover:border-q0 hover:text-q0";

/** L1 — the qubit: θ/φ sliders → arrow + amplitudes + P bars. */
export function QubitLesson() {
  const [theta, setTheta] = useState(0.9);
  const [phi, setPhi] = useState(0.6);
  const s = rz(ry(zeroState(), 0, theta), 0, phi);
  const b = blochVector(s, 0);
  const { p0, p1 } = probZ(s, 0);
  const alpha = Math.cos(theta / 2);
  const beta = Math.sin(theta / 2);
  return (
    <div className="flex flex-col items-center gap-4">
      <Bloch3D targets={[{ x: b.x, y: b.y, z: b.z, accent: "q0" }]} height={260} />
      <ProbBars p0={p0} p1={p1} />
      <p className="font-mono text-xs text-muted">
        α={alpha.toFixed(3)} · |β|={beta.toFixed(3)} · state = α|0⟩ + βe<sup>iφ</sup>|1⟩
      </p>
      <label className="block w-full max-w-[240px] font-mono text-xs text-muted">
        θ tilt = {theta.toFixed(2)}
        <input type="range" min="0" max={Math.PI} step="0.01" value={theta}
          onChange={(e) => setTheta(+e.target.value)} className={sliderCls} />
      </label>
      <label className="block w-full max-w-[240px] font-mono text-xs text-muted">
        φ spin = {phi.toFixed(2)}
        <input type="range" min="0" max={2 * Math.PI} step="0.01" value={phi}
          onChange={(e) => setPhi(+e.target.value)} className={sliderCls} />
      </label>
    </div>
  );
}

/** L2 — superposition: H button + phase slider; bars freeze while arrow spins. */
export function SuperpositionLesson() {
  const [hApplied, setHApplied] = useState(false);
  const [phase, setPhase] = useState(0);
  let s = zeroState();
  if (hApplied) s = rz(h(s, 0), 0, phase);
  const b = blochVector(s, 0);
  const { p0, p1 } = probZ(s, 0);
  return (
    <div className="flex flex-col items-center gap-4">
      <Bloch3D targets={[{ x: b.x, y: b.y, z: b.z, accent: "q0" }]} height={260} />
      <ProbBars p0={p0} p1={p1} />
      <div className="flex gap-2">
        <button type="button" className={btnCls} onClick={() => setHApplied(true)} disabled={hApplied}>
          apply H
        </button>
        <button type="button" className={btnCls} onClick={() => { setHApplied(false); setPhase(0); }}>
          reset
        </button>
      </div>
      <label className="block w-full max-w-[240px] font-mono text-xs text-muted">
        phase φ = {phase.toFixed(2)} {hApplied ? "(bars don't move!)" : "(apply H first)"}
        <input type="range" min="0" max={2 * Math.PI} step="0.01" value={phase} disabled={!hApplied}
          onChange={(e) => setPhase(+e.target.value)} className={sliderCls} />
      </label>
    </div>
  );
}

/** L3 — entanglement: build the Bell state; arrows shrink, ⟨Z⊗Z⟩ climbs. */
export function EntanglementLesson() {
  const [gates, setGates] = useState<("h" | "cnot")[]>([]);
  let s = zeroState();
  for (const g of gates) s = g === "h" ? h(s, 0) : cnot01(s);
  const b0 = blochVector(s, 0);
  const b1 = blochVector(s, 1);
  const zz = expZZ(s);
  const p = probabilities(s);
  return (
    <div className="flex flex-col items-center gap-4">
      <Bloch3D
        targets={[
          { x: b0.x, y: b0.y, z: b0.z, accent: "q0", label: "q0" },
          { x: b1.x, y: b1.y, z: b1.z, accent: "q1", label: "q1" },
        ]}
        height={240}
      />
      <p className="font-mono text-xs text-muted">
        ⟨Z⊗Z⟩ = <span className="text-q0">{zz.toFixed(3)}</span>
        {zz > 0.99 && gates.includes("h") && " — perfectly correlated ✓"}
      </p>
      <div className="flex w-full max-w-[260px] gap-1.5 font-mono text-[10px] text-muted">
        {(["00", "01", "10", "11"] as const).map((k, i) => (
          <div key={k} className="flex-1 text-center">
            <div className="flex h-16 items-end rounded-sm bg-bg">
              <div className="w-full rounded-sm transition-[height] duration-300"
                style={{ height: `${p[i]! * 100}%`, background: i === 0 || i === 3 ? "var(--color-q0)" : "var(--color-q1)" }} />
            </div>
            |{k}⟩
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className={btnCls} onClick={() => setGates((g) => [...g, "h"])}>H on q0</button>
        <button type="button" className={btnCls} onClick={() => setGates((g) => [...g, "cnot"])}>CNOT</button>
        <button type="button" className={btnCls} onClick={() => setGates([])}>reset</button>
      </div>
    </div>
  );
}

/** L4 — measurement: prepare, then hammer measure; tally accretes toward theory. */
export function MeasurementLesson() {
  const [theta, setTheta] = useState(1.1);
  const [tally, setTally] = useState<[number, number]>([0, 0]);
  const [lastState, setLastState] = useState<State | null>(null);
  const [rng] = useState(() => mulberry32(7));
  const prepared = ry(zeroState(), 0, theta);
  const { p1 } = probZ(prepared, 0);
  const shown = lastState ?? prepared;
  const b = blochVector(shown, 0);
  const shots = tally[0] + tally[1];
  function measure() {
    const outcome = rng() < p1 ? 1 : 0;
    setLastState(collapseZ(prepared, 0, outcome));
    setTally(([a, c]) => (outcome === 0 ? [a + 1, c] : [a, c + 1]));
  }
  return (
    <div className="flex flex-col items-center gap-4">
      <Bloch3D targets={[{ x: b.x, y: b.y, z: b.z, accent: "q0" }]} height={260} />
      <label className="block w-full max-w-[240px] font-mono text-xs text-muted">
        prepare: θ = {theta.toFixed(2)} (P(1) = {(p1 * 100).toFixed(0)}%)
        <input type="range" min="0" max={Math.PI} step="0.01" value={theta}
          onChange={(e) => { setTheta(+e.target.value); setLastState(null); setTally([0, 0]); }}
          className={sliderCls} />
      </label>
      <div className="flex gap-2">
        <button type="button" className={btnCls} onClick={measure}>measure ⚡</button>
        <button type="button" className={btnCls} onClick={() => { setLastState(null); setTally([0, 0]); }}>reset</button>
      </div>
      <div className="w-full max-w-[240px] font-mono text-xs text-muted">
        <p>shots: {shots}{shots > 0 && ` → got 0: ${tally[0]} · got 1: ${tally[1]}`}</p>
        {shots > 0 && (
          <p className="mt-1">
            observed P(1) ≈ {((tally[1] / shots) * 100).toFixed(0)}% · theory {(p1 * 100).toFixed(0)}%
          </p>
        )}
      </div>
    </div>
  );
}

/** L5/L6 reuse the site's existing interactives — same engine, already tested. */
export function VariationalLesson() {
  return <QuantumCircuitCanvas />;
}
export function QuanvolutionLesson() {
  return <QuanvolutionDemo />;
}

export const LESSON_COMPONENTS = [
  QubitLesson,
  SuperpositionLesson,
  EntanglementLesson,
  MeasurementLesson,
  VariationalLesson,
  QuanvolutionLesson,
] as const;
