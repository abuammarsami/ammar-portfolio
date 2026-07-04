import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, STIX_Two_Text } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { FooterTerminal } from "@/components/ui/footer-terminal";
import { Nav } from "@/components/ui/nav";
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
      className={`${stix.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
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
          <div id="main">{children}</div>
          <FooterTerminal />
        </ThemeProvider>
      </body>
    </html>
  );
}
