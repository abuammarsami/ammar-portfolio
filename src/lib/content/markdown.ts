import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

const cache = new Map<string, string>();

/** Markdown → HTML (build-time only). Memoized per input string. */
export async function markdownToHtml(md: string): Promise<string> {
  const hit = cache.get(md);
  if (hit !== undefined) return hit;
  const html = String(await processor.process(md));
  cache.set(md, html);
  return html;
}
