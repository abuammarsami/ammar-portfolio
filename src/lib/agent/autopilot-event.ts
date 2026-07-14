/**
 * Stage start signals, alone in their own module: eager surfaces (the
 * provider's listeners, buttons) import just these constants without
 * dragging the tour or interview code into the first-load bundle
 * (plan-0005/0006 budgets — "/" has near-zero eager headroom).
 */
export const AUTOPILOT_EVENT = "ammar:autopilot";
export const INTERVIEW_EVENT = "ammar:interview";
/** Fired by a stage surface when it ends — lets eager chrome (the ask launcher) reappear. */
export const STAGE_DONE_EVENT = "ammar:stage-done";
