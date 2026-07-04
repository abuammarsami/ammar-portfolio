import { ArxivRow } from "@/components/paper/arxiv-row";
import { BibtexBlock } from "@/components/paper/bibtex-block";
import { PaperFigure } from "@/components/paper/figure";
import { SectionHeading } from "@/components/paper/section-heading";
import { FooterTerminal } from "@/components/ui/footer-terminal";
import { Nav } from "@/components/ui/nav";
import { TagChip } from "@/components/ui/tag-chip";

export const dynamic = "force-static";
export const metadata = { title: "Design System", robots: { index: false } };

// Internal sample sheet for verifying tokens/primitives in both themes.
// Not linked from anywhere; noindex.
export default function DesignPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 pb-16">
        <h1 className="mt-10 font-serif text-4xl">Design system</h1>
        <p className="mt-2 text-muted">Tokens, type, and primitives — both themes must pass AA.</p>

        <SectionHeading index={1} title="Type & color" />
        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed">
          Body prose is STIX Two Text — the typeface of scientific publishing. UI runs in
          IBM Plex Sans, and <span className="font-mono text-sm">metadata runs in IBM Plex Mono</span>.
          Accents are the entangled pair: <span className="text-q0">|0⟩ teal</span> and{" "}
          <span className="text-q1">|1⟩ violet</span>.{" "}
          <a href="#" className="link-super">
            Superposition links collapse on hover.
          </a>
        </p>
        <p className="mt-4 flex gap-2">
          <TagChip label="quant-ph" />
          <TagChip label="cs.LG" />
          <TagChip label="dotnet" />
        </p>

        <SectionHeading index={2} title="Entangled card" />
        <div className="entangled mt-4 max-w-md rounded-sm border rule-hair bg-surface p-5">
          <p className="entangled-a font-mono text-xs text-muted">kioskvisionai · 2025</p>
          <h3 className="mt-1 font-serif text-xl">KioskVisionAI</h3>
          <p className="mt-1 text-sm text-muted">
            Hover this card — the id shifts to |0⟩ while the chip shifts to |1⟩.
          </p>
          <p className="mt-2">
            <span className="entangled-b rounded-sm border rule-hair px-1.5 py-0.5 font-mono text-xs text-muted">
              [azure]
            </span>
          </p>
        </div>

        <SectionHeading index={3} title="Figure" />
        <PaperFigure index={1} caption="Placeholder figure body (surface + hairline)">
          <div className="flex h-24 items-center justify-center font-mono text-sm text-muted">
            figure content
          </div>
        </PaperFigure>

        <SectionHeading index={4} title="BibTeX" />
        <BibtexBlock
          entry={`@misc{ammar2022qml,
  author = {Ammar, Md. Abu},
  title  = {Machine Learning in the Realm of Quantum},
  year   = {2022},
  note   = {Undergraduate thesis, North South University}
}`}
        />

        <SectionHeading index={5} title="arXiv row" />
        <ArxivRow
          id="ammar-2022-qml"
          title="Machine Learning in the Realm of Quantum"
          date="Sep 2022"
          categories={["quant-ph", "cs.LG"]}
          abstract="Surveys recent QML models and interprets classification tasks in the quantum realm across several encoding methods, with experiments on PennyLane and IBMQ."
          links={[{ label: "github", href: "https://github.com/abuammarsami/CSE499.06-QML-" }]}
        />
      </main>
      <FooterTerminal />
    </>
  );
}
