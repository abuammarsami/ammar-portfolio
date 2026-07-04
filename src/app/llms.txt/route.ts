import { LINKS, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const body = `# Md. Abu Ammar — Backend & AI Systems Engineer

> Payment infrastructure ($MM+/yr, 20k+ users), AI kiosk monitoring (120+ devices,
> Azure Vision AI), .NET Aspire distributed platforms — and quantum ML research.

This site is agent-readable and agent-operable (one tool layer, three surfaces).

## Core
- [Full corpus](${SITE_URL}/llms-full.txt): everything on this site as plain text
- [Resume (JSON Resume schema)](${SITE_URL}/resume.json)
- [Resume (PDF)](${SITE_URL}/resume.pdf)
- [MCP server](${SITE_URL}/api/mcp): tools get_resume · list_projects · search_publications · get_paper · get_lessons · contact

## Pages
- [Work — engineering case studies](${SITE_URL}/work)
- [Research — the library: real papers, distilled](${SITE_URL}/research)
- [Learn — interactive quantum curriculum](${SITE_URL}/learn)
- [About](${SITE_URL}/about)

## Contact
- Email: ${LINKS.email}
- GitHub: ${LINKS.github}
- LinkedIn: ${LINKS.linkedin}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
