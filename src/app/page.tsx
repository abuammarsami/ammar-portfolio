export const dynamic = "force-static";

// Placeholder home — replaced in Phase 3 with hero + selected work + research.
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="font-mono text-sm text-muted">ammar@portfolio:~$ init</p>
      <h1 className="mt-4 font-serif text-4xl">Md. Abu Ammar</h1>
      <p className="mt-2 text-muted">
        Software engineer &amp; quantum ML researcher. Site under construction — Phase 0.
      </p>
    </main>
  );
}
