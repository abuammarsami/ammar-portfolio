import { buildCorpus } from "@/lib/agent/corpus";

export const dynamic = "force-static";

export async function GET() {
  const body = await buildCorpus();
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
