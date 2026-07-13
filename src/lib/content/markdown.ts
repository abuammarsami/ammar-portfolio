import fs from "node:fs";
import path from "node:path";
import rehypeShiki from "@shikijs/rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkDirective from "remark-directive";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { fromHtml } from "hast-util-from-html";
import { unified } from "unified";
import { visit } from "unist-util-visit";

// No path segments (no "/" or ".." inside the filename) — a flat file under /figures.
const SVG_FIGURE = /^\/figures\/[\w-]+\.svg$/;

/**
 * Lens-conditional callouts (Professor-mode upgrade). A `:::professor` container
 * directive becomes a `<div class="lens-professor dd-aside dd-prof">`; the
 * `.lens-professor` class is already hidden under other lenses by the global lens
 * rules (globals.css), so the block only renders when the reader flips the nav
 * lens to "professor". `:::aside` is a neutral callout everyone sees.
 *
 * We only ever author *container* (`:::`) directives. remark-directive, however,
 * also enables single-colon TEXT and double-colon LEAF directives everywhere —
 * and a bare `:name` needs no brackets, so a plain `0.50:0.95`, `14:30`, `1:1`,
 * or `:word` in prose parses as a directive and, left to the default handler,
 * renders as an empty <div> that DELETES the surrounding text. To defuse that
 * footgun globally, `remarkLensDirectives` restores every text/leaf directive to
 * its exact original source (via position offsets) — so only `:::professor` /
 * `:::aside` do anything, and everything else is untouched literal prose.
 * Author an optional heading with `:::professor[Custom label]`; otherwise the
 * default label below is injected.
 */
const LENS_DIRECTIVES: Record<string, { className: string[]; label: string | null }> = {
  professor: { className: ["lens-professor", "dd-aside", "dd-prof"], label: "For the professor" },
  aside: { className: ["dd-aside", "dd-note"], label: null },
};

function remarkLensDirectives() {
  // mdast nodes are walked untyped; `any` keeps the tree-rewrite readable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any, file: unknown) => {
    const src = String(file);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, (node: any, index: number | undefined, parent: any) => {
      if (node.type === "containerDirective") {
        const spec = LENS_DIRECTIVES[node.name];
        if (!spec) return; // unknown container directive — leave it for the default handler
        const data = node.data || (node.data = {});
        data.hName = "div";
        data.hProperties = { className: spec.className };
        // Heading: an explicit `:::name[label]` is lifted by remark-directive into a
        // first child paragraph flagged `directiveLabel` — style it as the label chip.
        // Otherwise inject the default label (if the directive defines one).
        const first = node.children?.[0];
        if (first?.data?.directiveLabel && first.type === "paragraph") {
          first.data.hProperties = { className: ["dd-aside-label"] };
        } else if (spec.label) {
          node.children.unshift({
            type: "paragraph",
            data: { hProperties: { className: ["dd-aside-label"] } },
            children: [{ type: "text", value: spec.label }],
          });
        }
        return;
      }
      // Never-authored text/leaf directives → restore literal source (see doc above),
      // so a stray `0.50:0.95` / `14:30` / `:word` in prose is never eaten.
      if ((node.type === "textDirective" || node.type === "leafDirective") && parent && typeof index === "number") {
        const s = node.position?.start?.offset;
        const e = node.position?.end?.offset;
        parent.children[index] = {
          type: "text",
          value: s != null && e != null ? src.slice(s, e) : (node.type === "leafDirective" ? "::" : ":") + node.name,
        };
      }
    });
  };
}

/**
 * Build-time rehype plugin (ADR-0014): a paragraph whose only content is a
 * `/figures/*.svg` image is replaced by a `<figure>` with the SVG inlined from
 * public/ and the alt text as `<figcaption>`. Inlining (vs. an <img>) lets the
 * SVG's strokes resolve the --color-* theme tokens and lets its embedded
 * animation run — the same reason ProjectFigure inlines (ADR-0012). Only
 * repo-authored /figures/*.svg files are ever read.
 */
// hast nodes are walked untyped; `any` keeps the tree-rewrite readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rehypeInlineSvg() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, "element", (node: any, index: number | undefined, parent: any) => {
      if (node.tagName !== "p" || !parent || typeof index !== "number") return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meaningful = node.children.filter((c: any) => !(c.type === "text" && /^\s*$/.test(c.value)));
      if (meaningful.length !== 1 || meaningful[0].tagName !== "img") return;
      const img = meaningful[0];
      const src = img.properties?.src;
      if (typeof src !== "string" || !SVG_FIGURE.test(src)) return;
      const figuresDir = path.join(process.cwd(), "public", "figures");
      const abs = path.join(process.cwd(), "public", src);
      // Defense-in-depth: never read outside public/figures even if the regex is loosened.
      if (!abs.startsWith(figuresDir + path.sep) || !fs.existsSync(abs)) return;

      const frag = fromHtml(fs.readFileSync(abs, "utf8"), { fragment: true, space: "svg" });
      const alt = typeof img.properties?.alt === "string" ? img.properties.alt : "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = [
        { type: "element", tagName: "div", properties: { className: ["md-figure-svg"] }, children: frag.children },
      ];
      if (alt) {
        children.push({ type: "element", tagName: "figcaption", properties: {}, children: [{ type: "text", value: alt }] });
      }
      parent.children[index] = { type: "element", tagName: "figure", properties: { className: ["md-figure"] }, children };
    });
  };
}

/**
 * Markdown → HTML (build-time only). Code fences are syntax-highlighted by Shiki
 * (ADR-0014) into themed HTML, lone /figures/*.svg images are inlined, `$…$`
 * math is typeset by KaTeX, and `:::professor` / `:::aside` container directives
 * become lens-conditional callouts — all zero client JS. Dual light/dark Shiki
 * themes: base colors are light, `[data-theme="dark"]` swaps to the `--shiki-dark`
 * vars (globals.css). Memoized per input string.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkLensDirectives)
  .use(remarkRehype)
  // KaTeX renders `$…$` / `$$…$$` to HTML+CSS at build time — zero client JS.
  // Non-fatal: a malformed formula renders in red rather than failing the build.
  .use(rehypeKatex, { throwOnError: false, strict: false })
  .use(rehypeInlineSvg)
  .use(rehypeShiki, {
    themes: { light: "vitesse-light", dark: "vitesse-dark" },
    defaultColor: "light",
    // never fail the build on a missing or unknown code-fence language
    defaultLanguage: "text",
    fallbackLanguage: "text",
  })
  .use(rehypeStringify);

const cache = new Map<string, string>();

export async function markdownToHtml(md: string): Promise<string> {
  const hit = cache.get(md);
  if (hit !== undefined) return hit;
  const html = String(await processor.process(md));
  cache.set(md, html);
  return html;
}
