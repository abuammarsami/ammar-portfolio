import path from "node:path";
import { defineConfig } from "vitest/config";

// mirror tsconfig's "@/*" → "src/*" so tests can traverse aliased imports
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    // The markdown pipeline cold-starts Shiki + KaTeX on first use (~5s on a
    // cold CI runner), which trips vitest's 5s default on whichever content
    // test invokes it first. Give content tests real headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
