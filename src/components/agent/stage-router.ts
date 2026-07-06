import { AUTOPILOT_EVENT } from "@/lib/agent/autopilot-event";

/**
 * Lazy fan-out for stage events (plan-0006): the eager provider registers ONE
 * handler for both stage signals and defers even the event-detail parsing to
 * this module — "/" sits at 200.0/200 kB and every eager byte counts.
 */
export async function route(e: Event, navigate: (path: string) => void): Promise<void> {
  if (e.type === AUTOPILOT_EVENT) {
    const interest = (e as CustomEvent<{ interest?: string }>).detail?.interest;
    return (await import("./autopilot-tour")).runTour(navigate, { interest });
  }
  return (await import("./interview-mode")).openInterview(navigate);
}
