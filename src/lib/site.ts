/** Site-wide constants. Stable production domain. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://abuammar.engineer";

export const SITE_NAME = "Md. Abu Ammar";
export const SITE_TITLE = "Md. Abu Ammar — Software Engineer · Quantum ML Researcher";
export const SITE_DESCRIPTION =
  "Backend engineer (.NET, Azure, distributed systems) and quantum machine learning researcher.";

export const LINKS = {
  github: "https://github.com/abuammarsami",
  linkedin: "https://linkedin.com/in/abu-ammar/",
  email: "abuammarsami@gmail.com",
} as const;
