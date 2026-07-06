import fs from "node:fs";
import path from "node:path";
import type { ProjectFigure as Figure } from "@/lib/content/schema";

/**
 * A self-hosted project figure (ADR-0012). Server-only: the SVG is read from
 * public/ at build time and inlined so its strokes resolve the --color-*
 * theme tokens; the loader has already validated the path and existence.
 * Every figure carries width/height attributes matching its viewBox, so
 * w-full/h-auto scales at the intrinsic ratio (CLS 0).
 */
export function ProjectFigure({ src, caption }: Figure) {
  const svg = fs.readFileSync(path.join(process.cwd(), "public", src), "utf8");
  return (
    <figure className="mt-12">
      <div
        className="rounded-sm border rule-hair bg-surface p-5 [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="mt-2 text-center font-mono text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}
