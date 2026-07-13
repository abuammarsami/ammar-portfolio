import { describe, expect, it } from "vitest";
import { markdownToHtml } from "./markdown";

describe("markdownToHtml — Professor-mode pipeline", () => {
  it("renders a :::professor block as a lens-gated callout with a default label", async () => {
    const html = await markdownToHtml(":::professor\nDeep detail.\n:::");
    expect(html).toContain("lens-professor");
    expect(html).toContain("dd-aside");
    expect(html).toContain("dd-prof");
    expect(html).toContain("dd-aside-label");
    expect(html).toContain("For the professor");
    expect(html).toContain("Deep detail.");
  });

  it("honours an explicit :::professor[label]", async () => {
    const html = await markdownToHtml(":::professor[Derivation]\nProof.\n:::");
    expect(html).toContain("dd-aside-label");
    expect(html).toContain("Derivation");
    expect(html).not.toContain("For the professor");
  });

  it("renders a neutral :::aside everyone sees (no lens class)", async () => {
    const html = await markdownToHtml(":::aside\nA note.\n:::");
    expect(html).toContain("dd-note");
    expect(html).not.toContain("lens-professor");
    expect(html).not.toContain("lens-engineer");
  });

  it("typesets inline and display math with KaTeX", async () => {
    const html = await markdownToHtml("Inline $E=mc^2$ and display:\n\n$$\n\\frac{a}{b}\n$$");
    expect(html).toContain("katex");
    expect(html).toContain("katex-display");
  });

  it("leaves an unknown container directive's text intact (no corruption)", async () => {
    const html = await markdownToHtml(":::unknownthing\nStill here.\n:::");
    expect(html).toContain("Still here.");
    expect(html).not.toContain("lens-professor");
  });

  it("never lets a stray text/leaf directive eat prose (colons, ratios, times)", async () => {
    // Each of these parses as a bare `:name` text directive under remark-directive;
    // left to the default handler it becomes an empty <div> that deletes text.
    const cases: [string, string][] = [
      ["See the note :here should stay literal.", "See the note :here should stay literal."],
      ["IoU 0.50:0.95 strict", "IoU 0.50:0.95 strict"],
      ["splits are 60:20:20 sentence-level", "splits are 60:20:20 sentence-level"],
      ["Error stays 1:1 with the DLQ.", "Error stays 1:1 with the DLQ."],
      ["ratio 3:5 and time 14:30", "ratio 3:5 and time 14:30"],
    ];
    for (const [input, expected] of cases) {
      const html = await markdownToHtml(input);
      expect(html).toBe(`<p>${expected}</p>`); // exact — no orphan <div>, nothing deleted
    }
  });

  it("leaves a real `::` leaf directive in prose as literal text", async () => {
    const html = await markdownToHtml("Call ::Foo here.");
    expect(html).toContain("::Foo");
    expect(html).not.toContain("<div></div>");
  });
});
