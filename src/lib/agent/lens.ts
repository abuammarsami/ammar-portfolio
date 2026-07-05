/**
 * The adaptive lens (plan-0005): `data-lens` on <html> re-weights the site's
 * emphasis for who's looking. Variants are statically rendered and toggled by
 * CSS only — no LLM, no layout shift, SEO sees the recruiter default. An
 * inline head script (layout.tsx) restores the stored lens before paint.
 * Client-safe pure module; the WebMCP set_lens tool and all UI surfaces
 * funnel through applyLens.
 */

export const LENSES = ["recruiter", "professor", "engineer"] as const;
export type Lens = (typeof LENSES)[number];

export const DEFAULT_LENS: Lens = "recruiter";
export const LENS_STORAGE_KEY = "ammar:lens";
/** Fired on window after applyLens so passive UI (the nav pill) can re-render. */
export const LENS_EVENT = "ammar:lens-change";

export function isLens(v: unknown): v is Lens {
  return typeof v === "string" && (LENSES as readonly string[]).includes(v);
}

export function currentLens(): Lens {
  if (typeof document === "undefined") return DEFAULT_LENS;
  const v = document.documentElement.dataset.lens;
  return isLens(v) ? v : DEFAULT_LENS;
}

export function applyLens(lens: Lens): void {
  document.documentElement.dataset.lens = lens;
  try {
    localStorage.setItem(LENS_STORAGE_KEY, lens);
  } catch {
    /* storage unavailable (private mode) — lens still applies for the visit */
  }
  window.dispatchEvent(new Event(LENS_EVENT));
}

/** Pre-paint restore, inlined into <head> — keep in sync with the constants above. */
export const LENS_INIT_SCRIPT = `try{var l=localStorage.getItem("${LENS_STORAGE_KEY}");if(l==="professor"||l==="engineer")document.documentElement.dataset.lens=l}catch(e){}`;
