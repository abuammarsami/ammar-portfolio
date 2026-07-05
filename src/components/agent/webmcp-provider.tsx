"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTOPILOT_EVENT } from "@/lib/agent/autopilot-event";

/**
 * Mounts the WebMCP tool registry when the browser exposes a model context
 * (Chrome 149+ origin trial — ADR-0009) and listens for autopilot start
 * requests from any surface (plan-0005). Renders nothing. Both bodies live
 * in lazy modules so no browser pays for them in the first-load bundle.
 */
export function WebmcpProvider() {
  const router = useRouter();

  useEffect(() => {
    const ac = new AbortController();
    const navigate = (path: string) => router.push(path);
    void import("./webmcp-mount").then((m) => {
      if (!ac.signal.aborted) return m.mount(navigate, ac.signal);
    });
    const onAutopilot = () => void import("./autopilot-tour").then((m) => m.runTour(navigate));
    window.addEventListener(AUTOPILOT_EVENT, onAutopilot);
    return () => {
      ac.abort();
      window.removeEventListener(AUTOPILOT_EVENT, onAutopilot);
    };
  }, [router]);

  return null;
}
