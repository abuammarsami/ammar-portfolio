/**
 * Static converged variational circuit — the hero placeholder AND the
 * prefers-reduced-motion state (ADR-0004). Phase 4 layers the live canvas
 * trainer on top of this exact frame.
 */
export function CircuitStatic() {
  return (
    <svg
      viewBox="0 0 560 200"
      role="img"
      aria-label="A trained 2-qubit variational quantum circuit: RY and RZ rotation gates with converged parameters, a CNOT entangling gate, and a descended loss curve."
      className="w-full max-w-xl"
    >
      {/* ── qubit wires ── */}
      <text x="0" y="52" className="fill-[var(--color-muted)]" fontSize="13" fontFamily="var(--font-mono)">
        |0⟩
      </text>
      <text x="0" y="122" className="fill-[var(--color-muted)]" fontSize="13" fontFamily="var(--font-mono)">
        |0⟩
      </text>
      <line x1="30" y1="48" x2="380" y2="48" stroke="var(--color-muted)" strokeWidth="1" />
      <line x1="30" y1="118" x2="380" y2="118" stroke="var(--color-muted)" strokeWidth="1" />

      {/* ── RY gates (θ converged) ── */}
      <g>
        <rect x="52" y="30" width="44" height="36" fill="var(--color-surface)" stroke="var(--color-q0)" strokeWidth="1.3" />
        <text x="74" y="52" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" className="fill-[var(--color-ink)]">
          RY
        </text>
        <text x="74" y="80" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className="fill-[var(--color-q0)]">
          θ=1.571
        </text>
      </g>
      <g>
        <rect x="52" y="100" width="44" height="36" fill="var(--color-surface)" stroke="var(--color-q0)" strokeWidth="1.3" />
        <text x="74" y="122" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" className="fill-[var(--color-ink)]">
          RY
        </text>
        <text x="74" y="150" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className="fill-[var(--color-q0)]">
          θ=0.785
        </text>
      </g>

      {/* ── CNOT ── */}
      <line x1="160" y1="48" x2="160" y2="118" stroke="var(--color-q1)" strokeWidth="1.4" />
      <circle cx="160" cy="48" r="4" fill="var(--color-q1)" />
      <circle cx="160" cy="118" r="9" fill="none" stroke="var(--color-q1)" strokeWidth="1.4" />
      <line x1="160" y1="109" x2="160" y2="127" stroke="var(--color-q1)" strokeWidth="1.4" />

      {/* ── RZ gates ── */}
      <g>
        <rect x="210" y="30" width="44" height="36" fill="var(--color-surface)" stroke="var(--color-q1)" strokeWidth="1.3" />
        <text x="232" y="52" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" className="fill-[var(--color-ink)]">
          RZ
        </text>
        <text x="232" y="80" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className="fill-[var(--color-q1)]">
          φ=0.393
        </text>
      </g>
      <g>
        <rect x="210" y="100" width="44" height="36" fill="var(--color-surface)" stroke="var(--color-q1)" strokeWidth="1.3" />
        <text x="232" y="122" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" className="fill-[var(--color-ink)]">
          RZ
        </text>
        <text x="232" y="150" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className="fill-[var(--color-q1)]">
          φ=1.178
        </text>
      </g>

      {/* ── measurement boxes ── */}
      <g>
        <rect x="320" y="30" width="40" height="36" fill="var(--color-surface)" stroke="var(--color-muted)" strokeWidth="1" />
        <path d="M 328 58 A 12 12 0 0 1 352 58" fill="none" stroke="var(--color-ink)" strokeWidth="1.2" />
        <line x1="340" y1="58" x2="349" y2="42" stroke="var(--color-ink)" strokeWidth="1.2" />
      </g>
      <g>
        <rect x="320" y="100" width="40" height="36" fill="var(--color-surface)" stroke="var(--color-muted)" strokeWidth="1" />
        <path d="M 328 128 A 12 12 0 0 1 352 128" fill="none" stroke="var(--color-ink)" strokeWidth="1.2" />
        <line x1="340" y1="128" x2="349" y2="112" stroke="var(--color-ink)" strokeWidth="1.2" />
      </g>

      {/* ── loss curve inset ── */}
      <g>
        <rect x="420" y="30" width="130" height="106" fill="var(--color-surface)" stroke="var(--color-muted)" strokeOpacity="0.35" strokeWidth="1" />
        <polyline
          points="430,45 445,60 458,80 470,95 485,105 500,112 515,117 530,120 540,121"
          fill="none"
          stroke="var(--color-q0)"
          strokeWidth="1.6"
        />
        <text x="485" y="152" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className="fill-[var(--color-muted)]">
          loss ↓ · epoch 400/400
        </text>
      </g>

      {/* caption */}
      <text x="190" y="190" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" className="fill-[var(--color-muted)]">
        Fig. 0 — variational classifier, converged
      </text>
    </svg>
  );
}
