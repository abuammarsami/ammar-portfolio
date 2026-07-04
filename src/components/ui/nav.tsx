import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/work", label: "work" },
  { href: "/research", label: "research" },
  { href: "/about", label: "about" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b rule-hair bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/" className="font-serif text-lg tracking-tight" aria-label="Home">
          <CircuitMark />
          <span className="ml-2 align-middle">Abu Ammar</span>
        </Link>
        <div className="flex items-center gap-5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-mono text-sm text-muted transition-colors hover:text-q0"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/resume.pdf"
            className="font-mono text-sm text-muted transition-colors hover:text-q1"
          >
            cv↓
          </Link>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

/** Static 2-qubit circuit glyph — the site mark (ADR-0003). */
function CircuitMark() {
  return (
    <svg
      width="22"
      height="18"
      viewBox="0 0 22 18"
      aria-hidden="true"
      className="inline-block align-middle"
    >
      {/* two qubit wires */}
      <line x1="1" y1="5" x2="21" y2="5" stroke="var(--color-muted)" strokeWidth="1" />
      <line x1="1" y1="13" x2="21" y2="13" stroke="var(--color-muted)" strokeWidth="1" />
      {/* gate on wire 0 */}
      <rect x="4" y="2" width="6" height="6" fill="none" stroke="var(--color-q0)" strokeWidth="1.2" />
      {/* CNOT: control on wire 0, target on wire 1 */}
      <line x1="15.5" y1="5" x2="15.5" y2="13" stroke="var(--color-q1)" strokeWidth="1.2" />
      <circle cx="15.5" cy="5" r="1.6" fill="var(--color-q1)" />
      <circle cx="15.5" cy="13" r="2.6" fill="none" stroke="var(--color-q1)" strokeWidth="1.2" />
      <line x1="15.5" y1="10.4" x2="15.5" y2="15.6" stroke="var(--color-q1)" strokeWidth="1.2" />
    </svg>
  );
}
