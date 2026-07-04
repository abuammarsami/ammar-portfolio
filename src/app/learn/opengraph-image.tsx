import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Learn quantum, from zero — interactive lessons by Md. Abu Ammar";
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
        {/* Bloch sphere */}
        <svg width="200" height="200" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" fill="none" stroke="#8A8F9C" strokeWidth="2" strokeOpacity="0.6" />
          <ellipse cx="100" cy="100" rx="80" ry="26" fill="none" stroke="#8A8F9C" strokeWidth="2" strokeOpacity="0.4" />
          <line x1="100" y1="100" x2="152" y2="52" stroke={Q0} strokeWidth="4" />
          <circle cx="152" cy="52" r="7" fill={Q0} />
          <circle cx="100" cy="20" r="5" fill={Q0} />
          <circle cx="100" cy="180" r="5" fill={Q1} />
        </svg>
        <div style={{ fontSize: 64, marginTop: 28, display: "flex" }}>Learn quantum, from zero</div>
        <div style={{ fontSize: 26, marginTop: 14, color: "#8A8F9C", display: "flex" }}>
          six interactive lessons · every number computed live
        </div>
        <div style={{ fontSize: 22, marginTop: 26, fontFamily: "monospace", display: "flex", gap: 20 }}>
          <span style={{ color: Q0 }}>qubit → entanglement</span>
          <span style={{ color: Q1 }}>→ quantum ML</span>
        </div>
      </div>
    ),
    size,
  );
}
