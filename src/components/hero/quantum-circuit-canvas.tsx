"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  blochVector,
  classify,
  finalState,
  loss,
  trainStep,
  type Params,
  type Sample,
} from "@/components/quantum/statevector";
import { CircuitStatic } from "./circuit-static";

const INITIAL_DATA: Sample[] = [
  { x: Math.PI / 4, y: 1 },
  { x: -Math.PI / 4, y: -1 },
];
/* draggable number-line geometry */
const LINE_X0 = 60;
const LINE_X1 = 380;
const LINE_Y = 258;
const X_MIN = -Math.PI / 2;
const X_MAX = Math.PI / 2;
const xToPx = (x: number) => LINE_X0 + ((x - X_MIN) / (X_MAX - X_MIN)) * (LINE_X1 - LINE_X0);
const pxToX = (px: number) => X_MIN + ((px - LINE_X0) / (LINE_X1 - LINE_X0)) * (X_MAX - X_MIN);
const LR = 0.12;
const MAX_EPOCH = 300;
const HOLD_FRAMES = 150;
/** Fixed init cycle — deterministic, no Math.random (each converges differently). */
const INITS: Params[] = [
  [5.8, 0.3, 4.9, 1.2],
  [2.4, 4.1, 0.6, 3.3],
  [1.1, 2.9, 5.2, 0.8],
];

const W = 560;
const H = 292;

type Colors = { bg: string; surface: string; ink: string; muted: string; q0: string; q1: string };

function readColors(el: HTMLElement): Colors {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  return {
    bg: v("--color-bg"),
    surface: v("--color-surface"),
    ink: v("--color-ink"),
    muted: v("--color-muted"),
    q0: v("--color-q0"),
    q1: v("--color-q1"),
  };
}

const REDUCED_MQ = "(prefers-reduced-motion: reduce)";

/** prefers-reduced-motion as an external store — no setState-in-effect. */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_MQ);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MQ).matches,
    () => false, // server snapshot
  );
}

export function QuantumCircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  const reduced = usePrefersReducedMotion();

  // mount the live canvas only after the browser is idle (ADR-0004)
  useEffect(() => {
    if (reduced) return;
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setLive(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => setLive(true), 300);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (!live || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const monoFamily =
      getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() ||
      "monospace";
    const mono = (px: number) => `${px}px ${monoFamily}`;

    // ── glow sprites: offscreen radial gradients, composited "lighter" (P6) ──
    const glowCache = new Map<string, HTMLCanvasElement>();
    function glowSprite(color: string): HTMLCanvasElement {
      let c = glowCache.get(color);
      if (c) return c;
      c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, color);
      grad.addColorStop(1, "transparent");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(color, c);
      return c;
    }
    function drawGlow(x: number, y: number, radius: number, color: string, alpha: number) {
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha;
      ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    let frameCount = 0;
    const trails: { x: number; y: number }[][] = [[], []];

    // ── training state ──
    const data: Sample[] = INITIAL_DATA.map((d) => ({ ...d }));
    let initIdx = 0;
    let params: Params = INITS[0]!;
    let epoch = 0;
    let hold = 0;
    let lossHistory: number[] = [loss(data, params)];

    // ── draggable data points ──
    let dragging: number | null = null;
    const toCanvas = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const hitHandle = (p: { x: number; y: number }) =>
      data.findIndex((d) => Math.hypot(p.x - xToPx(d.x), p.y - LINE_Y) < 14);
    const onDown = (e: PointerEvent) => {
      const i = hitHandle(toCanvas(e));
      if (i >= 0) {
        dragging = i;
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
      }
    };
    const onMove = (e: PointerEvent) => {
      const p = toCanvas(e);
      if (dragging === null) {
        canvas.style.cursor = hitHandle(p) >= 0 ? "grab" : "default";
        return;
      }
      const clamped = Math.min(X_MAX, Math.max(X_MIN, pxToX(p.x)));
      data[dragging]!.x = clamped;
      // wake training: new data means a new optimization problem
      epoch = Math.min(epoch, MAX_EPOCH - 1);
      hold = 0;
      if (lossHistory.length > 240) lossHistory = lossHistory.slice(-240);
      canvas.style.cursor = "grabbing";
    };
    const onUp = () => {
      dragging = null;
      canvas.style.cursor = "default";
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    // ── rAF with IntersectionObserver pause ──
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && raf === 0) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function step() {
      if (dragging === null && (epoch >= MAX_EPOCH || (lossHistory.at(-1) ?? 1) < 1e-3)) {
        if (++hold > HOLD_FRAMES) {
          initIdx = (initIdx + 1) % INITS.length;
          params = INITS[initIdx]!;
          epoch = 0;
          hold = 0;
          lossHistory = [loss(data, params)];
        }
        return;
      }
      // one gradient step per frame ≈ 5s to convergence at 60fps — watchable
      params = trainStep(data, params, LR);
      epoch++;
      lossHistory.push(loss(data, params));
      if (lossHistory.length > 900) lossHistory = lossHistory.slice(-600);
    }

    function draw() {
      if (!ctx || !canvas) return;
      const col = readColors(canvas);
      ctx.clearRect(0, 0, W, H);

      const wireY = [46, 112] as const;

      // qubit labels + wires
      ctx.font = mono(12);
      ctx.fillStyle = col.muted;
      ctx.textAlign = "left";
      ctx.fillText("|0⟩", 0, wireY[0] + 4);
      ctx.fillText("|0⟩", 0, wireY[1] + 4);
      ctx.strokeStyle = col.muted;
      ctx.lineWidth = 1;
      for (const y of wireY) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(378, y);
        ctx.stroke();
      }

      // photon pulses: the circuit visibly "runs" while training (P6)
      if (hold === 0) {
        const pulseX = 30 + ((frameCount * 5) % 348);
        drawGlow(pulseX, wireY[0], 10, col.q0, 0.8);
        drawGlow(pulseX, wireY[1], 10, col.q1, 0.8);
      }

      // gate box helper
      const box = (x: number, y: number, label: string, value: number, accent: string) => {
        drawGlow(x + 22, y, 34, accent, 0.22);
        ctx.fillStyle = col.surface;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.3;
        ctx.fillRect(x, y - 18, 44, 36);
        ctx.strokeRect(x, y - 18, 44, 36);
        ctx.fillStyle = col.ink;
        ctx.font = mono(11);
        ctx.textAlign = "center";
        ctx.fillText(label, x + 22, y + 4);
        ctx.fillStyle = accent;
        ctx.font = mono(9);
        ctx.fillText(`θ=${value.toFixed(3)}`, x + 22, y + 31);
      };

      // layer 1: RY(θ0), RY(θ1) — q0 accent
      box(52, wireY[0], "RY", params[0], col.q0);
      box(52, wireY[1], "RY", params[1], col.q0);

      // CNOT — q1 accent
      ctx.strokeStyle = col.q1;
      ctx.fillStyle = col.q1;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(160, wireY[0]);
      ctx.lineTo(160, wireY[1]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(160, wireY[0], 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(160, wireY[1], 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(160, wireY[1] - 9);
      ctx.lineTo(160, wireY[1] + 9);
      ctx.stroke();

      // layer 2: RY(θ2), RY(θ3) — q1 accent
      box(210, wireY[0], "RY", params[2], col.q1);
      box(210, wireY[1], "RY", params[3], col.q1);

      // measurement boxes
      for (const y of wireY) {
        ctx.fillStyle = col.surface;
        ctx.strokeStyle = col.muted;
        ctx.lineWidth = 1;
        ctx.fillRect(320, y - 18, 40, 36);
        ctx.strokeRect(320, y - 18, 40, 36);
        ctx.strokeStyle = col.ink;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(340, y + 10, 12, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(340, y + 10);
        ctx.lineTo(349, y - 6);
        ctx.stroke();
      }

      // ── loss inset ──
      ctx.fillStyle = col.surface;
      ctx.strokeStyle = col.muted;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(420, 28, 130, 100);
      ctx.globalAlpha = 0.35;
      ctx.strokeRect(420, 28, 130, 100);
      ctx.globalAlpha = 1;
      const maxLoss = Math.max(...lossHistory, 0.001);
      const lossGrad = ctx.createLinearGradient(428, 0, 542, 0);
      lossGrad.addColorStop(0, col.q1);
      lossGrad.addColorStop(1, col.q0);
      ctx.strokeStyle = lossGrad;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const n = lossHistory.length;
      let lastPx = 428;
      let lastPy = 118;
      for (let i = 0; i < n; i++) {
        const px = 428 + (114 * i) / Math.max(n - 1, 1);
        const py = 38 + 80 * (1 - lossHistory[i]! / maxLoss);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
        lastPx = px;
        lastPy = py;
      }
      ctx.stroke();
      // soft area fill under the curve
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.lineTo(lastPx, 128);
      ctx.lineTo(428, 128);
      ctx.closePath();
      ctx.fillStyle = lossGrad;
      ctx.fill();
      ctx.restore();
      // glowing tip of descent
      drawGlow(lastPx, lastPy, 8, col.q0, 0.9);
      ctx.fillStyle = col.muted;
      ctx.font = mono(9);
      ctx.textAlign = "center";
      ctx.fillText(
        `loss ${(lossHistory.at(-1) ?? 0).toFixed(4)} · epoch ${epoch}/${MAX_EPOCH}`,
        485,
        143,
      );

      // ── Bloch projections (X–Z plane) for sample A ──
      const s = finalState(data[0]!.x, params);
      const bloch = [blochVector(s, 0), blochVector(s, 1)];
      const centers = [
        { cx: 90, accent: col.q0, label: "q0" },
        { cx: 200, accent: col.q1, label: "q1" },
      ];
      for (let k = 0; k < 2; k++) {
        const { cx, accent, label } = centers[k]!;
        const cy = 196;
        const r = 32;
        // rim-lit shell
        const rim = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
        rim.addColorStop(0, "transparent");
        rim.addColorStop(1, accent + "26"); // ~15% alpha hex
        ctx.fillStyle = rim;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = col.muted;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.3, r, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const b = bloch[k]!;
        const tipX = cx + b.x * r;
        const tipY = cy - b.z * r;
        // fading trail (P6)
        const tr = trails[k]!;
        tr.push({ x: tipX, y: tipY });
        if (tr.length > 22) tr.shift();
        for (let i = 1; i < tr.length; i++) {
          ctx.strokeStyle = accent;
          ctx.globalAlpha = (i / tr.length) * 0.3;
          ctx.beginPath();
          ctx.moveTo(tr[i - 1]!.x, tr[i - 1]!.y);
          ctx.lineTo(tr[i]!.x, tr[i]!.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
        drawGlow(tipX, tipY, 9, accent, 0.85);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(tipX, tipY, 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col.muted;
        ctx.font = mono(9);
        ctx.textAlign = "center";
        ctx.fillText(label, cx, cy + r + 12);
      }

      // ── draggable data number line ──
      ctx.strokeStyle = col.muted;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(LINE_X0, LINE_Y);
      ctx.lineTo(LINE_X1, LINE_Y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (let i = 0; i < data.length; i++) {
        const d = data[i]!;
        const hx = xToPx(d.x);
        const accent = d.y === 1 ? col.q0 : col.q1;
        const pred = classify(d.x, params);
        const correct = Math.sign(pred) === d.y && Math.abs(pred) > 0.5;
        drawGlow(hx, LINE_Y, 14, accent, 0.55);
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(hx, LINE_Y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(hx, LINE_Y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.font = mono(9);
        ctx.textAlign = "center";
        ctx.fillStyle = col.muted;
        ctx.fillText(`y=${d.y > 0 ? "+1" : "−1"}${correct ? " ✓" : ""}`, hx, LINE_Y + 24);
      }
      ctx.fillStyle = col.muted;
      ctx.font = mono(9);
      ctx.textAlign = "left";
      ctx.fillText("⇄ drag the points", LINE_X1 + 16, LINE_Y + 3);

      // caption
      ctx.fillStyle = col.muted;
      ctx.font = mono(10);
      ctx.textAlign = "left";
      ctx.fillText("Fig. 0 — variational classifier, live", 300, 196);
      ctx.fillText(`⟨Z₁⟩ = ${(lossHistory.at(-1) ?? 0) < 0.05 ? "converged ✓" : "training…"}`, 300, 212);
    }

    function frame() {
      raf = 0;
      if (!visible) return; // paused off-screen; IO restarts us
      frameCount++;
      step();
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, [live, reduced]);

  if (reduced || !live) {
    return (
      <div className="w-full max-w-xl" aria-hidden={false}>
        <CircuitStatic />
        {/* keep layout stable for the canvas swap */}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Interactive demo: a 2-qubit variational quantum classifier training by parameter-shift gradient descent. Drag the two data points on the number line and watch the circuit retrain — rotation angles update, the loss curve descends, and two Bloch vectors converge."
      className="w-full max-w-2xl touch-none select-none"
      style={{ aspectRatio: `${W} / ${H}` }}
    />
  );
}
