/**
 * Entity extraction — who, what and where, alongside `datetime.ts`'s when.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  NEW BEHAVIOUR, ADDITIVE ONLY.
 *
 *  The frozen pipeline detects resources and participants purely in order to
 *  DELETE them (`stripSlots`), because slot noise dilutes the intent signal.
 *  Nothing in it ever reports WHO or WHERE. This module does the mirror image:
 *  same idea of what a slot is, opposite outcome — it captures the spans.
 *
 *  It never runs inside `classify()` or any gate and cannot change a routing
 *  decision.
 * ══════════════════════════════════════════════════════════════════════════
 *
 * The catalog is a PARAMETER, not an import. Two reasons, both load-bearing:
 *
 *   1. It is what keeps `@janus-scheduler/nlp` free of any dependency on
 *      `@janus-scheduler/core`. The host passes its live resources in.
 *   2. The frozen `RESOURCE_NAMES` / `PARTICIPANT_NAMES` lists are a research
 *      corpus — "sarah", "alice", "marketing", "parking". Matching a real
 *      user's utterance against those would produce a parse card full of
 *      names nobody in the organisation has ever heard of.
 */

import { INTENT_VERBS, LEADING_WRAPPERS } from "./constants";
import { parseTimeSpan, resolveTime } from "./datetime";
import { escapeRe } from "./normalize";
import type {
  CatalogEntry,
  EntityCatalog,
  EntityMatch,
  ExtractOptions,
  ExtractedEntities,
  TextSpan,
} from "./types";

/** Shortest partial (first-name style) token that may match on its own. */
const MIN_PARTIAL_LENGTH = 3;

/**
 * May a single token of this entry's name match on its own?
 *
 * Partial matching is what turns "with Alex" into `Alex Rivera`, so people need
 * it. Everything else must NOT have it, and the reason is worth stating because
 * the obvious alternative fails:
 *
 *   A blocklist of "words too common to match on" cannot work. A team called
 *   "Design Team" would let a bare "design" match, and "schedule a design sync"
 *   then reports a participant nobody mentioned — and eats the word out of the
 *   title. But "design" is also a perfectly legitimate name token. No fixed
 *   word list resolves that; only knowing what KIND of thing the entry is does.
 *
 * So it is opt-in, defaulting to person-typed entries. A caller with unusual
 * data can set `matchPartial` explicitly either way.
 */
function allowsPartialMatch(entry: CatalogEntry): boolean {
  return entry.matchPartial ?? entry.type === "person";
}

/**
 * Every surface form a catalog entry can be recognised by, longest first.
 *
 * Full name and explicit aliases match as `exact`. A single name token matches
 * as non-exact, so a caller can require confirmation for those — a first-name
 * hit is a genuinely weaker signal when two people share one.
 */
function surfaceForms(
  entry: CatalogEntry,
): Array<{ form: string; exact: boolean }> {
  const forms: Array<{ form: string; exact: boolean }> = [];
  const seen = new Set<string>();

  const push = (form: string, exact: boolean): void => {
    const trimmed = form.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length === 0 || seen.has(key)) return;
    seen.add(key);
    forms.push({ form: trimmed, exact });
  };

  push(entry.name, true);
  for (const alias of entry.aliases ?? []) push(alias, true);

  const tokens = entry.name.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && allowsPartialMatch(entry)) {
    for (const token of tokens) {
      if (token.length >= MIN_PARTIAL_LENGTH) push(token, false);
    }
  }

  // Longest first, so "Conference Room B" is preferred over "Conference Room".
  forms.sort((a, b) => b.form.length - a.form.length);
  return forms;
}

/**
 * Wrap a literal in word boundaries — but only on the ends where one can
 * actually match.
 *
 * `\b` sits between a word and a non-word character. A name like
 * "Room (B) [main]" ends in `]`, so a trailing `\b` would require the NEXT
 * character to be a word character, and the name would never match at the end
 * of a sentence or before a space. Applying the anchor only where the form's
 * own edge is alphanumeric keeps "Sam" from matching inside "Samsung" while
 * letting punctuation-edged names match at all.
 */
function boundedPattern(form: string): string {
  const leading = /^\w/.test(form) ? String.raw`\b` : "";
  const trailing = /\w$/.test(form) ? String.raw`\b` : "";
  return leading + escapeRe(form) + trailing;
}

/**
 * Find catalog entries mentioned in `text`.
 *
 * Longest-match-first across the whole catalog, and each character of the
 * input is consumed at most once — so "Conference Room B" produces one match,
 * not three overlapping ones. An entry already matched is not matched again.
 */
function matchCatalog(text: string, entries: CatalogEntry[]): EntityMatch[] {
  const candidates: Array<EntityMatch> = [];

  for (const entry of entries) {
    for (const { form, exact } of surfaceForms(entry)) {
      const re = new RegExp(boundedPattern(form), "gi");
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        candidates.push({
          id: entry.id,
          name: entry.name,
          type: entry.type,
          exact,
          text: m[0],
          start: m.index,
          end: m.index + m[0].length,
        });
        if (m[0].length === 0) re.lastIndex++;
      }
    }
  }

  // Longest span wins at a given position; exact beats partial on a tie.
  candidates.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      Number(b.exact) - Number(a.exact) ||
      a.start - b.start,
  );

  const taken: Array<[number, number]> = [];
  const claimedIds = new Set<string>();
  const kept: EntityMatch[] = [];

  for (const c of candidates) {
    if (claimedIds.has(c.id)) continue;
    if (taken.some(([s, e]) => c.start < e && c.end > s)) continue;
    kept.push(c);
    taken.push([c.start, c.end]);
    claimedIds.add(c.id);
  }

  return kept.sort((a, b) => a.start - b.start);
}

/** The frozen verb lexicon, flattened and longest-first by word count. */
const ALL_VERB_PHRASES = [...new Set(Object.values(INTENT_VERBS).flat())].sort(
  (a, b) => b.split(" ").length - a.split(" ").length,
);

/**
 * How many leading characters of `text` are politeness wrapper + command verb.
 *
 * Mirrors `headVerbPhraseLexicon`'s first two steps, but reports the PREFIX
 * LENGTH rather than the verb — the title lives in what follows, and a length
 * lets the caller blank the prefix in place, keeping every other span's offsets
 * valid. Kept separate from `preprocess.ts` so nothing here can perturb the
 * frozen function.
 *
 * Returned as an offset into the ORIGINAL string, leading whitespace included,
 * so it can be applied directly to the untrimmed input.
 */
export function leadingVerbPrefixLength(text: string): number {
  const leadingWhitespace = text.length - text.trimStart().length;
  const lowered = text.trimStart().toLowerCase();

  let consumed = 0;
  for (const wrapper of LEADING_WRAPPERS) {
    if (lowered.startsWith(wrapper)) {
      consumed = wrapper.length; // wrappers carry their own trailing space
      break;
    }
  }

  const afterWrapper = lowered.slice(consumed);
  for (const phrase of ALL_VERB_PHRASES) {
    if (
      new RegExp(String.raw`^${escapeRe(phrase)}\b`, "i").test(afterWrapper)
    ) {
      consumed += phrase.length;
      break;
    }
  }

  return leadingWhitespace + consumed;
}

/**
 * Function words that carry no title meaning once their object has been cut
 * out. "with Alex" leaves a dangling "with"; "in Room A" leaves "in".
 */
const FUNCTION_WORDS = new Set([
  "with",
  "in",
  "at",
  "on",
  "for",
  "under",
  "to",
  "from",
  "about",
  "by",
  "and",
]);

/** Determiners stripped from the front of a finished title. */
const LEADING_DETERMINERS = new Set([
  "a",
  "an",
  "the",
  "my",
  "our",
  "your",
  "some",
  "new",
]);

/**
 * Punctuation stranded at a title's edges. Inner characters are preserved, so
 * "all-hands" and "1:1" survive intact.
 *
 * Trimmed with an index scan rather than `/^[...]+|[...]+$/` — the anchored
 * alternation form backtracks super-linearly on a long punctuation run.
 */
const EDGE_PUNCTUATION = new Set([" ", ",", ".", ";", ":", "!", "?", "-"]);

/**
 * Blank out the given spans, then tidy what remains into a title.
 *
 * Spans are blanked to spaces rather than spliced out: they were computed
 * against the original string and are not processed in order, so deleting would
 * invalidate every later offset.
 *
 * The tidy-up is done over TOKENS, not with regexes. An earlier version used a
 * chain of alternation patterns in a fixpoint loop; those had super-linear
 * backtracking on adversarial input and were harder to reason about than the
 * rule they encode, which is simply: drop a function word when whatever it
 * pointed at is gone.
 */
function titleFromRemainder(
  text: string,
  spans: TextSpan[],
  verbPrefixLength: number,
): TextSpan | undefined {
  const chars = [...text];
  for (const span of spans) {
    for (let i = span.start; i < span.end && i < chars.length; i++) {
      chars[i] = " ";
    }
  }
  for (let i = 0; i < verbPrefixLength && i < chars.length; i++) chars[i] = " ";

  const blanked = chars.join("");
  let tokens: Array<{ text: string; start: number; end: number }> = [];
  const re = /[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blanked)) !== null) {
    if (/[a-z0-9]/i.test(m[0])) {
      tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
  }

  let changed = true;
  while (changed && tokens.length > 0) {
    changed = false;
    const kept = tokens.filter((token, i) => {
      if (!FUNCTION_WORDS.has(token.text.toLowerCase())) return true;
      const isFirst = i === 0;
      const isLast = i === tokens.length - 1;
      const nextIsFunction =
        i + 1 < tokens.length &&
        FUNCTION_WORDS.has(tokens[i + 1].text.toLowerCase());
      return !(isFirst || isLast || nextIsFunction);
    });
    if (kept.length !== tokens.length) {
      tokens = kept;
      changed = true;
    }
  }

  while (
    tokens.length > 0 &&
    LEADING_DETERMINERS.has(tokens[0].text.toLowerCase())
  ) {
    tokens.shift();
  }

  if (tokens.length === 0) return undefined;

  let start = tokens[0].start;
  let end = tokens[tokens.length - 1].end;

  while (
    start < end &&
    (EDGE_PUNCTUATION.has(text[start]) || /\s/.test(text[start]))
  )
    start++;
  while (
    end > start &&
    (EDGE_PUNCTUATION.has(text[end - 1]) || /\s/.test(text[end - 1]))
  )
    end--;

  if (start >= end) return undefined;

  return {
    text: text.slice(start, end),
    start,
    end,
  };
}

/**
 * Pull the time, the people, the resources and the title out of an utterance.
 *
 * Pure: no I/O, no store, no globals. `now` and `timezone` are injected so
 * results are deterministic and testable.
 *
 * Nothing here is confident enough to act on by itself — that is the point.
 * The output populates a parse card the user confirms before anything is
 * written, and every value the resolver had to invent is listed in
 * `time.assumptions`.
 */
export function extractEntities(
  text: string,
  options: ExtractOptions,
): ExtractedEntities {
  const catalog: EntityCatalog = options.catalog ?? {};

  const timeSpan = parseTimeSpan(text);
  const time = resolveTime(timeSpan, {
    now: options.now,
    timezone: options.timezone,
  });

  const resources = matchCatalog(text, catalog.resources ?? []);
  const participants = matchCatalog(text, catalog.participants ?? []);

  // A resource and a participant can both claim the same words (a room called
  // "Design" and a team called "Design"). Resources win: a room booking is the
  // more specific reading, and the participant list is usually the longer one.
  const resourceSpans = resources.map((r) => [r.start, r.end] as const);
  const dedupedParticipants = participants.filter(
    (p) => !resourceSpans.some(([s, e]) => p.start < e && p.end > s),
  );

  const spans: TextSpan[] = [
    ...(timeSpan ? timeSpan.mentions : []),
    ...resources,
    ...dedupedParticipants,
  ];

  const titleSpan = titleFromRemainder(
    text,
    spans,
    leadingVerbPrefixLength(text),
  );

  return {
    timeSpan,
    time,
    resources,
    participants: dedupedParticipants,
    title: titleSpan?.text,
    titleSpan,
  };
}
