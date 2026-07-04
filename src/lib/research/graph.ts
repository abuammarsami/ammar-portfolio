import type { Paper, Project } from "@/lib/content/schema";

export type ConstellationNode = {
  id: string;
  href: string;
  label: string;
  sub: string;
  type: "paper" | "project" | "learn";
  /** percentage coordinates inside the stage (0–100) */
  x: number;
  y: number;
};

export type ConstellationEdge = {
  a: string;
  b: string;
  /** dashed = "entangled by a shared idea" (tag overlap), solid = explicit relation */
  dashed: boolean;
};

export type Constellation = { nodes: ConstellationNode[]; edges: ConstellationEdge[] };

const PAPER_Y = 48;
const SATELLITE_Y = 14;
const LEARN_Y = 84;

function shortTitle(title: string): string {
  const cut = title.split(/[:—]/)[0]!.trim();
  return cut.length > 42 ? cut.slice(0, 39).trimEnd() + "…" : cut;
}

function sharedTag(a: string[], b: string[]): string | null {
  return a.find((t) => b.includes(t)) ?? null;
}

/**
 * Deterministic layout of the research space (ADR-0008): papers form the
 * center band, related/researched projects orbit above, /learn hangs below.
 * Pure data in, pure data out — computed server-side so the DOM never shifts.
 */
export function buildConstellation(papers: Paper[], researchProjects: Project[]): Constellation {
  const nodes: ConstellationNode[] = [];
  const edges: ConstellationEdge[] = [];

  // center band: papers, evenly spread, alternating gentle vertical drift
  const px = (i: number, n: number) => (n === 1 ? 50 : 14 + (72 * i) / (n - 1));
  papers.forEach((p, i) => {
    nodes.push({
      id: `paper:${p.slug}`,
      href: `/research/${p.slug}`,
      label: shortTitle(p.title),
      sub: `${p.kind} · ${p.year}`,
      type: "paper",
      x: px(i, papers.length),
      y: PAPER_Y + (i % 2 === 0 ? -4 : 4),
    });
  });

  // satellites: research projects on the top band — sorted by their anchoring
  // paper's x, then spread evenly so labels can never collide
  const satellites = researchProjects.map((pr) => {
    const viaRelated = papers.find((p) => p.related.project === pr.slug);
    const viaTag = viaRelated ?? papers.find((p) => sharedTag(p.tags, pr.tags));
    const anchor = viaTag ? nodes.find((n) => n.id === `paper:${viaTag.slug}`) : undefined;
    return { pr, anchor, related: Boolean(viaRelated) };
  });
  satellites.sort((a, b) => (a.anchor?.x ?? 50) - (b.anchor?.x ?? 50));
  satellites.forEach(({ pr, anchor, related }, i) => {
    const node: ConstellationNode = {
      id: `project:${pr.slug}`,
      href: `/work/${pr.slug}`,
      label: shortTitle(pr.title),
      sub: "case study",
      type: "project",
      x: satellites.length === 1 ? 50 : 14 + (72 * i) / (satellites.length - 1),
      y: SATELLITE_Y + (i % 2) * 7,
    };
    nodes.push(node);
    if (anchor) edges.push({ a: anchor.id, b: node.id, dashed: !related });
  });

  // the curriculum: one hub below, tied to every paper that feeds a lesson
  const teaching = papers.filter((p) => p.related.lesson);
  if (teaching.length > 0) {
    const cx = nodes.find((n) => n.id === `paper:${teaching[0]!.slug}`)?.x ?? 50;
    nodes.push({
      id: "learn",
      href: "/learn",
      label: "Learn quantum, from zero",
      sub: "6 interactive lessons",
      type: "learn",
      x: Math.min(80, Math.max(20, cx + 14)),
      y: LEARN_Y,
    });
    for (const p of teaching) edges.push({ a: `paper:${p.slug}`, b: "learn", dashed: false });
  }

  // entangled ideas: papers sharing a tag (skip pairs already joined)
  for (let i = 0; i < papers.length; i++) {
    for (let j = i + 1; j < papers.length; j++) {
      const tag = sharedTag(papers[i]!.tags, papers[j]!.tags);
      if (tag) edges.push({ a: `paper:${papers[i]!.slug}`, b: `paper:${papers[j]!.slug}`, dashed: true });
    }
  }

  return { nodes, edges };
}
