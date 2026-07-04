import type { MetadataRoute } from "next";
import { getPapers, getProjects, visiblePapers, visibleProjects } from "@/lib/content/loader";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = visibleProjects(await getProjects());
  const papers = visiblePapers(await getPapers());
  return [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/learn`, priority: 0.9 },
    { url: `${SITE_URL}/work`, priority: 0.9 },
    { url: `${SITE_URL}/research`, priority: 0.9 },
    { url: `${SITE_URL}/about`, priority: 0.8 },
    { url: `${SITE_URL}/writing`, priority: 0.5 },
    ...projects.map((p) => ({
      url: `${SITE_URL}/work/${p.slug}`,
      priority: p.featured ? 0.8 : 0.6,
    })),
    ...papers.map((p) => ({
      url: `${SITE_URL}/research/${p.slug}`,
      priority: p.featured ? 0.8 : 0.6,
    })),
  ];
}
