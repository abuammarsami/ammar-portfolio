import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Full static prerender on Vercel (ADR-0001). Every route is force-static;
  // we deliberately do NOT use `output: "export"` so we keep opengraph-image,
  // next/image optimization, and redirects.
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/resume",
        destination: "/resume.pdf",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
