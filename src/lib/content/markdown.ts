import fs from "node:fs";
import path from "node:path";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { fromHtml } from "hast-util-from-html";
import { unified } from "unified";
import { visit } from "unist-util-visit";

// No path segments (no "/" or ".." inside the filename) — a flat file under /figures.
const SVG_FIGURE = /^\/figures\/[\w-]+\.svg$/;

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
 * (ADR-0014) into themed HTML, and lone /figures/*.svg images are inlined — both
 * zero client JS. Dual light/dark Shiki themes: base colors are light,
 * `[data-theme="dark"]` swaps to the `--shiki-dark` vars (globals.css).
 * Memoized per input string.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
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
