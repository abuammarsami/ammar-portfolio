/**
 * One driver at a time (plan-0006): the autopilot tour and interview mode
 * both narrate over the page and steer navigation — two caption surfaces
 * fighting would be chaos. Lazy-only module (never in the eager bundle).
 *
 * The stage also owns the bottom of the screen: the ✦ ask launcher
 * (zero-JS server chrome in layout.tsx) hides while ANY surface holds the
 * stage. That lives here — the one chokepoint every stage owner already
 * passes through — via the `hidden` attribute, which can't collide with
 * the launcher's layout classes.
 */

let holder: string | null = null;

function setLauncherHidden(hidden: boolean): void {
  if (typeof document === "undefined") return; // unit tests run without a DOM
  const el = document.querySelector<HTMLElement>("[data-ask]");
  if (el) el.hidden = hidden;
}

export function claimStage(who: string): boolean {
  if (holder && holder !== who) return false;
  holder = who;
  setLauncherHidden(true);
  return true;
}

export function releaseStage(who: string): void {
  if (holder === who) {
    holder = null;
    setLauncherHidden(false);
  }
}

export function stageHolder(): string | null {
  return holder;
}
