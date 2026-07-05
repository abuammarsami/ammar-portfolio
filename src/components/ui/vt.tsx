import * as React from "react";

/**
 * The single fence around React's experimental <ViewTransition> (plan-0005
 * P5). The export has churned across canaries (unstable_ViewTransition →
 * ViewTransition), so every consumer imports this wrapper instead: if the
 * export is missing the children render untouched and navigation is simply
 * instant — the failure mode is no animation, never a broken page.
 */

type VtComponent = React.ComponentType<{ name?: string; children?: React.ReactNode }>;

const reactExports = React as unknown as { ViewTransition?: VtComponent; unstable_ViewTransition?: VtComponent };
const VT: VtComponent | null = reactExports.ViewTransition ?? reactExports.unstable_ViewTransition ?? null;

export function Vt({ name, children }: { name?: string; children: React.ReactNode }) {
  if (!VT) return <>{children}</>;
  return <VT name={name}>{children}</VT>;
}
