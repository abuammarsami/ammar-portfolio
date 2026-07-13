// Per-route first-load JS budget guard (CLAUDE.md §5.2, ADR-0006).
// Measures gzipped bytes of the script chunks referenced by each route's HTML.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const BUDGETS = [
  { route: "/", html: ".next/server/app/index.html", limit: 200_000 },
  { route: "/learn", html: ".next/server/app/learn.html", limit: 350_000 },
  { route: "/work", html: ".next/server/app/work.html", limit: 200_000 },
  { route: "/work/payments-platform", html: ".next/server/app/work/payments-platform.html", limit: 200_000 },
  { route: "/work/mvc-to-api-migration", html: ".next/server/app/work/mvc-to-api-migration.html", limit: 200_000 },
  { route: "/work/auth-architecture", html: ".next/server/app/work/auth-architecture.html", limit: 200_000 },
  { route: "/deep-dives", html: ".next/server/app/deep-dives.html", limit: 200_000 },
  // Deep-dive chapters are structurally identical server components; we budget every
  // published chapter route so a per-page JS regression can't slip through on any of them.
  { route: "/deep-dives/why-background-jobs", html: ".next/server/app/deep-dives/why-background-jobs.html", limit: 200_000 },
  { route: "/deep-dives/the-worker-host", html: ".next/server/app/deep-dives/the-worker-host.html", limit: 200_000 },
  { route: "/deep-dives/the-job-contract", html: ".next/server/app/deep-dives/the-job-contract.html", limit: 200_000 },
  { route: "/deep-dives/the-outbox", html: ".next/server/app/deep-dives/the-outbox.html", limit: 200_000 },
  { route: "/deep-dives/when-jobs-fail", html: ".next/server/app/deep-dives/when-jobs-fail.html", limit: 200_000 },
  { route: "/deep-dives/security-and-observability", html: ".next/server/app/deep-dives/security-and-observability.html", limit: 200_000 },
  { route: "/deep-dives/production-patterns", html: ".next/server/app/deep-dives/production-patterns.html", limit: 200_000 },
  { route: "/deep-dives/claude-md-cleanup", html: ".next/server/app/deep-dives/claude-md-cleanup.html", limit: 200_000 },
  { route: "/deep-dives/nested-claude-md", html: ".next/server/app/deep-dives/nested-claude-md.html", limit: 200_000 },
  { route: "/deep-dives/the-hash-workflow", html: ".next/server/app/deep-dives/the-hash-workflow.html", limit: 200_000 },
  { route: "/deep-dives/document-driven-development", html: ".next/server/app/deep-dives/document-driven-development.html", limit: 200_000 },
  { route: "/d3", html: ".next/server/app/d3.html", limit: 200_000 },
  { route: "/deep-dives/quantum-machine-learning", html: ".next/server/app/deep-dives/quantum-machine-learning.html", limit: 200_000 },
  { route: "/deep-dives/bangla-pos-tagging", html: ".next/server/app/deep-dives/bangla-pos-tagging.html", limit: 200_000 },
  { route: "/deep-dives/network-anomaly-detection", html: ".next/server/app/deep-dives/network-anomaly-detection.html", limit: 200_000 },
  { route: "/deep-dives/blood-cell-detection", html: ".next/server/app/deep-dives/blood-cell-detection.html", limit: 200_000 },
  { route: "/deep-dives/multi-output-cnn", html: ".next/server/app/deep-dives/multi-output-cnn.html", limit: 200_000 },
  { route: "/deep-dives/startup-success-prediction", html: ".next/server/app/deep-dives/startup-success-prediction.html", limit: 200_000 },
  { route: "/research", html: ".next/server/app/research.html", limit: 200_000 },
  { route: "/agents", html: ".next/server/app/agents.html", limit: 200_000 },
  { route: "/hire", html: ".next/server/app/hire.html", limit: 200_000 },
  { route: "/playground", html: ".next/server/app/playground.html", limit: 200_000 },
  { route: "/cv", html: ".next/server/app/cv.html", limit: 200_000 },
  { route: "/colophon", html: ".next/server/app/colophon.html", limit: 200_000 },
  {
    route: "/research/quantum-machine-learning-thesis",
    html: ".next/server/app/research/quantum-machine-learning-thesis.html",
    limit: 200_000,
  },
];

let failed = false;
const measured = [];
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
  measured.push({ route, gzBytes: total, limitBytes: limit, chunks: chunks.length });
  console.log(`${ok ? "✓" : "✗"} ${route}: ${(total / 1000).toFixed(0)} kB gz (limit ${(limit / 1000).toFixed(0)} kB, ${chunks.length} chunks)`);
  if (!ok) failed = true;
}

// --emit: persist the measurements for /colophon (plan-0006). Committed on
// purpose — the page renders "measured at commit X on date Y", never
// claiming to be live. Refresh with `npm run stats`.
if (process.argv.includes("--emit") && !failed) {
  const { execSync } = await import("node:child_process");
  const commit = execSync("git rev-parse --short HEAD").toString().trim();
  const out = { commit, date: new Date().toISOString().slice(0, 10), routes: measured };
  fs.mkdirSync("src/lib/colophon", { recursive: true });
  fs.writeFileSync("src/lib/colophon/build-stats.json", JSON.stringify(out, null, 2) + "\n");
  console.log(`emitted src/lib/colophon/build-stats.json @ ${commit}`);
}
if (failed) {
  console.error("Budget check FAILED");
  process.exit(1);
}
// first-load = eager script tags; dynamic() chunks (the /learn WebGL stage)
// are deferred by design and stream after hydration.
console.log("Budgets OK");
