"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mounts the WebMCP tool registry when the browser exposes a model context
 * (Chrome 149+ origin trial — ADR-0009). Renders nothing. The mount body
 * (token injection, feature detection, registration) lives in the lazy
 * webmcp-mount module so no browser pays for it in the first-load bundle.
 */
export function WebmcpProvider() {
  const router = useRouter();

  useEffect(() => {
    const ac = new AbortController();
    void import("./webmcp-mount").then((m) => {
      if (!ac.signal.aborted) return m.mount((path) => router.push(path), ac.signal);
    });
    return () => ac.abort();
  }, [router]);

  return null;
}
