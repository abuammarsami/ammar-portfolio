import type { ReactNode } from "react";

export function PaperFigure({
  index,
  caption,
  children,
}: {
  index: number;
  caption: string;
  children: ReactNode;
}) {
  return (
    <figure className="my-8">
      <div className="rounded-sm border rule-hair bg-surface p-4">{children}</div>
      <figcaption className="mt-2 text-center font-mono text-xs text-muted">
        Fig. {index} — {caption}
      </figcaption>
    </figure>
  );
}
