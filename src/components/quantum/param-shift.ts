/**
 * Parameter-shift rule, made watchable (ADR-0017, plan-0008 §3 item 15).
 *
 * Pure orchestration over the tested statevector engine (ADR-0006 §3): every
 * ⟨Z⟩ here comes from `classify` — no gate math is reimplemented. The exact
 * gradient of a variational circuit's ⟨Z⟩ with respect to one rotation angle is
 *
 *     ∂⟨Z⟩/∂θ_k = [ ⟨Z⟩(θ_k + π/2) − ⟨Z⟩(θ_k − π/2) ] / 2
 *
 * — no finite-difference step size, no approximation. `shiftGradient` returns
 * the two shifted evaluations *and* the gradient so the UI can draw both.
 */

import { classify, type Params } from "./statevector";

export const HALF_PI = Math.PI / 2;

/** ⟨Z⟩ of the classifier for input `x` with parameter `k` overridden to `value`. */
export function expZAt(x: number, p: Params, k: number, value: number): number {
  const q = [...p] as Params;
  q[k] = value;
  return classify(x, q);
}

export type ShiftReadout = {
  /** the parameter's current value */
  theta: number;
  /** ⟨Z⟩ at the current θ_k */
  center: number;
  /** ⟨Z⟩ at θ_k + π/2 */
  plus: number;
  /** ⟨Z⟩ at θ_k − π/2 */
  minus: number;
  /** the exact parameter-shift gradient (plus − minus) / 2 */
  gradient: number;
};

/** The two ±π/2 evaluations and the exact gradient for parameter `k`. */
export function shiftGradient(x: number, p: Params, k: number): ShiftReadout {
  const theta = p[k]!;
  const plus = expZAt(x, p, k, theta + HALF_PI);
  const minus = expZAt(x, p, k, theta - HALF_PI);
  return { theta, center: classify(x, p), plus, minus, gradient: (plus - minus) / 2 };
}

export type CurvePoint = { theta: number; z: number };

/**
 * Sample ⟨Z⟩(θ_k) across `[from, to]` at `n+1` points — the curve the tangent
 * touches. ⟨Z⟩ is 2π-periodic in a single rotation angle, so over the default
 * `[0, 2π]` the endpoints meet; a widget can widen the domain past the ends so
 * the θ±π/2 markers never wrap off the plot.
 */
export function sweep(x: number, p: Params, k: number, n = 96, from = 0, to = 2 * Math.PI): CurvePoint[] {
  const out: CurvePoint[] = [];
  for (let i = 0; i <= n; i++) {
    const theta = from + (i / n) * (to - from);
    out.push({ theta, z: expZAt(x, p, k, theta) });
  }
  return out;
}

/**
 * One descent step on θ_k that *minimizes* ⟨Z⟩ — follow the negative gradient.
 * Following it repeatedly walks the dial into the curve's trough, which is the
 * whole point: it proves the parameter-shift number is a real slope.
 */
export function descendStep(x: number, p: Params, k: number, lr: number): Params {
  const { gradient } = shiftGradient(x, p, k);
  const q = [...p] as Params;
  q[k] = q[k]! - lr * gradient;
  return q;
}
