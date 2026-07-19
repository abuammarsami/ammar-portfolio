import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Full static prerender on Vercel (ADR-0001). Every route is force-static;
  // we deliberately do NOT use `output: "export"` so we keep opengraph-image,
  // next/image optimization, and redirects.
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // "Chat with this codebase" (ADR-0018): the get_source tool reads these
  // allowlisted files from process.cwd() at request time. Trace them into the
  // /api/chat and /api/mcp serverless bundles explicitly — the same files the
  // curated allowlist in src/lib/agent/source-index.ts exposes, nothing else.
  outputFileTracingIncludes: {
    "/api/chat": ["./src/components/quantum/statevector.ts", "./src/components/quantum/param-shift.ts", "./src/components/quantum/three/bloch-stage.tsx", "./src/lib/agent/*.ts"],
    "/api/mcp": ["./src/components/quantum/statevector.ts", "./src/components/quantum/param-shift.ts", "./src/components/quantum/three/bloch-stage.tsx", "./src/lib/agent/*.ts"],
  },
  experimental: {
    // cross-page crossfade via the View Transitions API (progressive enhancement)
    viewTransition: true,
  },
  async redirects() {
    return [
      {
        source: "/resume",
        destination: "/resume.pdf",
        permanent: false,
      },
    ];
  },
  async headers() {
    // WebMCP origin-trial token (ADR-0009). Chrome needs it as an HTTP header
    // or http-equiv meta; Next metadata can't emit http-equiv. No token = no-op.
    const token = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN;
    if (!token) return [];
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Origin-Trial", value: token }],
      },
    ];
  },
};

export default nextConfig;
