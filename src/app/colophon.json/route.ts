import { collectRepoStats, readBuildStats } from "@/lib/colophon/stats";
import { SITE_URL } from "@/lib/site";

/** Machine-readable colophon (plan-0006) — frozen at build time like the page. */
export const dynamic = "force-static";

export async function GET() {
  return Response.json(
    {
      site: SITE_URL,
      repo: collectRepoStats(),
      bundles: readBuildStats(),
      note: "bundle sizes are measured at the recorded commit, not live; regenerated with `npm run stats`",
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
