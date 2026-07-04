/** Fig. 1 — KioskVisionAI architecture (real system: 120+ kiosks → Azure → Vision AI). */
export function FigKioskVision() {
  const box = "fill-[var(--color-bg)] stroke-[var(--color-muted)]";
  const label = "fill-[var(--color-ink)]";
  const small = "fill-[var(--color-muted)]";
  return (
    <svg viewBox="0 0 520 150" role="img" aria-label="KioskVisionAI architecture: 120+ kiosks send screenshots to Azure Blob Storage; queues fan out to a Vision AI analysis worker; anomalies trigger notifications and automated recovery." className="w-full">
      {/* kiosk fleet */}
      <rect x="8" y="46" width="92" height="58" rx="3" className={box} strokeWidth="1" />
      <text x="54" y="70" textAnchor="middle" fontSize="11" fontFamily="var(--font-mono)" className={label}>120+ kiosks</text>
      <text x="54" y="88" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className={small}>60+ orgs, US</text>
      {/* blob + queue */}
      <rect x="140" y="20" width="96" height="44" rx="3" className={box} strokeWidth="1" />
      <text x="188" y="46" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" className={label}>Blob Storage</text>
      <rect x="140" y="86" width="96" height="44" rx="3" className={box} strokeWidth="1" />
      <text x="188" y="112" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" className={label}>Queues</text>
      {/* vision worker */}
      <rect x="278" y="46" width="104" height="58" rx="3" fill="var(--color-bg)" stroke="var(--color-q0)" strokeWidth="1.4" />
      <text x="330" y="70" textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-q0)">Vision AI</text>
      <text x="330" y="88" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className={small}>anomaly detection</text>
      {/* outcomes */}
      <rect x="424" y="20" width="88" height="44" rx="3" fill="var(--color-bg)" stroke="var(--color-q1)" strokeWidth="1.2" />
      <text x="468" y="38" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-q1)">notify admins</text>
      <text x="468" y="52" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className={small}>hijack alerts</text>
      <rect x="424" y="86" width="88" height="44" rx="3" fill="var(--color-bg)" stroke="var(--color-q1)" strokeWidth="1.2" />
      <text x="468" y="104" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" fill="var(--color-q1)">auto-recover</text>
      <text x="468" y="118" textAnchor="middle" fontSize="9" fontFamily="var(--font-mono)" className={small}>reboot · heal</text>
      {/* flows */}
      <g stroke="var(--color-muted)" strokeWidth="1" fill="var(--color-muted)">
        <line x1="100" y1="62" x2="136" y2="42" /><polygon points="136,42 128,42 132,48" />
        <line x1="100" y1="88" x2="136" y2="108" /><polygon points="136,108 128,108 132,102" />
        <line x1="236" y1="42" x2="274" y2="62" /><polygon points="274,62 266,62 270,56" />
        <line x1="236" y1="108" x2="274" y2="88" /><polygon points="274,88 266,88 270,94" />
        <line x1="382" y1="62" x2="420" y2="42" /><polygon points="420,42 412,42 416,48" />
        <line x1="382" y1="88" x2="420" y2="108" /><polygon points="420,108 412,108 416,102" />
      </g>
    </svg>
  );
}
