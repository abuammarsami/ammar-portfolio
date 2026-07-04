import { ImageResponse } from "next/og";
import { getProject, getProjects, visibleProjects } from "@/lib/content/loader";

export const dynamic = "force-static";
export const alt = "Case study — Md. Abu Ammar";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const projects = visibleProjects(await getProjects());
  return projects.map((p) => ({ slug: p.slug }));
}

const Q0 = "#5FC9BF";
const Q1 = "#9D8CFF";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);

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
          {slug} · {project?.date ?? ""}
        </div>
        <div style={{ fontSize: 60, marginTop: 20, lineHeight: 1.15, display: "flex" }}>
          {project?.title ?? "Case study"}
        </div>
        <div
          style={{
            fontSize: 28,
            marginTop: 28,
            color: "#8A8F9C",
            lineHeight: 1.4,
            display: "flex",
          }}
        >
          {project?.summary ?? ""}
        </div>
        <div
          style={{ fontSize: 22, marginTop: 36, color: Q1, fontFamily: "monospace", display: "flex" }}
        >
          Md. Abu Ammar — {(project?.tags ?? []).slice(0, 4).map((t) => `[${t}]`).join(" ")}
        </div>
      </div>
    ),
    size,
  );
}
