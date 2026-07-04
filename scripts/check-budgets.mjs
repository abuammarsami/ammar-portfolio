// Per-route first-load JS budget guard (CLAUDE.md §5.2, ADR-0006).
// Measures gzipped bytes of the script chunks referenced by each route's HTML.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BUDGETS = [
  { route: "/", html: ".next/server/app/index.html", limit: 200_000 },
  { route: "/learn", html: ".next/server/app/learn.html", limit: 350_000 },
  { route: "/work", html: ".next/server/app/work.html", limit: 200_000 },
];

let failed = false;
for (const { route, html, limit } of BUDGETS) {
  if (!fs.existsSync(html)) {
    console.error(`budget: missing ${html} — run next build first`);
    failed = true;
    continue;
  }
  const src = fs.readFileSync(html, "utf8");
  const chunks = [...new Set([...src.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];
  let total = 0;
  for (const c of chunks) {
    const p = path.join(".next", c.replace("/_next/", ""));
    if (fs.existsSync(p)) total += zlib.gzipSync(fs.readFileSync(p)).length;
  }
  const ok = total <= limit;
  console.log(`${ok ? "✓" : "✗"} ${route}: ${(total / 1000).toFixed(0)} kB gz (limit ${(limit / 1000).toFixed(0)} kB, ${chunks.length} chunks)`);
  if (!ok) failed = true;
}
if (failed) {
  console.error("Budget check FAILED");
  process.exit(1);
}
// first-load = eager script tags; dynamic() chunks (the /learn WebGL stage)
// are deferred by design and stream after hydration.
console.log("Budgets OK");
