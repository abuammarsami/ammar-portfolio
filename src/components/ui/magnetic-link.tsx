"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

/** CTA that subtly follows the cursor (≤6px), springing back on leave. */
export function MagneticLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  function onMove(e: React.PointerEvent) {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 12;
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 8;
    el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }
  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`inline-block transition-transform duration-200 ease-out ${className}`}
    >
      {children}
    </Link>
  );
}
