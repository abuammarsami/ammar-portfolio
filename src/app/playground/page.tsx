import type { Metadata } from "next";
import { ComposerLoader } from "@/components/quantum/composer-loader";
import { getOptionalHtml } from "@/lib/content/loader";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Playground",
  description: "Build a real 2-qubit quantum circuit — H, RY, RZ, CNOT — and watch the exact statevector respond. Shareable circuits, agent-operable.",
};

const prose =
  "mt-5 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4 [&_strong]:text-q0 [&_a]:text-q1 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-q1/50 [&_a:hover]:decoration-q1";

/**
 * /playground (plan-0006): the quantum circuit composer. The page shell is
 * static server HTML; ?c= share links are read client-side by the island
 * only (a server searchParams read would force dynamic rendering).
 */
export default async function PlaygroundPage() {
  const introHtml = await getOptionalHtml("playground.md");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">a real simulator, not an animation · 2 qubits · exact statevector</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Quantum playground</h1>
        {introHtml && <div className={prose} dangerouslySetInnerHTML={{ __html: introHtml }} />}
      </header>

      <div className="mt-8">
        <ComposerLoader />
      </div>

      <p className="mt-8 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        Gate math, derivations, and the training loop live in the{" "}
        <a href="/learn" className="text-q0 hover:underline">
          six-lesson curriculum
        </a>
        . Agents: call <span className="text-q1">compose_circuit</span> on{" "}
        <a href="/agents" className="text-q0 hover:underline">
          /agents
        </a>{" "}
        — it drives this page live when it&apos;s open.
      </p>
    </main>
  );
}
