/**
 * WordPiece tokenization — ALGORITHM.md §2.
 *
 * Greedy longest-match-first, BERT-style. Ported from `bin/index.js` 107-137.
 */

import { MAX_WORD_CHARS } from "./constants";

/**
 * Longest vocab-present substring of `word` starting at `start`, or `null`.
 * Continuation pieces (`start > 0`) carry the `##` prefix.
 */
function longestMatch(
  word: string,
  start: number,
  tokenToId: Map<string, number>,
): string | null {
  let end = word.length;
  while (start < end) {
    const substr =
      start > 0 ? "##" + word.slice(start, end) : word.slice(start, end);
    if (tokenToId.has(substr)) return substr;
    end--;
  }
  return null;
}

/**
 * Tokenize one word.
 *
 * LOAD-BEARING (ALGORITHM.md §2): if ANY position finds no match, the WHOLE
 * word becomes `[UNK]` — not a partial split with an `[UNK]` in the middle.
 * The early `return [unkId]` inside the loop is that rule, and discarding the
 * pieces already pushed into `ids` is the point of it.
 */
function wordpieceWord(
  word: string,
  tokenToId: Map<string, number>,
  unkId: number,
): number[] {
  if (word.length > MAX_WORD_CHARS) return [unkId];
  const ids: number[] = [];
  let start = 0;
  while (start < word.length) {
    const found = longestMatch(word, start, tokenToId);
    if (found === null) return [unkId];
    ids.push(tokenToId.get(found) as number);
    // Continuation pieces carry a 2-char "##" prefix that is not part of the
    // consumed text, so it must not count toward the advance.
    start += found.length - (start > 0 ? 2 : 0);
  }
  return ids;
}

/** Tokenize an already-normalized string. Empty input → no ids. */
export function wordpiece(
  normalizedText: string,
  tokenToId: Map<string, number>,
  unkId: number,
): number[] {
  if (!normalizedText) return [];
  const ids: number[] = [];
  for (const word of normalizedText.split(" ")) {
    if (word) ids.push(...wordpieceWord(word, tokenToId, unkId));
  }
  return ids;
}
