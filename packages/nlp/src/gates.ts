/**
 * Gate / routing layer — ALGORITHM.md §8.
 *
 * Ported from `bin/index.js` 297-372.
 *
 * LOAD-BEARING (§8 header): every gate here runs on the **pre-strip raw text**,
 * never on `stripSlots(text)`. `stripSlots` deletes exactly the signals the
 * anchor gates look for, so feeding it a stripped string would make gate 3
 * reject nearly everything. `routeQuery` passes the original `text` through
 * untouched for this reason.
 */

import {
  CONF_FLOOR,
  MARGIN_FLOOR,
  EVENT_NOUNS,
  NO_APOSTROPHE_CONTRACTIONS,
  PARTICIPANT_NAMES,
  RESOURCE_NAMES,
} from "./constants";
import type {
  Artifacts,
  ClassifyResult,
  Prototype,
  RouteResult,
} from "./types";
import { alternation, escapeRe } from "./normalize";
import { TIME_RE_SOURCE } from "./preprocess";
import { classify } from "./classify";

const RESOURCE_RE = new RegExp(alternation(RESOURCE_NAMES), "i");
const PARTICIPANT_RE = new RegExp(alternation(PARTICIPANT_NAMES), "i");
const EVENT_NOUN_RE = new RegExp(alternation(EVENT_NOUNS), "i");

/**
 * Anchor-detection time regex.
 *
 * Built from `preprocess.TIME_RE_SOURCE`, which INCLUDES the `_LEAD` prefix.
 * That is intentional and matches `gates.py`, which reuses
 * `preprocess._TIME_RE` directly rather than re-deriving a lead-free variant —
 * so "at 3pm" and "3pm" are both anchors, and the two modules can never drift.
 *
 * Flags are `i` only, deliberately: the original shared the `/gi` instance with
 * `stripSlots` and had to reset `lastIndex` by hand before every `.test()`
 * (bin/index.js L313) because `.test` on a global regex is stateful. A
 * non-global instance is stateless by construction. Identical behaviour, one
 * fewer way to break it.
 */
const TIME_ANCHOR_RE = new RegExp(TIME_RE_SOURCE, "i");

export function hasTimeAnchor(text: string): boolean {
  return TIME_ANCHOR_RE.test(text);
}
export function hasResourceAnchor(text: string): boolean {
  return RESOURCE_RE.test(text);
}
export function hasParticipantAnchor(text: string): boolean {
  return PARTICIPANT_RE.test(text);
}
export function hasEventNoun(text: string): boolean {
  return EVENT_NOUN_RE.test(text);
}

/** Time OR resource OR participant OR event-noun. Gate 3's condition. */
export function hasDomainAnchor(text: string): boolean {
  return (
    hasTimeAnchor(text) ||
    hasResourceAnchor(text) ||
    hasParticipantAnchor(text) ||
    hasEventNoun(text)
  );
}

/**
 * Negation cues, DERIVED from `NO_APOSTROPHE_CONTRACTIONS` rather than
 * re-listed by hand (same as `gates.py`): every entry whose expansion ends in
 * `" not"`. Keeping this derived is what stops the two lists from drifting
 * apart when a contraction is added.
 */
const NEGATION_WORDS = Object.entries(NO_APOSTROPHE_CONTRACTIONS)
  .filter(([, v]) => v.endsWith(" not"))
  .map(([k]) => k);

const NEGATION_RE = new RegExp(
  "n't|\\b(?:" +
    [...NEGATION_WORDS]
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join("|") +
    ")\\b|\\bnot\\b|\\bno longer\\b|\\bno more\\b",
  "i",
);

export function hasNegation(text: string): boolean {
  return NEGATION_RE.test(text);
}

/**
 * Layered rejection: cheapest and most deterministic gate first, stop at the
 * first one that fires. The order in ALGORITHM.md §8's table is the order here
 * and is not interchangeable — e.g. gate 2 (`intent === "none"`) must run after
 * gate 1, because a low-confidence `none` should be reported as a confidence
 * failure, not as a nearest-neighbour failure.
 */
export function routeFromClassification(
  result: ClassifyResult,
  text: string,
  confFloor: number = CONF_FLOOR,
  marginFloor: number = MARGIN_FLOOR,
): RouteResult {
  if (hasNegation(text)) {
    return {
      ...result,
      route: "CLARIFY",
      gate: "negation",
      reason:
        "negation detected - confirm rather than silently invert the intent",
    };
  }
  if (result.confidence < confFloor) {
    return {
      ...result,
      route: "REJECT",
      gate: "gate1_confidence",
      reason: `confidence ${result.confidence.toFixed(2)} below floor ${confFloor}`,
    };
  }
  if (result.intent === "none") {
    return {
      ...result,
      route: "REJECT",
      gate: "gate2_nearest_none",
      reason: "nearest neighbour is none",
    };
  }
  if (!hasDomainAnchor(text)) {
    return {
      ...result,
      route: "REJECT",
      gate: "gate3_no_anchor",
      reason:
        "no domain anchor (no time, resource/participant, or scheduling noun)",
    };
  }
  if (hasResourceAnchor(text) && !hasTimeAnchor(text) && !hasEventNoun(text)) {
    return {
      ...result,
      route: "CLARIFY",
      gate: "gate3b_resource_only",
      reason:
        "resource anchor present but no time/event context - the parking case",
    };
  }
  if (result.margin < marginFloor) {
    return {
      ...result,
      route: "CLARIFY",
      gate: "gate4_margin",
      reason: `margin ${result.margin.toFixed(2)} below floor ${marginFloor} - ambiguous vs next-best intent`,
    };
  }
  if (
    (result.intent === "add_event" || result.intent === "modify_event") &&
    !hasTimeAnchor(text)
  ) {
    return {
      ...result,
      route: "CLARIFY",
      gate: "gate5_missing_slot",
      reason: `${result.intent} predicted with no time slot found`,
    };
  }
  return {
    ...result,
    route: "PROCEED",
    gate: null,
    reason: "confident, unambiguous, domain-anchored",
  };
}

/**
 * The whole pipeline for one utterance: classify, then route.
 *
 * This is the function host applications should call.
 */
export function routeQuery(
  text: string,
  artifacts: Artifacts,
  prototypes: Prototype[],
): RouteResult {
  const result = classify(text, artifacts, prototypes);
  return routeFromClassification(result, text);
}
