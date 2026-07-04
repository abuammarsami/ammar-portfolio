/**
 * Dependency-free 2-qubit statevector simulator (ADR-0004).
 *
 * State = 4 complex amplitudes indexed by b = (q0 << 1) | q1.
 * Everything here is exact linear algebra — the hero animation is a *real*
 * variational classifier trained with parameter-shift gradients, not a fake.
 */

export type Complex = { re: number; im: number };
export type State = [Complex, Complex, Complex, Complex];

const c = (re: number, im = 0): Complex => ({ re, im });

export function zeroState(): State {
  return [c(1), c(0), c(0), c(0)];
}

/** Apply a single-qubit gate [[a,b],[d,e]] to `qubit` (0 or 1). */
function applySingle(
  s: State,
  qubit: 0 | 1,
  a: Complex,
  b: Complex,
  d: Complex,
  e: Complex,
): State {
  const out = [c(0), c(0), c(0), c(0)] as State;
  const bit = qubit === 0 ? 2 : 1;
  for (let i = 0; i < 4; i++) {
    if (i & bit) continue; // handle each (|0⟩,|1⟩) pair once, from the 0 side
    const j = i | bit;
    const s0 = s[i]!;
    const s1 = s[j]!;
    out[i] = c(
      a.re * s0.re - a.im * s0.im + b.re * s1.re - b.im * s1.im,
      a.re * s0.im + a.im * s0.re + b.re * s1.im + b.im * s1.re,
    );
    out[j] = c(
      d.re * s0.re - d.im * s0.im + e.re * s1.re - e.im * s1.im,
      d.re * s0.im + d.im * s0.re + e.re * s1.im + e.im * s1.re,
    );
  }
  return out;
}

export function ry(s: State, qubit: 0 | 1, theta: number): State {
  const cos = Math.cos(theta / 2);
  const sin = Math.sin(theta / 2);
  return applySingle(s, qubit, c(cos), c(-sin), c(sin), c(cos));
}

export function rz(s: State, qubit: 0 | 1, phi: number): State {
  const cos = Math.cos(phi / 2);
  const sin = Math.sin(phi / 2);
  return applySingle(s, qubit, c(cos, -sin), c(0), c(0), c(cos, sin));
}

export function h(s: State, qubit: 0 | 1): State {
  const r = Math.SQRT1_2;
  return applySingle(s, qubit, c(r), c(r), c(r), c(-r));
}

/** CNOT with control=q0, target=q1 (indices 2↔3 swap). */
export function cnot01(s: State): State {
  return [s[0], s[1], s[3], s[2]];
}

/** ⟨Z⟩ on a qubit: +1 for |0⟩ component, −1 for |1⟩. */
export function expZ(s: State, qubit: 0 | 1): number {
  const bit = qubit === 0 ? 2 : 1;
  let e = 0;
  for (let i = 0; i < 4; i++) {
    const p = s[i]!.re * s[i]!.re + s[i]!.im * s[i]!.im;
    e += i & bit ? -p : p;
  }
  return e;
}

/** Bloch vector (⟨X⟩,⟨Y⟩,⟨Z⟩) of one qubit via the reduced density matrix. */
export function blochVector(s: State, qubit: 0 | 1): { x: number; y: number; z: number } {
  const bit = qubit === 0 ? 2 : 1;
  // ρ01 = Σ_other a_(qubit=0,other) · conj(a_(qubit=1,other))
  let re01 = 0;
  let im01 = 0;
  for (let i = 0; i < 4; i++) {
    if (i & bit) continue;
    const j = i | bit;
    const a0 = s[i]!;
    const a1 = s[j]!;
    re01 += a0.re * a1.re + a0.im * a1.im;
    im01 += a0.im * a1.re - a0.re * a1.im;
  }
  return { x: 2 * re01, y: -2 * im01, z: expZ(s, qubit) };
}

// ─────────────────────────────────────────────── variational classifier ──

export type Params = [number, number, number, number];

/**
 * Circuit: RY(x) feature map on both qubits → RY(θ0) q0, RY(θ1) q1 →
 * CNOT(0→1) → RY(θ2) q0, RY(θ3) q1 → measure ⟨Z⟩ on q1.
 */
export function classify(x: number, p: Params): number {
  let s = zeroState();
  s = ry(s, 0, x);
  s = ry(s, 1, x);
  s = ry(s, 0, p[0]);
  s = ry(s, 1, p[1]);
  s = cnot01(s);
  s = ry(s, 0, p[2]);
  s = ry(s, 1, p[3]);
  return expZ(s, 1);
}

/** Final state for a sample (for Bloch visualization). */
export function finalState(x: number, p: Params): State {
  let s = zeroState();
  s = ry(s, 0, x);
  s = ry(s, 1, x);
  s = ry(s, 0, p[0]);
  s = ry(s, 1, p[1]);
  s = cnot01(s);
  s = ry(s, 0, p[2]);
  s = ry(s, 1, p[3]);
  return s;
}

export type Sample = { x: number; y: 1 | -1 };

/** MSE loss over the dataset. */
export function loss(data: Sample[], p: Params): number {
  let l = 0;
  for (const d of data) {
    const err = classify(d.x, p) - d.y;
    l += err * err;
  }
  return l / data.length;
}

/**
 * Exact parameter-shift gradient: ∂⟨Z⟩/∂θ = (⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)) / 2,
 * chained through the MSE.
 */
export function gradient(data: Sample[], p: Params): Params {
  const g: Params = [0, 0, 0, 0];
  for (const d of data) {
    const pred = classify(d.x, p);
    const dLdPred = (2 * (pred - d.y)) / data.length;
    for (let k = 0; k < 4; k++) {
      const plus = [...p] as Params;
      const minus = [...p] as Params;
      plus[k] = plus[k]! + Math.PI / 2;
      minus[k] = minus[k]! - Math.PI / 2;
      g[k] = g[k]! + (dLdPred * (classify(d.x, plus) - classify(d.x, minus))) / 2;
    }
  }
  return g;
}

/** One gradient-descent step; returns new params (pure). */
export function trainStep(data: Sample[], p: Params, lr: number): Params {
  const g = gradient(data, p);
  return [p[0] - lr * g[0], p[1] - lr * g[1], p[2] - lr * g[2], p[3] - lr * g[3]];
}
