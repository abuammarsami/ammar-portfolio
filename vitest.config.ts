import path from "node:path";
import { defineConfig } from "vitest/config";

// mirror tsconfig's "@/*" → "src/*" so tests can traverse aliased imports
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
