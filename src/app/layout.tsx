import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, STIX_Two_Text } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { WebmcpProvider } from "@/components/agent/webmcp-provider";
import { CommandPalette } from "@/components/palette/command-palette";
import { FooterTerminal } from "@/components/ui/footer-terminal";
import { Nav } from "@/components/ui/nav";
import { Vt } from "@/components/ui/vt";
import { DEFAULT_LENS, LENS_INIT_SCRIPT } from "@/lib/agent/lens";
import { LINKS, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "@/styles/globals.css";

const stix = STIX_Two_Text({
  subsets: ["latin"],
  variable: "--font-stix",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Md. Abu Ammar",
  },
  description: SITE_DESCRIPTION,
  // per-route canonical, resolved against metadataBase (launch checklist)
  alternates: { canonical: "./" },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Md. Abu Ammar",
  jobTitle: "Software Engineer",
  worksFor: { "@type": "Organization", name: "Masjid Solutions" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "North South University" },
  email: `mailto:${LINKS.email}`,
  url: SITE_URL,
  sameAs: [LINKS.github, LINKS.linkedin],
  knowsAbout: [
    "Backend engineering",
    ".NET",
    "Microsoft Azure",
    "Distributed systems",
    "Machine learning",
    "Quantum machine learning",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-lens={DEFAULT_LENS}
      className={`${stix.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        {/* pre-paint lens restore (plan-0005) — same trick next-themes uses for data-theme */}
        <script dangerouslySetInnerHTML={{ __html: LENS_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-1.5 focus:font-mono focus:text-sm"
          >
            Skip to content
          </a>
          <Nav />
          {/* route-level cross-fade (P5); shared-element morphs opt in via named <Vt>s */}
          <Vt>
            <div id="main">{children}</div>
          </Vt>
          {/* contact links are server HTML — reachable without JS; only the
              prompt row below them is a client island (plan-0006 budget diet) */}
          <footer className="border-t rule-hair no-print">
            <div className="mx-auto max-w-4xl space-y-1.5 px-6 py-8 font-mono text-sm">
              <p className="text-muted">
                ammar@portfolio:~$ <span className="text-ink">contact --list</span>
              </p>
              <p>
                <a href="mailto:abuammarsami@gmail.com" className="text-q0 hover:underline">
                  abuammarsami@gmail.com
                </a>
              </p>
              <p>
                <a href="https://github.com/abuammarsami" className="text-q1 hover:underline" rel="noopener noreferrer" target="_blank">
                  github.com/abuammarsami
                </a>
              </p>
              <p>
                <a href="https://linkedin.com/in/abu-ammar/" className="text-q0 hover:underline" rel="noopener noreferrer" target="_blank">
                  linkedin.com/in/abu-ammar
                </a>
              </p>
              <p>
                <a href="/colophon" className="text-muted hover:text-q0 hover:underline">
                  colophon — how this site is built
                </a>
              </p>
              <FooterTerminal />
            </div>
          </footer>
          <CommandPalette />
          <WebmcpProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
