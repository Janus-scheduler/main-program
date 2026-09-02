/**
 * Text normalization — ALGORITHM.md §1.
 *
 * Ported from `bin/index.js` lines 42-101. Step order is load-bearing: each
 * step operates on the previous step's output, and moving punctuation
 * stripping ahead of contraction expansion would destroy every apostrophe
 * before `CONTRACTIONS` ever saw it.
 */

import { CONTRACTIONS, NO_APOSTROPHE_CONTRACTIONS } from "./constants";

/** Escape a literal string for safe embedding in a RegExp. */
export function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a longest-match-first alternation from a word list.
 *
 * Sorting longest-first is what makes "conference room b" win over "room" —
 * JS regex alternation is first-match, not longest-match, so the ordering here
 * IS the matching semantics.
 */
export function alternation(
  words: string[],
  { boundary = true }: { boundary?: boolean } = {},
): string {
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const body = sorted.map(escapeRe).join("|");
  return boundary ? `\\b(?:${body})\\b` : body;
}

const CONTRACTION_RE = new RegExp(
  Object.keys(CONTRACTIONS)
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join("|"),
  "g",
);

// Not escaped: every key is plain [a-z]+, and the original does not escape
// them either. Kept identical rather than "hardened" — see the frozen banner
// in constants.ts.
const NO_APOSTROPHE_RE = new RegExp(
  "\\b(" +
    Object.keys(NO_APOSTROPHE_CONTRACTIONS)
      .sort((a, b) => b.length - a.length)
      .join("|") +
    ")\\b",
  "g",
);

const PUNCT_RE = /[^a-z0-9\s]/g;

/**
 * Whitespace collapse. Global-flagged and shared with `preprocess.ts`, which is
 * safe because both uses go through `String.prototype.replace` — `replace`
 * resets `lastIndex` on a /g regex, unlike `test`/`exec`.
 */
export const WS_RE = /\s+/g;

/**
 * Lowercase → `w/`→`with ` → apostrophe'd contractions → apostrophe-less
 * contractions → strip punctuation → collapse whitespace.
 */
export function normalize(text: string): string {
  let s = text.toLowerCase();
  s = s.replace(/\bw\//g, "with ");
  s = s.replace(CONTRACTION_RE, (m) => CONTRACTIONS[m]);
  s = s.replace(NO_APOSTROPHE_RE, (m) => NO_APOSTROPHE_CONTRACTIONS[m]);
  s = s.replace(PUNCT_RE, " ");
  s = s.replace(WS_RE, " ").trim();
  return s;
}
