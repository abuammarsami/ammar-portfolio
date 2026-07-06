"use client";

/**
 * SVG Bloch sphere (P4 baseline + permanent no-WebGL/reduced-motion fallback).
 * Renders a projected sphere, the state arrow (length = purity), pole labels.
 */
export function BlochSvg({
  x,
  z,
  label,
  size = 150,
}: {
  x: number;
  z: number;
  label?: string;
  size?: number;
}) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const tipX = cx + x * r;
  const tipY = cy - z * r;
  return (
    <svg
      width={size}
      height={size + 16}
      viewBox={`0 0 ${size} ${size + 16}`}
      role="img"
      aria-label={`Bloch sphere${label ? ` for ${label}` : ""}: arrow at x=${x.toFixed(2)}, z=${z.toFixed(2)}`}
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-muted)" strokeOpacity="0.45" />
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.3} fill="none" stroke="var(--color-muted)" strokeOpacity="0.3" />
      <text x={cx} y={cy - r - 6} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-q0)">|0⟩</text>
      <text x={cx} y={cy + r + 14} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-q1)">|1⟩</text>
      {/* arrow */}
      <line x1={cx} y1={cy} x2={tipX} y2={tipY} stroke="var(--color-q0)" strokeWidth="2" />
      <circle cx={tipX} cy={tipY} r="3.5" fill="var(--color-q0)" />
      {label && (
        <text x={cx} y={size + 12} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-muted)">
          {label}
        </text>
      )}
    </svg>
  );
}

/** Probability bars P(0)/P(1) — shared readout. */
export function ProbBars({ p0, p1 }: { p0: number; p1: number }) {
  return (
    <div className="w-full max-w-[220px] space-y-1.5 font-mono text-xs">
      {[
        { l: "P(0)", v: p0, c: "var(--color-q0)" },
        { l: "P(1)", v: p1, c: "var(--color-q1)" },
      ].map(({ l, v, c }) => (
        <div key={l} className="flex items-center gap-2">
          <span className="w-9 text-muted">{l}</span>
          <div className="h-2.5 flex-1 rounded-sm bg-bg">
            <div
              className="h-full rounded-sm transition-[width] duration-200"
              style={{ width: `${(v * 100).toFixed(1)}%`, background: c }}
            />
          </div>
          <span className="w-11 text-right text-muted">{(v * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}
