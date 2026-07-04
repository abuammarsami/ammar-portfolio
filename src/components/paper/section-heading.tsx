/** §-numbered heading — case-study pages only (ADR-0003). */
export function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <h2 className="mt-12 flex items-baseline gap-3 font-serif text-2xl">
      <span className="font-mono text-base text-q0">§{index}</span>
      {title}
    </h2>
  );
}
