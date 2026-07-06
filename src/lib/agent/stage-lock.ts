/**
 * One driver at a time (plan-0006): the autopilot tour and interview mode
 * both narrate over the page and steer navigation — two caption surfaces
 * fighting would be chaos. Lazy-only module (never in the eager bundle).
 */

let holder: string | null = null;

export function claimStage(who: string): boolean {
  if (holder && holder !== who) return false;
  holder = who;
  return true;
}

export function releaseStage(who: string): void {
  if (holder === who) holder = null;
}

export function stageHolder(): string | null {
  return holder;
}
