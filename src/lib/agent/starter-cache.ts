import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { cache } from "react";
import { splitHeadingSections } from "@/lib/content/loader";

/**
 * Hot-path answer cache for the "Ask Ammar" chat (plan-0008 §4). The four
 * suggested-question chips are, by a wide margin, the most-clicked prompts —
 * and each one used to spend a full agentic Groq round-trip against the free
 * tier's 8k-tokens/minute ceiling, the source of the "rate limit — try again"
 * message. We serve those exact questions from curated content
 * (`content/agent-starters.md`) instead: instant, deterministic, and free.
 * Follow-up questions (any turn with history) still go to the live model.
 */

export type StarterAnswer = { question: string; answer: string };

const STARTERS_FILE = path.join(process.cwd(), "content", "agent-starters.md");

/**
 * Normalize a question to its match key: case-folded, smart-quotes flattened,
 * every run of non-alphanumerics collapsed to a single space. So `"What has he
 * shipped to production?"` and `what has he shipped to production` collide.
 */
export function normalizeStarterKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Split the starters markdown body into `{question, answer}` on each `## Heading`. */
export function parseStarters(body: string): StarterAnswer[] {
  return [...splitHeadingSections(body)]
    .map(([question, answer]) => ({ question: question.trim(), answer: answer.trim() }))
    .filter((s) => s.answer.length > 0);
}

/** Exact (normalized) match only — never fuzzy, so a near-miss falls through to the live model. */
export function matchStarter(question: string, entries: StarterAnswer[]): string | null {
  const key = normalizeStarterKey(question);
  return entries.find((e) => normalizeStarterKey(e.question) === key)?.answer ?? null;
}

/** Parsed starter answers, read once per request scope. Empty if the file is absent. */
export const getStarterAnswers = cache((): StarterAnswer[] => {
  if (!fs.existsSync(STARTERS_FILE)) return [];
  const { content } = matter(fs.readFileSync(STARTERS_FILE, "utf8"));
  return parseStarters(content);
});

/** The cached answer for an exact starter question, or null to fall through to the model. */
export function lookupStarterAnswer(question: string): string | null {
  return matchStarter(question, getStarterAnswers());
}
