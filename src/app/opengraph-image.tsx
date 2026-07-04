import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION } from "@/lib/site";

export const dynamic = "force-static";
export const alt = "Md. Abu Ammar — Software Engineer · Quantum ML Researcher";
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
          padding: "80px",
          background: "#0B0D12",
          color: "#E9E7E0",
          fontFamily: "serif",
        }}
      >
        {/* circuit motif */}
        <svg width="360" height="120" viewBox="0 0 360 120">
          <line x1="0" y1="35" x2="360" y2="35" stroke="#8A8F9C" strokeWidth="2" />
          <line x1="0" y1="85" x2="360" y2="85" stroke="#8A8F9C" strokeWidth="2" />
          <rect x="40" y="15" width="56" height="40" fill="#12151D" stroke={Q0} strokeWidth="3" />
          <rect x="40" y="65" width="56" height="40" fill="#12151D" stroke={Q0} strokeWidth="3" />
          <line x1="180" y1="35" x2="180" y2="85" stroke={Q1} strokeWidth="3" />
          <circle cx="180" cy="35" r="7" fill={Q1} />
          <circle cx="180" cy="85" r="14" fill="none" stroke={Q1} strokeWidth="3" />
          <rect x="250" y="15" width="56" height="40" fill="#12151D" stroke={Q1} strokeWidth="3" />
          <rect x="250" y="65" width="56" height="40" fill="#12151D" stroke={Q1} strokeWidth="3" />
        </svg>
        <div style={{ fontSize: 72, marginTop: 40, display: "flex" }}>Md. Abu Ammar</div>
        <div style={{ fontSize: 32, marginTop: 16, color: "#8A8F9C", display: "flex" }}>
          {SITE_DESCRIPTION}
        </div>
        <div
          style={{
            fontSize: 24,
            marginTop: 32,
            display: "flex",
            gap: 24,
            fontFamily: "monospace",
          }}
        >
          <span style={{ color: Q0 }}>● engineering</span>
          <span style={{ color: Q1 }}>● research</span>
        </div>
      </div>
    ),
    size,
  );
}
