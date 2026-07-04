import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "The machine interface of Md. Abu Ammar's portfolio — humans read it, agents call it, browsers operate it";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const Q0 = "#5FC9BF";
const Q1 = "#9D8CFF";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "#0B0D12",
          color: "#E9E7E0",
          fontFamily: "serif",
        }}
      >
        <div style={{ fontSize: 30, fontFamily: "monospace", color: Q0, display: "flex" }}>
          {"await document.modelContext.getTools()"}
        </div>
        <div style={{ fontSize: 62, marginTop: 30, display: "flex" }}>A portfolio agents can operate</div>
        <div style={{ fontSize: 26, marginTop: 16, color: "#8A8F9C", display: "flex" }}>
          humans read it · agents call it · browsers operate it
        </div>
        <div style={{ fontSize: 22, marginTop: 30, fontFamily: "monospace", display: "flex", gap: 22 }}>
          <span style={{ color: Q0 }}>MCP</span>
          <span style={{ color: Q1 }}>WebMCP</span>
          <span style={{ color: Q0 }}>llms.txt</span>
          <span style={{ color: Q1 }}>agent-card</span>
          <span style={{ color: Q0 }}>fit report</span>
        </div>
      </div>
    ),
    size,
  );
}
