/**
 * Hand-rolled fuzzy matching for the ⌘K palette (plan-0005 P5) — no dep.
 * Subsequence scorer: every query char must appear in order; contiguous
 * runs, word starts, and early matches score higher. 0 = no match.
 */

export type SearchEntry = { title: string; path: string; kind: string; hint: string };

export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    if (ch === " ") {
      streak = 0;
      continue;
    }
    const found = t.indexOf(ch, ti);
    if (found === -1) return 0;
    streak = found === ti ? streak + 1 : 1;
    score += streak * 2; // contiguous runs compound
    if (found === 0 || t[found - 1] === " " || t[found - 1] === "-") score += 3; // word starts
    ti = found + 1;
  }
  return score + Math.max(0, 12 - t.length / 8); // mild bias toward short titles
}

/** Top-n entries matching the query, best first. */
export function searchEntries(entries: SearchEntry[], query: string, n = 5): SearchEntry[] {
  return entries
    .map((e) => ({ e, s: fuzzyScore(query, `${e.title} ${e.kind}`) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(({ e }) => e);
}
