import { ImageResponse } from "next/og";
import { getPaper, getPapers, visiblePapers } from "@/lib/content/loader";

export const dynamic = "force-static";
export const alt = "Research — Md. Abu Ammar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const papers = visiblePapers(await getPapers());
  return papers.map((p) => ({ slug: p.slug }));
}

const Q0 = "#5FC9BF";
const Q1 = "#9D8CFF";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = await getPaper(slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0B0D12",
          color: "#E9E7E0",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 26, color: Q0, fontFamily: "monospace", display: "flex" }}>
          {paper ? `${paper.venue} · ${paper.year}` : "research"}
        </div>
        <div style={{ fontSize: 54, marginTop: 20, lineHeight: 1.15, display: "flex" }}>
          {paper?.title ?? "Research"}
        </div>
        <div style={{ fontSize: 28, marginTop: 28, color: "#8A8F9C", lineHeight: 1.4, display: "flex" }}>
          {paper ? paper.authors.join(", ") + (paper.supervisor ? ` · supervised by ${paper.supervisor}` : "") : ""}
        </div>
        <div style={{ fontSize: 22, marginTop: 36, color: Q1, fontFamily: "monospace", display: "flex" }}>
          Md. Abu Ammar — {(paper?.tags ?? []).slice(0, 4).map((t) => `[${t}]`).join(" ")}
        </div>
      </div>
    ),
    size,
  );
}
