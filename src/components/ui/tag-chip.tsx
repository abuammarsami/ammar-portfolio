export function TagChip({ label }: { label: string }) {
  return (
    <span className="entangled-b rounded-sm border rule-hair px-1.5 py-0.5 font-mono text-xs text-muted transition-colors">
      [{label}]
    </span>
  );
}
