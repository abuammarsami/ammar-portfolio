/**
 * Voice mode text plumbing (plan-0005 P4) — pure and unit-tested. The
 * controller (components/ui/voice-controller.ts) owns the Web Speech API;
 * this module owns what gets spoken: never @@action lines, never markdown
 * syntax, and always sentence-sized utterances (Chrome's speechSynthesis
 * silently dies on long utterances — one sentence per utterance dodges it).
 */

/** Strip protocol lines and markdown noise so TTS reads prose, not syntax. */
export function sanitizeForSpeech(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("@@") && !line.trimStart().startsWith("→"))
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [label](url) → label
    .replace(/`([^`]*)`/g, "$1")
    .replace(/[*_#>]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_UTTERANCE = 220;

/** Sentence-sized chunks; oversized sentences split again at comma/space. */
export function splitSentences(text: string): string[] {
  const rough = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const s of rough) {
    if (s.length <= MAX_UTTERANCE) {
      out.push(s);
      continue;
    }
    let rest = s;
    while (rest.length > MAX_UTTERANCE) {
      const window = rest.slice(0, MAX_UTTERANCE);
      const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf(" "));
      const at = cut > 40 ? cut : MAX_UTTERANCE;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).replace(/^[,\s]+/, "");
    }
    if (rest) out.push(rest);
  }
  return out;
}
