/**
 * Renders the markdown subset the grounded endpoints emit (##, **, bullets)
 * without a parser dependency. Shared by the fit report and interview mode —
 * both are lazy islands, so this ships once in their common chunk.
 */
export function AnswerBlocks({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const bold = (s: string, key: number) =>
    s.split(/\*\*([^*]+)\*\*/g).map((part, i) => (i % 2 === 1 ? <strong key={`${key}-${i}`}>{part}</strong> : part));
  const flush = (key: number) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} className="mt-2 space-y-2">
        {list.map((item, i) => (
          <li key={i} className="ml-4 list-disc">
            {bold(item, i)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith("- ") || line.startsWith("* ")) {
      list.push(line.slice(2));
      continue;
    }
    flush(i);
    if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={i} className="mt-5 font-mono text-sm tracking-wide text-muted uppercase">
          {line.slice(3)}
        </h3>,
      );
    } else if (line) {
      blocks.push(
        <p key={i} className="mt-2">
          {bold(line, i)}
        </p>,
      );
    }
  }
  flush(lines.length);
  return <>{blocks}</>;
}
