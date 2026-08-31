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
import { rewriteForClassifier, REWRITE_RULES } from "../src/rewrite";
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
  it("does not touch any routing fixture", () => {
    const touched = fixtures
      .map((f) => f.text)
      .filter((t) => rewriteForClassifier(t) !== t);
    expect(touched).toEqual([]);
  });

  it("does not change any of the 237 routing decisions", () => {
    const changed: string[] = [];
    for (const f of fixtures) {
      const before = routeQuery(f.text, artifacts, prototypes);
      const after = routeWithRewrite(f.text);
      if (before.gate !== after.gate || before.intent !== after.intent) {
        changed.push(`${f.text} :: ${before.gate} -> ${after.gate}`);
      }
    }
    expect(changed).toEqual([]);
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
