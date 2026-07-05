/**
 * The autopilot start signal, alone in its own module: eager surfaces (the
 * provider's listener, buttons) import just this constant without dragging
 * the full tour script into the first-load bundle (plan-0005 budgets).
 */
export const AUTOPILOT_EVENT = "ammar:autopilot";
