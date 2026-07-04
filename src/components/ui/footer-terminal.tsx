const PROMPT = "ammar@portfolio:~$";

export function FooterTerminal() {
  return (
    <footer className="border-t rule-hair">
      <div className="mx-auto max-w-4xl space-y-1.5 px-6 py-8 font-mono text-sm">
        <p className="text-muted">
          {PROMPT} <span className="text-ink">contact --list</span>
        </p>
        <p>
          <a href="mailto:abuammarsami@gmail.com" className="text-q0 hover:underline">
            abuammarsami@gmail.com
          </a>
        </p>
        <p>
          <a
            href="https://github.com/abuammarsami"
            className="text-q1 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/abuammarsami
          </a>
        </p>
        <p>
          <a
            href="https://linkedin.com/in/abu-ammar/"
            className="text-q0 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            linkedin.com/in/abu-ammar
          </a>
        </p>
        <p className="pt-2 text-muted">
          {PROMPT} <span className="animate-pulse">▮</span>
        </p>
      </div>
    </footer>
  );
}
