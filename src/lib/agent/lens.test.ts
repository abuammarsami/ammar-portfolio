import { describe, expect, it } from "vitest";

import { DEFAULT_LENS, isLens, LENS_INIT_SCRIPT, LENS_STORAGE_KEY, LENSES, currentLens } from "./lens";

describe("lens", () => {
  it("recognises exactly the three lenses", () => {
    for (const l of LENSES) expect(isLens(l)).toBe(true);
    expect(isLens("hacker")).toBe(false);
    expect(isLens("")).toBe(false);
    expect(isLens(undefined)).toBe(false);
  });

  it("defaults to recruiter outside the browser", () => {
    expect(DEFAULT_LENS).toBe("recruiter");
    expect(currentLens()).toBe(DEFAULT_LENS);
  });

  it("keeps the pre-paint script in sync with the storage key and non-default lenses", () => {
    expect(LENS_INIT_SCRIPT).toContain(LENS_STORAGE_KEY);
    for (const l of LENSES) {
      if (l !== DEFAULT_LENS) expect(LENS_INIT_SCRIPT).toContain(`"${l}"`);
    }
    // the default never needs restoring — the server HTML already carries it
    expect(LENS_INIT_SCRIPT).not.toContain(`"${DEFAULT_LENS}"`);
  });
});
