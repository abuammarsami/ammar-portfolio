import { describe, expect, it } from "vitest";
import {
  clampHeroX,
  getHeroSnapshot,
  HERO_SET_EVENT,
  HERO_X_MAX,
  HERO_X_MIN,
  publishHeroSnapshot,
  requestHeroData,
} from "./hero-bridge";

describe("clampHeroX", () => {
  it("clamps to the hero number line [-π/2, π/2]", () => {
    expect(clampHeroX(99)).toBe(HERO_X_MAX);
    expect(clampHeroX(-99)).toBe(HERO_X_MIN);
    expect(clampHeroX(0.5)).toBe(0.5);
    expect(clampHeroX(NaN)).toBe(0);
  });
});

describe("requestHeroData", () => {
  it("dispatches the set-data event with clamped detail", () => {
    const target = new EventTarget();
    let detail: { x0?: number; x1?: number } | null = null;
    target.addEventListener(HERO_SET_EVENT, (e) => {
      detail = (e as CustomEvent<{ x0?: number; x1?: number }>).detail;
    });
    requestHeroData(1.2, -99, target);
    expect(detail).not.toBeNull();
    expect(detail!.x0).toBeCloseTo(1.2);
    expect(detail!.x1).toBe(HERO_X_MIN);
  });

  it("omits detail keys for absent args and no-ops without a target", () => {
    const target = new EventTarget();
    let detail: { x0?: number; x1?: number } | null = null;
    target.addEventListener(HERO_SET_EVENT, (e) => {
      detail = (e as CustomEvent<{ x0?: number; x1?: number }>).detail;
    });
    requestHeroData(undefined, 0.3, target);
    expect(detail).toEqual({ x1: 0.3 });
    expect(() => requestHeroData(1, 1, undefined)).not.toThrow();
  });
});

describe("hero snapshot", () => {
  it("publishes partial updates and returns defensive copies", () => {
    publishHeroSnapshot({ mounted: true, epoch: 30, loss: 0.12, params: [1, 2, 3, 4], data: [{ x: 0.5, y: 1 }] });
    const a = getHeroSnapshot();
    expect(a).toMatchObject({ mounted: true, epoch: 30, loss: 0.12 });
    a.params[0] = 999;
    a.data[0]!.x = 999;
    const b = getHeroSnapshot();
    expect(b.params[0]).toBe(1);
    expect(b.data[0]!.x).toBe(0.5);
    publishHeroSnapshot({ mounted: false });
    expect(getHeroSnapshot()).toMatchObject({ mounted: false, epoch: 30 });
  });
});
