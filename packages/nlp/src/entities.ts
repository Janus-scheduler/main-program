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
 * Full name and explicit aliases match as `exact`. Multi-token sub-phrases
 * (e.g. "MRI Scanner" from "MRI Scanner A") and allowed single tokens match as
 * non-exact.
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
  if (tokens.length > 1) {
    // Multi-token continuous sub-phrases (e.g. "MRI Scanner" from "MRI Scanner A")
    for (let len = tokens.length - 1; len >= 2; len--) {
      for (let i = 0; i <= tokens.length - len; i++) {
        const subphrase = tokens.slice(i, i + len).join(" ");
        push(subphrase, false);
      }
    }

    // Single tokens only if allowsPartialMatch(entry) is true
    if (allowsPartialMatch(entry)) {
      for (const token of tokens) {
        if (token.length >= MIN_PARTIAL_LENGTH) {
          push(token, false);
        }
      }
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

  // ── a sub-phrase match contradicted by what follows it ──────────────────
  //
  // `surfaceForms` deliberately emits continuous sub-phrases, so "book the MRI
  // Scanner" can match "MRI Scanner A". The cost is that "MRI Scanner C" ALSO
  // matches it — and silently books Scanner A, an instance the user did not ask
  // for. With both A and B in the catalog, which one wins is arbitrary.
  //
  // If a NON-EXACT match is immediately followed by a designator that does not
  // appear anywhere in that entry's name, the user named a specific instance we
  // do not have. Dropping the candidate lets the utterance fall through to the
  // unknown-resource question, which asks — rather than picking one.
  const contradicted = (c: EntityMatch): boolean => {
    if (c.exact) return false;
    const rest = text.slice(c.end);
    // An INSTANCE DESIGNATOR: a single letter, digits, or a letter/digit
    // combination — "A", "2", "1B", "C3". Deliberately NOT "any short token":
    // that swallowed ordinary function words, so "meet Alex and Priya" and
    // "a retro with Alex in Room A" lost their Alex, because "and" and "in"
    // are short too. Existing tests caught it.
    const next = /^\s+([A-Za-z]|\d{1,3}|\d+[A-Za-z]|[A-Za-z]\d{1,2})\b/.exec(
      rest,
    );
    if (!next) return false;
    const token = next[1].toLowerCase();
    const nameTokens = c.name.toLowerCase().split(/\s+/);
    return !nameTokens.includes(token);
  };
  const viable = candidates.filter((c) => !contradicted(c));

  // Longest span wins at a given position; exact beats partial on a tie.
  viable.sort(
    (a, b) =>
      b.end - b.start - (a.end - a.start) ||
      Number(b.exact) - Number(a.exact) ||
      a.start - b.start,
  );

  const taken: Array<[number, number]> = [];
  const claimedIds = new Set<string>();
  const kept: EntityMatch[] = [];

  for (const c of viable) {
    if (claimedIds.has(c.id)) continue;
    if (taken.some(([s, e]) => c.start < e && c.end > s)) continue;
    kept.push(c);
    taken.push([c.start, c.end]);
    claimedIds.add(c.id);
  }

  return kept.sort((a, b) => a.start - b.start);
}

/**
 * The frozen verb lexicon, flattened and longest-first by word count.
 *
 * Plus the HEAD of every multi-word phrase. The frozen list holds “set up”,
 * “block off”, “line up”, “take off” — but people drop the particle: “set a
 * meeting today at 10am”. With only the full phrase known, `set` was not a
 * verb, so the whole clause fell through and “set a meeting” became the
 * event's NAME. Worse, that name then spanned the verb, so editing the name
 * replaced the verb too and the sentence stopped classifying at all.
 *
 * Derived from the frozen list rather than hand-written, so the two cannot
 * drift. Longest first, so “set up” is still preferred over “set”.
 */
const ALL_VERB_PHRASES = [
  ...new Set(
    Object.values(INTENT_VERBS)
      .flat()
      .flatMap((phrase) =>
        phrase.includes(" ") ? [phrase, phrase.split(" ")[0]] : [phrase],
      ),
  ),
].sort(
  (a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length,
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

  // Whitespace may sit between the wrapper and the verb because something was
  // blanked out there — "can you not book …" has its negation cue removed
  // before this runs, leaving "can you     book …". Without skipping the gap
  // the verb goes unrecognised and lands in the event title.
  const afterWrapper = lowered.slice(consumed);
  const gap = afterWrapper.length - afterWrapper.trimStart().length;
  const afterGap = afterWrapper.slice(gap);
  for (const phrase of ALL_VERB_PHRASES) {
    if (new RegExp(String.raw`^${escapeRe(phrase)}\b`, "i").test(afterGap)) {
      consumed += gap + phrase.length;
      break;
    }
  }

  return leadingWhitespace + consumed;
}

/**
 * Function words that carry no title meaning once their object has been cut
 * out. "with Alex" leaves a dangling "with"; "in Room A" leaves "in".
 *
 * The naming verbs are here for a different reason: they INTRODUCE the title
 * rather than belonging to it. "book Room A ... called standup" was named
 * "called standup", carrying the user's grammar into the event's name.
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
  "called",
  "named",
  "titled",
  "entitled",
]);

/**
 * Nouns that introduce a name rather than being part of one.
 *
 * “cancel the event Pre-op Assessment” was read as an event literally called
 * “event Pre-op Assessment”, so the lookup found nothing and the
 * cancellation dead-ended.
 *
 * Dropped ONLY when more title words follow — the head-noun rule this file
 * already applies elsewhere. “team event” keeps its head noun; “the event X”
 * loses its classifier.
 */
const CLASSIFIER_NOUNS = new Set(["event", "appointment", "booking"]);

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
const EDGE_PUNCTUATION = new Set([
  " ",
  ",",
  ".",
  ";",
  ":",
  "!",
  "?",
  "-",
  '"',
  "'",
  "“",
  "”",
  "‘",
  "’",
  "`",
]);

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

  /**
   * Split into RUNS first, then tidy each one.
   *
   * A run is a stretch of surviving words with nothing claimed between them.
   * The span used to run from the first surviving token to the last and was
   * sliced out of the ORIGINAL text, so everything blanked in between came
   * back: “Book Operating Room 1, MRI Scanner A, and schedule Dr. Sarah Chen
   * … 5:00 PM to 6:00 PM Standup” yielded a title holding both rooms, both
   * people and the whole time phrase.
   *
   * Tidying per run rather than across the whole list matters too: “and” and
   * “for” are neither first nor last of the WHOLE token list, so they survived
   * and kept a junk run alive.
   */
  const claimedBetween = (from: number, to: number): boolean => {
    for (let i = from; i < to; i++) {
      if (!/\s/.test(text[i]) && /\s/.test(chars[i])) return true;
    }
    return false;
  };

  type Token = (typeof tokens)[number];
  const runs: Token[][] = [];
  for (const token of tokens) {
    const current = runs[runs.length - 1];
    const previous = current && current[current.length - 1];
    if (previous && !claimedBetween(previous.end, token.start))
      current.push(token);
    else runs.push([token]);
  }

  /** Drop a function word whose object has been cut away. */
  const tidy = (run: Token[]): Token[] => {
    let kept = run;
    let changed = true;
    while (changed && kept.length > 0) {
      changed = false;
      const next = kept.filter((token, i) => {
        if (!FUNCTION_WORDS.has(token.text.toLowerCase())) return true;
        const isFirst = i === 0;
        const isLast = i === kept.length - 1;
        const nextIsFunction =
          i + 1 < kept.length &&
          FUNCTION_WORDS.has(kept[i + 1].text.toLowerCase());
        return !(isFirst || isLast || nextIsFunction);
      });
      if (next.length !== kept.length) {
        kept = next;
        changed = true;
      }
    }
    while (kept.length > 0) {
      const first = kept[0].text.toLowerCase();
      if (LEADING_DETERMINERS.has(first) || FUNCTION_WORDS.has(first))
        kept = kept.slice(1);
      else break;
    }
    // A classifier noun INTRODUCING a name is not part of it; as the head of
    // one (“team event”) it is.
    while (
      kept.length > 1 &&
      CLASSIFIER_NOUNS.has(kept[0].text.toLowerCase())
    ) {
      kept = kept.slice(1);
    }
    return kept;
  };

  /** Nothing but command verbs or bare classifiers is not a name. */
  const isNoise = (run: Token[]): boolean =>
    run.every((t) => {
      const w = t.text.toLowerCase();
      return ALL_VERB_PHRASES.includes(w) || CLASSIFIER_NOUNS.has(w);
    });

  const candidates = runs
    .map(tidy)
    .filter((run) => run.length > 0 && !isNoise(run))
    .sort(
      (a, b) =>
        b[b.length - 1].end - b[0].start - (a[a.length - 1].end - a[0].start),
    );

  tokens = candidates[0] ?? [];

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
    // Collapsed, because the slice spans blanked-out ground. Anything removed
    // between two surviving words — a resource name, a time phrase, a negation
    // cue — leaves its width behind as spaces, and "do     book" is not a name
    // anyone typed. Inner punctuation is preserved; only runs of whitespace
    // are squeezed, so "Q3 - planning" survives intact.
    text: text.slice(start, end).replace(/\s+/g, " "),
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
/**
 * Replace each span with spaces, preserving the string's length.
 *
 * Length preservation is the whole point: every offset computed against the
 * original text stays valid against the result, so spans found in the blanked
 * copy can be sliced straight out of the original.
 */
function blankSpans(text: string, spans: TextSpan[]): string {
  if (spans.length === 0) return text;
  const chars = [...text];
  for (const span of spans) {
    for (let i = span.start; i < span.end && i < chars.length; i++) {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

export function extractEntities(
  text: string,
  options: ExtractOptions,
): ExtractedEntities {
  const catalog: EntityCatalog = options.catalog ?? {};

  // ── ORDER IS LOAD-BEARING: catalog first, time second ───────────────────
  //
  // Time extraction used to run on the raw text, before anything knew which
  // words belonged to a resource. It could therefore eat part of a resource
  // NAME:
  //
  //   "book Operating Room 1 August 25th at 9am"
  //      → monthDate "1 August"   ← the room's number, plus the month
  //      → booked 1 August, and "25th" fell through and became the title
  //
  // Matching the catalog first and blanking those spans removes the ambiguity
  // at source: the digits in "Operating Room 1" are gone before any date
  // pattern can see them.
  const resources = matchCatalog(text, catalog.resources ?? []);
  const participants = matchCatalog(text, catalog.participants ?? []);

  // A resource and a participant can both claim the same words (a room called
  // "Design" and a team called "Design"). Resources win: a room booking is the
  // more specific reading, and the participant list is usually the longer one.
  const resourceSpans = resources.map((r) => [r.start, r.end] as const);
  const dedupedParticipants = participants.filter(
    (p) => !resourceSpans.some(([s, e]) => p.start < e && p.end > s),
  );

  // Space-fill rather than delete, so every offset still indexes into `text`.
  // `titleSpan` and the question `replaceSpan` are both slices of the ORIGINAL
  // string; shortening it here would silently move them. Same technique as
  // `stripNegationCues` in `session.ts`, for the same reason.
  const withoutEntities = blankSpans(text, [
    ...resources,
    ...dedupedParticipants,
  ]);

  const timeSpan = parseTimeSpan(withoutEntities);
  const time = resolveTime(timeSpan, {
    now: options.now,
    timezone: options.timezone,
  });

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
