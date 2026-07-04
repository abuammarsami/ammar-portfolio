"use client";

import { useEffect, useRef, useState } from "react";
import {
  blochVector,
  finalState,
  loss,
  trainStep,
  type Params,
  type Sample,
} from "@/components/quantum/statevector";
import { CircuitStatic } from "./circuit-static";

const DATA: Sample[] = [
  { x: Math.PI / 4, y: 1 },
  { x: -Math.PI / 4, y: -1 },
];
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
const H = 240;

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

export function QuantumCircuitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [live, setLive] = useState(false);
  const [reduced, setReduced] = useState(false);

  // prefers-reduced-motion → stay on the static converged frame
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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

    // ── training state ──
    let initIdx = 0;
    let params: Params = INITS[0]!;
    let epoch = 0;
    let hold = 0;
    let lossHistory: number[] = [loss(DATA, params)];

    // ── rAF with IntersectionObserver pause ──
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible && raf === 0) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    function step() {
      if (epoch >= MAX_EPOCH || (lossHistory.at(-1) ?? 1) < 1e-3) {
        if (++hold > HOLD_FRAMES) {
          initIdx = (initIdx + 1) % INITS.length;
          params = INITS[initIdx]!;
          epoch = 0;
          hold = 0;
          lossHistory = [loss(DATA, params)];
        }
        return;
      }
      // one gradient step per frame ≈ 5s to convergence at 60fps — watchable
      params = trainStep(DATA, params, LR);
      epoch++;
      lossHistory.push(loss(DATA, params));
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

      // gate box helper
      const box = (x: number, y: number, label: string, value: number, accent: string) => {
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
      ctx.strokeStyle = col.q0;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const n = lossHistory.length;
      for (let i = 0; i < n; i++) {
        const px = 428 + (114 * i) / Math.max(n - 1, 1);
        const py = 38 + 80 * (1 - lossHistory[i]! / maxLoss);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = col.muted;
      ctx.font = mono(9);
      ctx.textAlign = "center";
      ctx.fillText(
        `loss ${(lossHistory.at(-1) ?? 0).toFixed(4)} · epoch ${epoch}/${MAX_EPOCH}`,
        485,
        143,
      );

      // ── Bloch projections (X–Z plane) for sample A ──
      const s = finalState(DATA[0]!.x, params);
      const bloch = [blochVector(s, 0), blochVector(s, 1)];
      const centers = [
        { cx: 90, accent: col.q0, label: "q0" },
        { cx: 200, accent: col.q1, label: "q1" },
      ];
      for (let k = 0; k < 2; k++) {
        const { cx, accent, label } = centers[k]!;
        const cy = 196;
        const r = 26;
        ctx.strokeStyle = col.muted;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        const b = bloch[k]!;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + b.x * r, cy - b.z * r);
        ctx.stroke();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(cx + b.x * r, cy - b.z * r, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col.muted;
        ctx.font = mono(9);
        ctx.textAlign = "center";
        ctx.fillText(label, cx, cy + r + 12);
      }

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
      step();
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
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
      aria-label="Live demo: a 2-qubit variational quantum classifier training by parameter-shift gradient descent — rotation angles update, the loss curve descends, and two Bloch vectors converge."
      className="w-full max-w-xl"
      style={{ aspectRatio: `${W} / ${H}` }}
    />
  );
}
