import { cnot01, h, ry, rz, zeroState, type State } from "./statevector";

/**
 * Circuit-as-data over the statevector simulator (plan-0006, /playground).
 * Dependency-free and pure (rule 9): ops are plain data, running is a fold,
 * and circuits round-trip through a compact URL grammar for share links:
 *
 *   h0_ry1:0.7854_cx  →  H on q0, RY(π/4) on q1, CNOT(control q0 → target q1)
 *
 * parse never throws — a malformed string is null, never a crash.
 */

export type Gate = "h" | "ry" | "rz" | "cnot";
export type Op = { gate: Gate; q: 0 | 1; theta?: number };

export const MAX_OPS = 16;
export const THETA_MAX = Math.PI;

export const clampTheta = (t: number): number => Math.max(-THETA_MAX, Math.min(THETA_MAX, t));

/** Apply one validated op. CNOT is fixed control q0 → target q1 (the sim's gate set). */
function applyOp(s: State, op: Op): State {
  switch (op.gate) {
    case "h":
      return h(s, op.q);
    case "ry":
      return ry(s, op.q, op.theta ?? 0);
    case "rz":
      return rz(s, op.q, op.theta ?? 0);
    case "cnot":
      return cnot01(s);
  }
}

export function runCircuit(ops: readonly Op[]): State {
  return ops.slice(0, MAX_OPS).reduce(applyOp, zeroState());
}

/** `[{h,0},{ry,1,0.7854},{cnot}]` → "h0_ry1:0.7854_cx" */
export function serializeCircuit(ops: readonly Op[]): string {
  return ops
    .slice(0, MAX_OPS)
    .map((op) => {
      if (op.gate === "cnot") return "cx";
      // Number() re-parse normalizes "-0.0000" → "0" and strips trailing zeros
      const theta = op.gate === "h" ? "" : `:${Number(clampTheta(op.theta ?? 0).toFixed(4))}`;
      return `${op.gate}${op.q}${theta}`;
    })
    .join("_");
}

const TOKEN = /^(h([01])|(ry|rz)([01]):(-?\d+(?:\.\d+)?)|cx)$/;

/** Inverse of serializeCircuit. Null on anything off-grammar; never throws. */
export function parseCircuit(raw: unknown): Op[] | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 400) return null;
  const tokens = raw.split("_");
  if (tokens.length > MAX_OPS) return null;
  const ops: Op[] = [];
  for (const token of tokens) {
    const m = TOKEN.exec(token);
    if (!m) return null;
    if (token === "cx") {
      ops.push({ gate: "cnot", q: 0 });
    } else if (m[2] !== undefined) {
      ops.push({ gate: "h", q: Number(m[2]) as 0 | 1 });
    } else {
      const theta = clampTheta(Number(m[5]));
      if (!Number.isFinite(theta)) return null;
      ops.push({ gate: m[3] as "ry" | "rz", q: Number(m[4]) as 0 | 1, theta });
    }
  }
  return ops;
}

/** Human-readable step list for tool output and captions. */
export function describeCircuit(ops: readonly Op[]): string {
  if (ops.length === 0) return "empty circuit (|00⟩)";
  return ops
    .map((op) =>
      op.gate === "cnot" ? "CNOT(q0→q1)" : `${op.gate.toUpperCase()}${op.theta !== undefined ? `(${op.theta.toFixed(3)})` : ""} q${op.q}`,
    )
    .join(" · ");
}
