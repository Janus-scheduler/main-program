/**
 * End-to-end smoke test for the ported pipeline.
 *
 * `parity.test.ts` proves the *embedding* half reproduces Python exactly. It
 * does not exercise `classify()` or the gate layer at all — a port could pass
 * 120/120 parity with a completely broken router. This file closes that gap
 * with a small number of behavioural checks.
 *
 * Deliberately NOT an accuracy suite. Full JS≡Python routing agreement over
 * 237 rows is Step 2 (`routing.test.ts`). What is asserted here is structural:
 * the pipeline runs, produces well-formed results, and the gates that can be
 * verified from ALGORITHM.md's own text alone actually fire.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CONF_FLOOR,
  MARGIN_FLOOR,
  classify,
  hasDomainAnchor,
  hasEventNoun,
  hasNegation,
  hasResourceAnchor,
  hasTimeAnchor,
  parseArtifacts,
  parsePrototypes,
  routeQuery,
} from "../src";
import type { Artifacts, Prototype } from "../src/types";

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

describe("artifact decoding", () => {
  it("produces a table of exactly one row per token", () => {
    expect(artifacts.table.length).toBe(
      artifacts.tokens.length * artifacts.dim,
    );
    expect(artifacts.tokenToId.size).toBe(artifacts.tokens.length);
  });

  it("gives every prototype both views at full width", () => {
    expect(prototypes.length).toBeGreaterThan(0);
    for (const p of prototypes) {
      expect(p.vecFull).toHaveLength(artifacts.dim);
      expect(p.vecVerb).toHaveLength(artifacts.dim);
    }
  });

  it("includes `none` prototypes — gate 2 is unreachable without them", () => {
    expect(prototypes.some((p) => p.intent === "none")).toBe(true);
  });
});

describe("anchor detection (ALGORITHM.md §8)", () => {
  it.each([
    ["tomorrow at 3pm", true],
    ["next tuesday", true],
    ["tonight", true],
    ["in 30 minutes", true],
    ["this morning", true],
    ["the blue widget", false],
  ])("hasTimeAnchor(%j) === %s", (text, expected) => {
    expect(hasTimeAnchor(text as string)).toBe(expected);
  });

  it("time anchors accept a leading preposition, because _TIME_RE includes _LEAD", () => {
    // gates.py reuses preprocess._TIME_RE verbatim rather than deriving a
    // lead-free variant, so both spellings must be anchors.
    expect(hasTimeAnchor("3pm")).toBe(true);
    expect(hasTimeAnchor("at 3pm")).toBe(true);
  });

  it("hasResourceAnchor / hasEventNoun fire on their own lists", () => {
    expect(hasResourceAnchor("book the demo room")).toBe(true);
    expect(hasEventNoun("set up a standup")).toBe(true);
    expect(hasResourceAnchor("say hello")).toBe(false);
  });

  it("hasDomainAnchor is the OR of the four", () => {
    expect(hasDomainAnchor("what is the weather like")).toBe(false);
    expect(hasDomainAnchor("cancel the standup")).toBe(true);
  });

  it("negation cues are derived from the contraction table, not re-listed", () => {
    for (const text of [
      "don't schedule that",
      "dont schedule that",
      "I can not make it",
      "not tomorrow",
      "no longer needed",
      "no more meetings",
    ]) {
      expect(hasNegation(text)).toBe(true);
    }
    expect(hasNegation("schedule a sync tomorrow at 10am")).toBe(false);
  });
});

describe("classify()", () => {
  it("returns a well-formed result", () => {
    const r = classify(
      "schedule a sync tomorrow at 10am",
      artifacts,
      prototypes,
    );
    expect(r.neighbours).toHaveLength(5); // TOP_K
    expect(typeof r.confidence).toBe("number");
    expect(Number.isFinite(r.confidence)).toBe(true);
    expect(Number.isFinite(r.margin)).toBe(true);
    // Both views are reported, and they are genuinely different views.
    expect(r.normalizedFull).not.toBe(r.normalizedVerb);
  });

  it("neighbours come back sorted by similarity, descending", () => {
    const r = classify("cancel the standup tomorrow", artifacts, prototypes);
    const sims = r.neighbours.map((n) => n.sim);
    expect([...sims].sort((a, b) => b - a)).toEqual(sims);
  });

  it("margin never counts `none` as the runner-up", () => {
    // The margin must equal `confidence` minus the best NON-none competitor in
    // the top-K, or `confidence` itself when there is no such competitor.
    for (const text of [
      "schedule a sync tomorrow at 10am",
      "cancel the standup",
      "what meetings do i have today",
      "the weather is nice",
    ]) {
      const r = classify(text, artifacts, prototypes);
      const best = new Map<string, number>();
      for (const n of r.neighbours) {
        best.set(n.intent, Math.max(best.get(n.intent) ?? -Infinity, n.sim));
      }
      const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
      const competitor = ranked.slice(1).find(([i]) => i !== "none");
      const expected = r.confidence - (competitor ? competitor[1] : 0);
      expect(r.margin).toBeCloseTo(expected, 10);
    }
  });
});

describe("routeQuery() — gate behaviour", () => {
  it("returns one of the three routes, with a reason, for any input", () => {
    for (const text of [
      "schedule a design sync tomorrow at 10am",
      "cancel the standup",
      "asdfghjkl",
      "",
    ]) {
      const r = routeQuery(text, artifacts, prototypes);
      expect(["PROCEED", "CLARIFY", "REJECT"]).toContain(r.route);
      expect(typeof r.reason).toBe("string");
      expect(r.reason.length).toBeGreaterThan(0);
      if (r.route === "PROCEED") expect(r.gate).toBeNull();
      else expect(r.gate).not.toBeNull();
    }
  });

  it("negation short-circuits ahead of every other gate", () => {
    const r = routeQuery(
      "don't schedule the sync tomorrow at 10am",
      artifacts,
      prototypes,
    );
    expect(r.gate).toBe("negation");
    expect(r.route).toBe("CLARIFY");
  });

  it("gate 5 fires for add/modify with no time anchor", () => {
    const r = routeQuery(
      "schedule a meeting with sarah",
      artifacts,
      prototypes,
    );
    expect(hasTimeAnchor("schedule a meeting with sarah")).toBe(false);
    // Whichever gate fires first, it must not be PROCEED — an add_event with
    // no time is exactly the CLARIFY case the chat UI is built around.
    expect(r.route).not.toBe("PROCEED");
  });

  it("gate 3b fires on a bare resource mention (the documented parking case)", () => {
    const text = "parking";
    expect(hasResourceAnchor(text)).toBe(true);
    expect(hasTimeAnchor(text)).toBe(false);
    expect(hasEventNoun(text)).toBe(false);
    const r = routeQuery(text, artifacts, prototypes);
    expect(r.route).not.toBe("PROCEED");
  });

  it("a confident, anchored, unambiguous scheduling request PROCEEDs", () => {
    const text = "schedule a design sync tomorrow at 10am";
    const r = routeQuery(text, artifacts, prototypes);
    expect(r.route).toBe("PROCEED");
    expect(r.gate).toBeNull();
    expect(r.intent).toBe("add_event");
    expect(r.confidence).toBeGreaterThanOrEqual(CONF_FLOOR);
    expect(r.margin).toBeGreaterThanOrEqual(MARGIN_FLOOR);
  });

  /**
   * ALGORITHM.md documents `lunch` as the known over-broad `EVENT_NOUNS` entry
   * and counts this class of input among the 3 false accepts. It is reproduced
   * on purpose, so the behaviour is pinned rather than left to drift: "what's
   * for lunch today" gets a domain anchor it does not deserve.
   *
   * This test asserts the DOCUMENTED WEAKNESS, not desired behaviour. If a
   * future corpus change makes it reject properly, delete the test — do not
   * "fix" the classifier to satisfy it.
   */
  it("reproduces the documented `lunch` over-broad anchor rather than fixing it", () => {
    expect(hasEventNoun("what's for lunch today")).toBe(true);
    expect(hasDomainAnchor("what's for lunch today")).toBe(true);
  });
});
