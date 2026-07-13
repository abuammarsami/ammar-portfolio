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

  it("does not treat a prose colon-word as a directive", async () => {
    const html = await markdownToHtml("See the note :here should stay literal.");
    expect(html).toContain("should stay literal");
  });
});
