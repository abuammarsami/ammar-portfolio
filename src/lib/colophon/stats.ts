import fs from "node:fs";
import path from "node:path";

/**
 * Repo facts for /colophon (plan-0006), computed at BUILD time (this only
 * runs inside force-static pages/routes — never per-request). The pure
 * counters are unit-tested; the collector is a thin fs walk over them.
 */

export type RepoStats = {
  runtimeDeps: number;
  devDeps: number;
  testFiles: number;
  testCases: number;
  contentFiles: number;
  adrs: number;
};

export type BuildStats = {
  commit: string;
  date: string;
  routes: { route: string; gzBytes: number; limitBytes: number; chunks: number }[];
};

/** it("...") / test("...") occurrences — the honest "test cases" count. */
export function countTestCases(source: string): number {
  return (source.match(/\b(?:it|test)\(/g) ?? []).length;
}

export function countDeps(packageJson: string): { runtimeDeps: number; devDeps: number } {
  const pkg = JSON.parse(packageJson) as { dependencies?: object; devDependencies?: object };
  return {
    runtimeDeps: Object.keys(pkg.dependencies ?? {}).length,
    devDeps: Object.keys(pkg.devDependencies ?? {}).length,
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function collectRepoStats(root = process.cwd()): RepoStats {
  const tests = walk(path.join(root, "src")).filter((f) => /\.test\.tsx?$/.test(f));
  const testCases = tests.reduce((n, f) => n + countTestCases(fs.readFileSync(f, "utf8")), 0);
  const contentFiles = walk(path.join(root, "content")).filter((f) => f.endsWith(".md")).length;
  const adrs = fs
    .readdirSync(path.join(root, "docs/architecture/decisions"))
    .filter((f) => /^adr-\d{4}-.+\.md$/.test(f)).length;
  return {
    ...countDeps(fs.readFileSync(path.join(root, "package.json"), "utf8")),
    testFiles: tests.length,
    testCases,
    contentFiles,
    adrs,
  };
}

export function readBuildStats(root = process.cwd()): BuildStats | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "src/lib/colophon/build-stats.json"), "utf8")) as BuildStats;
  } catch {
    return null;
  }
}
