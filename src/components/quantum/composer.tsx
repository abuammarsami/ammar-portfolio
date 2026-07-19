"use client";

import { useEffect, useMemo, useState } from "react";

import { BlochSvg } from "@/components/quantum/bloch-svg";
import { clampTheta, MAX_OPS, parseCircuit, runCircuit, serializeCircuit, type Gate, type Op } from "@/components/quantum/circuit";
import { blochVector, probabilities } from "@/components/quantum/statevector";
import { COMPOSER_SET_EVENT, publishComposerSnapshot } from "@/lib/agent/composer-bridge";

/**
 * The /playground circuit composer (plan-0006): tap gates onto two wires,
 * watch the exact statevector respond — probabilities, Bloch vectors, and a
 * shareable ?c= URL. Lazy island; agents drive it through composer-bridge.
 */

const GATE_LABEL: Record<Gate, string> = { h: "H", ry: "RY", rz: "RZ", cnot: "⊕" };
const BASIS = ["|00⟩", "|01⟩", "|10⟩", "|11⟩"] as const;

export function Composer() {
  // ?c= share links load in the initializer — this island is ssr:false, so
  // location exists at first render and no effect-time setState is needed
  const [ops, setOps] = useState<Op[]>(() => parseCircuit(new URLSearchParams(location.search).get("c") ?? "") ?? []);
  const [theta, setTheta] = useState(Math.PI / 4);
  const [copied, setCopied] = useState(false);

  // agent-driven circuits arrive through the composer bridge
  useEffect(() => {
    publishComposerSnapshot({ mounted: true });
    const onSet = (e: Event) => {
      const next = (e as CustomEvent<{ ops?: Op[] }>).detail?.ops;
      if (Array.isArray(next)) setOps(next.slice(0, MAX_OPS));
    };
    window.addEventListener(COMPOSER_SET_EVENT, onSet);
    return () => {
      window.removeEventListener(COMPOSER_SET_EVENT, onSet);
      publishComposerSnapshot({ mounted: false, ops: [] });
    };
  }, []);

  useEffect(() => {
    publishComposerSnapshot({ ops });
    const serialized = serializeCircuit(ops);
    history.replaceState(null, "", serialized ? `?c=${serialized}` : location.pathname);
  }, [ops]);

  const state = useMemo(() => runCircuit(ops), [ops]);
  const probs = probabilities(state);
  const bloch0 = blochVector(state, 0);
  const bloch1 = blochVector(state, 1);

  const add = (gate: Gate, q: 0 | 1) => {
    if (ops.length >= MAX_OPS) return;
    setOps([...ops, gate === "h" || gate === "cnot" ? { gate, q } : { gate, q, theta: clampTheta(theta) }]);
    setCopied(false);
  };
  const removeAt = (i: number) => setOps(ops.filter((_, j) => j !== i));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (permission / insecure context) — skip the confirmation, don't throw */
    }
  };

  return (
    <div className="rounded-sm border rule-hair bg-surface p-5">
      {/* ── gate palette ── */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        {([0, 1] as const).map((q) => (
          <div key={q} className="flex items-center gap-1.5">
            <span className="text-muted">q{q}:</span>
            {(["h", "ry", "rz"] as const).map((g) => (
              <button
                key={g}
                onClick={() => add(g, q)}
                className="border border-q0/50 px-2.5 py-1 text-q0 hover:bg-q0/10"
                aria-label={`Add ${GATE_LABEL[g]} gate on qubit ${q}`}
              >
                {GATE_LABEL[g]}
              </button>
            ))}
          </div>
        ))}
        <button
          onClick={() => add("cnot", 0)}
          className="border border-q1/50 px-2.5 py-1 text-q1 hover:bg-q1/10"
          aria-label="Add CNOT gate, control qubit 0, target qubit 1"
        >
          ⊕ CNOT
        </button>
        <label className="ml-2 flex items-center gap-2 text-muted">
          θ
          <input
            type="range"
            min={-Math.PI}
            max={Math.PI}
            step={0.01}
            value={theta}
            onChange={(e) => setTheta(Number(e.target.value))}
            className="w-28 accent-[var(--color-q0)]"
            aria-label="Rotation angle for RY/RZ gates"
          />
          <span className="w-12">{theta.toFixed(2)}</span>
        </label>
      </div>

      {/* ── the two wires ── */}
      <div className="mt-5 space-y-3 overflow-x-auto pb-1">
        {([0, 1] as const).map((wire) => (
          <div key={wire} className="flex min-w-max items-center gap-0 font-mono text-xs">
            <span className="w-12 shrink-0 text-muted">|0⟩ q{wire}</span>
            <div className="relative flex h-9 items-center">
              <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--color-muted)] opacity-40" aria-hidden />
              {ops.map((op, i) => {
                const onWire = op.gate === "cnot" || op.q === wire;
                return (
                  <div key={i} className="relative z-10 flex w-14 shrink-0 justify-center">
                    {onWire ? (
                      <button
                        onClick={() => removeAt(i)}
                        title="remove"
                        aria-label={`Remove ${GATE_LABEL[op.gate]} at step ${i + 1}`}
                        className={
                          op.gate === "cnot"
                            ? "px-1.5 py-1 text-q1 hover:opacity-60"
                            : "border border-q0/60 bg-bg px-1.5 py-1 text-q0 hover:opacity-60"
                        }
                      >
                        {op.gate === "cnot" ? (wire === 0 ? "●" : "⊕") : GATE_LABEL[op.gate]}
                        {op.theta !== undefined && <span className="text-muted">{op.theta.toFixed(1)}</span>}
                      </button>
                    ) : (
                      <span aria-hidden />
                    )}
                  </div>
                );
              })}
              {ops.length === 0 && <span className="z-10 bg-surface px-2 text-muted">tap gates above to build</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── live readout ── */}
      <div className="mt-6 flex flex-wrap items-start gap-8">
        <div className="w-full max-w-[240px] space-y-1.5 font-mono text-xs">
          {BASIS.map((b, i) => (
            <div key={b} className="flex items-center gap-2">
              <span className="w-9 text-muted">{b}</span>
              <div className="h-2.5 flex-1 rounded-sm bg-bg">
                <div
                  className="h-full rounded-sm transition-[width] duration-200"
                  style={{ width: `${(probs[i]! * 100).toFixed(1)}%`, background: i % 3 === 0 ? "var(--color-q0)" : "var(--color-q1)" }}
                />
              </div>
              <span className="w-11 text-right text-muted">{(probs[i]! * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <BlochSvg x={bloch0.x} z={bloch0.z} label="q0" size={120} />
          <BlochSvg x={bloch1.x} z={bloch1.z} label="q1" size={120} />
        </div>
      </div>

      {/* ── actions ── */}
      <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs">
        <button onClick={share} disabled={ops.length === 0} className="border border-q0/60 px-3 py-1.5 text-q0 hover:bg-q0/10 disabled:opacity-40">
          {copied ? "link copied ✓" : "⧉ share this circuit"}
        </button>
        <button onClick={() => setOps([])} disabled={ops.length === 0} className="text-muted hover:text-ink disabled:opacity-40">
          clear
        </button>
        <button
          onClick={() => setOps(parseCircuit("h0_cx") ?? [])}
          className="text-q1 hover:underline"
        >
          try a Bell pair →
        </button>
        <span className="ml-auto text-muted">
          {ops.length}/{MAX_OPS} gates
        </span>
      </div>
    </div>
  );
}
