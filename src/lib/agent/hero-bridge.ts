/**
 * Bridge between the WebMCP tool surface and the hero's live quantum
 * classifier (ADR-0009). Dependency-free and DOM-optional so it stays
 * unit-testable: the canvas publishes snapshots in, agents send data out
 * via a CustomEvent. Physics remains exclusively in statevector.ts.
 */

export type HeroSnapshot = {
  mounted: boolean;
  epoch: number;
  loss: number;
  params: [number, number, number, number];
  data: { x: number; y: 1 | -1 }[];
};

export const HERO_SET_EVENT = "ammar:hero-set-data";

/** Data points live on [-π/2, π/2] — the hero's number line. */
export const HERO_X_MIN = -Math.PI / 2;
export const HERO_X_MAX = Math.PI / 2;

export function clampHeroX(x: number): number {
  if (Number.isNaN(x)) return 0;
  return Math.min(HERO_X_MAX, Math.max(HERO_X_MIN, x));
}

const snapshot: HeroSnapshot = { mounted: false, epoch: 0, loss: 1, params: [0, 0, 0, 0], data: [] };

export function publishHeroSnapshot(next: Partial<HeroSnapshot>): void {
  Object.assign(snapshot, next);
}

export function getHeroSnapshot(): HeroSnapshot {
  return { ...snapshot, params: [...snapshot.params], data: snapshot.data.map((d) => ({ ...d })) };
}

// Single-writer guard (plan-0005): a WebMCP agent and the autopilot tour must
// not fight over the hero's data points. Claims are transient and re-entrant
// per holder id; a competing holder is simply told to wait.
let heroWriter: string | null = null;

export function claimHeroWriter(who: string): boolean {
  if (heroWriter !== null && heroWriter !== who) return false;
  heroWriter = who;
  return true;
}

export function releaseHeroWriter(who: string): void {
  if (heroWriter === who) heroWriter = null;
}

/** Ask the hero to move its data points and retrain. No-op listener-side if unmounted. */
export function requestHeroData(
  x0?: number,
  x1?: number,
  target: EventTarget | undefined = typeof window === "undefined" ? undefined : window,
): void {
  if (!target) return;
  const detail: { x0?: number; x1?: number } = {};
  if (typeof x0 === "number") detail.x0 = clampHeroX(x0);
  if (typeof x1 === "number") detail.x1 = clampHeroX(x1);
  target.dispatchEvent(new CustomEvent(HERO_SET_EVENT, { detail }));
}
