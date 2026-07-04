"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scroll reveal: adds .is-visible when the element enters the viewport (once).
 * Pure IO + CSS — the motion language lives in globals.css.
 */
export function Reveal({
  children,
  className = "",
  stagger = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stagger) {
      Array.from(el.children).forEach((child, i) =>
        (child as HTMLElement).style.setProperty("--reveal-i", String(i)),
      );
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stagger]);

  return (
    <div ref={ref} className={`reveal ${stagger ? "reveal-stagger" : ""} ${className}`}>
      {children}
    </div>
  );
}
