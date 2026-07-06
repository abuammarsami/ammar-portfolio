import { describeCircuit, parseCircuit, runCircuit, serializeCircuit } from "@/components/quantum/circuit";
import { blochVector, probabilities } from "@/components/quantum/statevector";
import { SITE_URL } from "@/lib/site";

/**
 * compose_circuit's shared body (plan-0006) — client-safe on purpose: the
 * MCP layer (server) and the WebMCP registry (browser) both run the SAME
 * simulation, so this must never import fs-bound modules like the loader.
 */
export function composeCircuit(raw: unknown): string {
  const ops = parseCircuit(raw);
  if (!ops) {
    throw new Error("invalid circuit — grammar: gates joined by '_': h0, h1, ry0:θ, ry1:θ, rz0:θ, rz1:θ (|θ|≤π), cx. Example: h0_cx");
  }
  const state = runCircuit(ops);
  const probs = probabilities(state);
  return JSON.stringify(
    {
      circuit: describeCircuit(ops),
      probabilities: { "00": probs[0], "01": probs[1], "10": probs[2], "11": probs[3] },
      bloch: { q0: blochVector(state, 0), q1: blochVector(state, 1) },
      shareUrl: `${SITE_URL}/playground?c=${serializeCircuit(ops)}`,
    },
    null,
    2,
  );
}
