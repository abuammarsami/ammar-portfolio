"use client";

import { useRef, useState } from "react";

import { AnswerBlocks } from "./answer-blocks";

/**
 * The fit-report island (ADR-0009) — the only client component on /agents.
 * Streams /api/fit as plain text; rendering shares interview mode's
 * markdown-subset renderer (answer-blocks.tsx).
 */

const MAX = 4000;

type Phase = "idle" | "streaming" | "done" | "error";

export function FitReport({ placeholder }: { placeholder: string }) {
  const [brief, setBrief] = useState("");
  const [audience, setAudience] = useState<"recruiter" | "professor">("recruiter");
  const [phase, setPhase] = useState<Phase>("idle");
  const [report, setReport] = useState("");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [company, setCompany] = useState("");
  const [pitch, setPitch] = useState<{ phase: "idle" | "working" | "done" | "error"; text: string }>({
    phase: "idle",
    text: "",
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    if (phase === "streaming") {
      abortRef.current?.abort();
      return;
    }
    setReport("");
    setNote("");
    setCopied(false);
    setPitch({ phase: "idle", text: "" });
    setLinkCopied(false);
    setPhase("streaming");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/fit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, audience }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setNote(await res.text());
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setReport(acc);
      }
      setPhase("done");
    } catch {
      setNote("stopped");
      setPhase(report ? "done" : "idle");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const mintPitch = async () => {
    setPitch({ phase: "working", text: "" });
    try {
      const res = await fetch("/api/pitch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, company }),
      });
      const text = await res.text();
      if (!res.ok) {
        setPitch({ phase: "error", text });
        return;
      }
      const { url } = JSON.parse(text) as { url: string };
      setPitch({ phase: "done", text: `${location.origin}${url}` });
    } catch {
      setPitch({ phase: "error", text: "network hiccup — try again" });
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(pitch.text);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };

  const valid = brief.trim().length >= 40 && brief.length <= MAX;

  return (
    <div>
      <label htmlFor="fit-brief" className="sr-only">
        Job description or research topic
      </label>
      <textarea
        id="fit-brief"
        value={brief}
        onChange={(e) => setBrief(e.target.value.slice(0, MAX))}
        placeholder={placeholder}
        rows={7}
        className="w-full resize-y border border-muted/30 bg-surface/50 p-4 font-mono text-sm leading-relaxed focus:border-q0 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-sm">
        <div role="radiogroup" aria-label="Audience" className="flex border border-muted/30">
          {(["recruiter", "professor"] as const).map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={audience === a}
              onClick={() => setAudience(a)}
              className={`px-3 py-1.5 ${audience === a ? "bg-q0/15 text-q0" : "text-muted hover:text-ink"}`}
            >
              {a === "recruiter" ? "I'm hiring" : "I'm a professor"}
            </button>
          ))}
        </div>
        <button
          onClick={run}
          disabled={phase !== "streaming" && !valid}
          className="border border-q0/60 px-4 py-1.5 text-q0 hover:bg-q0/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "streaming" ? "■ stop" : "run fit report"}
        </button>
        <span className="text-xs text-muted">
          {brief.length > 0 && !valid && brief.trim().length < 40 ? "a little more detail (≥40 chars)" : `${brief.length}/${MAX}`}
        </span>
      </div>

      {(report || note) && (
        <div className="mt-6 border-l-2 border-q0/40 pl-5 font-serif leading-relaxed">
          {note && <p className="font-mono text-sm text-muted">{note}</p>}
          <AnswerBlocks text={report} />
          {phase === "streaming" && <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-q0/70" aria-hidden />}
          {phase === "done" && report && (
            <button onClick={copy} className="mt-4 font-mono text-xs text-muted hover:text-ink">
              {copied ? "copied ✓" : "⧉ copy report"}
            </button>
          )}

          {/* pitch link: turn this report into a persistent page to forward (ADR-0011) */}
          {phase === "done" && report && audience === "recruiter" && (
            <div className="mt-6 border-t rule-hair pt-4 font-mono text-sm">
              {pitch.phase === "done" ? (
                <p className="break-all">
                  <a href={pitch.text} className="text-q0 hover:underline">
                    {pitch.text}
                  </a>{" "}
                  <button onClick={copyLink} className="ml-2 text-muted hover:text-ink">
                    {linkCopied ? "copied ✓" : "⧉ copy link"}
                  </button>
                  <span className="mt-1 block text-xs text-muted">
                    a shareable pitch page for this role — forward it to your hiring manager; expires in 90 days
                  </span>
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <label htmlFor="pitch-company" className="sr-only">
                    Company name
                  </label>
                  <input
                    id="pitch-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value.slice(0, 64))}
                    placeholder="company name"
                    className="border border-muted/30 bg-surface/50 px-3 py-1.5 focus:border-q0 focus:outline-none"
                  />
                  <button
                    onClick={mintPitch}
                    disabled={pitch.phase === "working" || company.trim().length < 2}
                    className="border border-q1/60 px-4 py-1.5 text-q1 hover:bg-q1/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pitch.phase === "working" ? "minting…" : "→ create shareable pitch link"}
                  </button>
                  {pitch.phase === "error" && <span className="text-xs text-muted">{pitch.text}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
