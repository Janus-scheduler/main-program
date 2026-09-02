/**
 * Domain-verb normalisation for the classifier.
 *
 * Two of these are INVARIANTS rather than ordinary tests, and both exist
 * because the first version of the map broke something real:
 *
 *  1. `does not touch any routing fixture` — the map mapped `book` (0.92),
 *     `reserve` (1.00), `show` (0.91) and 15 other verbs the classifier
 *     already handled. It rewrote 38 of the 237 fixtures and broke one:
 *     "show me everything scheduled for friday" became "look up me everything
 *     scheduled for friday", dropped below the floor, and a working lookup
 *     turned into a refusal. A rewrite can only add risk to a sentence that
 *     already worked.
 *
 *  2. `every replacement is a phrase the classifier is confident about` — the
 *     lookup rule replaced with "look up", which scores 0.39, below the 0.45
 *     floor. The rewrite fired and the sentence was still rejected. Meaning
 *     the right thing is not enough; the replacement has to score.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CONF_FLOOR,
  classify,
  parseArtifacts,
  parsePrototypes,
  routeFromClassification,
  routeQuery,
} from "../src";
import {
  rewriteForClassifier,
  stripPoliteness,
  synthesiseVerb,
  REWRITE_RULES,
} from "../src/rewrite";
import type { Artifacts, Gate, Prototype } from "../src/types";

const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

let artifacts: Artifacts;
let prototypes: Prototype[];

beforeAll(() => {
  artifacts = parseArtifacts({
    vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf-8"),
    vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
  });
  prototypes = parsePrototypes(
    readFileSync(resolve(ARTIFACTS_DIR, "prototypes.json"), "utf-8"),
  );
});

const fixtures: Array<{ text: string; gate: Gate }> = JSON.parse(
  readFileSync(
    resolve(__dirname, "../fixtures/routing_fixtures.json"),
    "utf-8",
  ),
);

/** Option C: classify the rewrite, gate the original — as `evaluate()` does. */
const routeWithRewrite = (text: string) =>
  routeFromClassification(
    classify(rewriteForClassifier(text), artifacts, prototypes),
    text,
  );

// ══════════════════════════════════════════════════════════════════════════
//  Invariants
// ══════════════════════════════════════════════════════════════════════════

describe("the map is inert on everything that already worked", () => {
  it("no fixture is ever VERB-SUBSTITUTED", () => {
    // The original invariant, in the only form that still means something.
    //
    // Three transforms now run: politeness is REMOVED from the front, a verb
    // may be PREPENDED to a verbless shorthand, and a domain verb may be
    // SUBSTITUTED. Only the third can change what a sentence means, and it is
    // the one that broke something real — so it is the one held to zero.
    //
    // Two fixtures are legitimately prefixed: “w/ Alice tomorrow” and
    // “3pm-4pm sync”. Both are shorthand bookings with no verb, which is
    // exactly what the prefix rule is for, and neither outcome gets worse.
    const substituted = fixtures
      .map((f) => f.text)
      .filter((original) => {
        const out = rewriteForClassifier(original);
        if (out === original) return false;
        const stripped = stripPoliteness(original);
        // Allowed: a politeness removal, a `book ` prefix, or both.
        return out !== stripped && out !== `book ${stripped.trim()}`;
      });
    expect(substituted).toEqual([]);
  });
  it("politeness stripping only ever removes a leading phrase", () => {
    // It must SUBTRACT, never substitute. Anything else is a verb rule
    // wearing a disguise, and belongs under the invariant above.
    for (const f of fixtures) {
      const stripped = stripPoliteness(f.text);
      expect(f.text.toLowerCase().endsWith(stripped.toLowerCase())).toBe(true);
    }
  });

  it("no fixture outcome gets worse", () => {
    // THIS is what the old “touches nothing” test was really protecting, and
    // it is the one to keep. Stripping politeness legitimately rewrites 12
    // fixtures (“can you …”, “lets …”) and changes exactly ONE decision:
    //
    //   "lets reschedule the call"  gate1_confidence -> gate5_missing_slot
    //
    // REJECT to CLARIFY — “I didn't understand” becoming “when should it
    // be?”. Better, not worse. A blanket “touches nothing” would forbid that
    // improvement while forbidding nothing that matters.
    const RANK: Record<string, number> = { REJECT: 0, CLARIFY: 1, PROCEED: 2 };
    const worse: string[] = [];
    for (const f of fixtures) {
      const before = routeQuery(f.text, artifacts, prototypes);
      const after = routeWithRewrite(f.text);
      if (RANK[after.route] < RANK[before.route]) {
        worse.push(`${f.text} :: ${before.route} -> ${after.route}`);
      }
      if (
        before.route === "PROCEED" &&
        after.route === "PROCEED" &&
        before.intent !== after.intent
      ) {
        worse.push(`${f.text} :: intent ${before.intent} -> ${after.intent}`);
      }
    }
    expect(worse).toEqual([]);
  });

  it("never empties an utterance", () => {
    // A bare “please” is not a request; it must reach the gates as the
    // nothing it is, not as an empty string.
    for (const t of ["please", "can you", "  please  ", "let's"]) {
      expect(stripPoliteness(t).trim().length).toBeGreaterThan(0);
    }
  });
  it.each([
    "book Room A tomorrow at 3pm",
    "reserve a table for 4 tomorrow at 7pm",
    "show me everything scheduled for friday",
    "clear my afternoon",
    "drop maths tomorrow at 9am",
    "remove the 3pm review",
    "update the standup to 4pm",
  ])("leaves an already-accepted verb alone: %s", (text) => {
    expect(rewriteForClassifier(text)).toBe(text);
  });

  it("only matches a LEADING verb, never a noun mid-sentence", () => {
    // "plan", "book" and "use" are ordinary nouns too. A global replace
    // rewrote them wherever they appeared.
    for (const text of [
      "the floor plan review tomorrow at 3pm",
      "my book club tomorrow at 3pm",
      "the use case workshop tomorrow at 3pm",
    ]) {
      expect(rewriteForClassifier(text)).toBe(text);
    }
  });
});

describe("every replacement is a phrase the classifier is confident about", () => {
  it.each(REWRITE_RULES.map((r) => [r.replacement, r.intent] as const))(
    "%s classifies as %s, above the floor",
    (replacement, intent) => {
      const result = classify(
        `${replacement} Room A tomorrow at 3pm`,
        artifacts,
        prototypes,
      );
      expect(result.intent).toBe(intent);
      // Meaning the right thing is not enough — "look up" meant get_details
      // and still scored 0.39, so the rewritten sentence stayed rejected.
      expect(result.confidence).toBeGreaterThanOrEqual(CONF_FLOOR);
    },
  );
});

// ══════════════════════════════════════════════════════════════════════════
//  What it is actually for
// ══════════════════════════════════════════════════════════════════════════

describe("domain verbs the classifier rejects now route", () => {
  it.each([
    ["timetable maths tomorrow at 9am", "add_event"],
    ["assign Room A tomorrow at 3pm", "add_event"],
    ["allocate Room A tomorrow at 3pm", "add_event"],
    ["use Room A tomorrow at 3pm", "add_event"],
    ["admit the patient tomorrow at 3pm", "add_event"],
    ["enrol Alex tomorrow at 3pm", "add_event"],
    ["meet Mr. Perera tomorrow at 11am", "add_event"],
    ["postpone the standup to 4pm", "modify_event"],
    ["scrap the 3pm review", "delete_event"],
    ["find my meetings tomorrow", "get_details"],
  ])("%s becomes %s", (text, intent) => {
    expect(routeQuery(text, artifacts, prototypes).route).toBe("REJECT");

    const after = routeWithRewrite(text);
    expect(after.route).not.toBe("REJECT");
    expect(after.intent).toBe(intent);
  });

  it("corrects an intent the classifier got WRONG, not just a weak one", () => {
    // "delay" scored 0.39 AND classified as delete_event — a reschedule read
    // as a cancellation. Confidence was not the only thing wrong with it.
    expect(
      classify("delay the standup to 4pm", artifacts, prototypes).intent,
    ).toBe("delete_event");
    expect(routeWithRewrite("delay the standup to 4pm").intent).toBe(
      "modify_event",
    );
  });

  it("still matches through a politeness prefix", () => {
    const after = routeWithRewrite("can you timetable maths tomorrow at 9am");
    expect(after.route).not.toBe("REJECT");
    expect(after.intent).toBe("add_event");
  });

  it("applies at most one rule", () => {
    // Composing replacements would build nonsense out of two verbs.
    const out = rewriteForClassifier("timetable and assign Room A tomorrow");
    expect(out.match(/schedule/g) ?? []).toHaveLength(1);
  });
});

describe("the gates still see the user's own words", () => {
  it("a rewritten utterance with no anchor is still rejected by gate 3", () => {
    // The rewrite can lift CONFIDENCE. It must not manufacture an anchor —
    // gate 3 reads the original text, so there is nothing to book against.
    const after = routeWithRewrite("timetable something");
    expect(after.route).toBe("REJECT");
    expect(after.gate).toBe("gate3_no_anchor");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  Tier 5 — the two registers that failed hardest
//
//  Measured before any of this existed:
//    polite / verbose   0/3 PROCEED   conf 0.27-0.48
//    terse / shorthand  1/5 PROCEED   conf 0.09-0.23
//
//  Both are ordinary ways to type. Neither needed a bigger model.
// ══════════════════════════════════════════════════════════════════════════

describe("politeness padding", () => {
  it.each([
    ["could you please put something in for tomorrow at 3pm", "put"],
    ["I was hoping to book Room A on friday", "book"],
    ["would you mind cancelling the review at three", "cancel"],
    ["I'd like to move my 3pm", "move"],
    ["please cancel the standup", "cancel"],
    ["let's book Room A tomorrow", "book"],
  ])("strips the padding from %s", (text, firstWord) => {
    expect(stripPoliteness(text).toLowerCase()).toMatch(
      new RegExp(`^${firstWord}`),
    );
  });

  it("lifts the rejected phrasings over the floor", () => {
    for (const text of [
      "could you please put something in for tomorrow afternoon in Room A",
      "would you mind cancelling the review I have at three",
    ]) {
      expect(routeWithRewrite(text).confidence).toBeGreaterThan(CONF_FLOOR);
    }
  });

  it("never empties an utterance", () => {
    for (const t of ["please", "can you", "  please  ", "let's"]) {
      expect(stripPoliteness(t).trim().length).toBeGreaterThan(0);
    }
  });
});

describe("a verbless shorthand gets the verb it implies", () => {
  it.each(["OR1 3pm tmrw", "lab 3 friday 2pm", "sarah 10am", "3pm-4pm sync"])(
    "%s becomes a booking",
    (text) => {
      expect(synthesiseVerb(text)).toBe(`book ${text}`);
      expect(routeWithRewrite(text).confidence).toBeGreaterThan(CONF_FLOOR);
    },
  );

  it.each([
    // a verb is already there — whatever it is, it wins
    ["cancel 3pm", "an explicit verb"],
    ["timetable maths tomorrow at 9am", "a domain verb the map handles"],
    // a MISSPELLED verb is still a verb; prefixing `book` would invert it
    ["cancle my 3pm", "a misspelled verb"],
    ["scedule a meeting at 5pm", "a misspelled verb"],
    ["moev the auditor meeting to friday", "a misspelled verb"],
    // prose and questions are not shorthand
    ["I'm free at 2pm, aren't you?", "prose"],
    ["arent we meeting today", "a question"],
    ["waht's on tomorrow", "a misspelled question word"],
    ["theyd prefer friday", "a statement"],
    // nothing to book, or nothing to book it at
    ["3pm", "a bare time with no subject"],
    ["Room A", "no time at all"],
  ])("leaves %s alone (%s)", (text) => {
    expect(synthesiseVerb(text)).toBe(text);
  });

  it("does not fire on prose that merely lacks a command verb", () => {
    // Six words is not shorthand, whatever else is true of it.
    const long = "the auditor would rather come on friday afternoon";
    expect(synthesiseVerb(long)).toBe(long);
  });

  it("runs LAST, so a domain verb still reaches its rule", () => {
    // Run first, a synthesised `book` lands in front of the unknown verb and
    // the rule that would have mapped it no longer matches its anchor.
    expect(rewriteForClassifier("postpone the standup to 4pm")).toMatch(
      /^reschedule/i,
    );
  });
});
