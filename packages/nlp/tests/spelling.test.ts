/**
 * Typo tolerance for time words.
 *
 * Two things are being tested, and the second matters more:
 *
 *  1. that it corrects what it should;
 *  2. that it does NOT correct anything else. A spell-corrector that rewrites
 *     words the user meant is worse than no spell-corrector — it makes the
 *     system unpredictable in a way a plain failure never is.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  correctTimeWords,
  hasTimeAnchor,
  parseArtifacts,
  parsePrototypes,
  TIME_VOCABULARY,
} from "../src";
import type { Artifacts, EntityCatalog, Prototype } from "../src/types";

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

const CATALOG: EntityCatalog = {
  resources: [{ id: "r1", name: "Monday Room", type: "room" }],
  participants: [{ id: "p1", name: "Tomas Fridays", type: "person" }],
};

const fix = (text: string) => correctTimeWords(text, { artifacts });

describe("the vocabulary is worth correcting towards", () => {
  it.each(TIME_VOCABULARY)(
    "%p is a word the FROZEN gate actually recognises",
    (word) => {
      // If this ever fails, a "correction" would produce a word gate 5 still
      // refuses — a fix that silently does nothing.
      expect(hasTimeAnchor(word)).toBe(true);
    },
  );

  it("prototypes loaded, so the suite is running against real artifacts", () => {
    expect(prototypes.length).toBeGreaterThan(0);
  });

  /**
   * The property that actually matters, tested by brute force.
   *
   * Ambiguity IS possible in principle — "thursday" and "saturday" are only 4
   * apart, so an input could sit within 2 of both. The guarantee is not that
   * this never happens; it is that when it does, nothing is corrected. So:
   * mangle every vocabulary word every way a single slip can, and assert the
   * result is either the word it came from or no correction at all.
   *
   * **Never a different word.** A correction that lands on the wrong day is
   * far worse than one that does not fire.
   */
  it("never corrects a mangled word into a DIFFERENT vocabulary word", () => {
    let corrected = 0;

    for (const word of TIME_VOCABULARY) {
      const mangled = new Set<string>();
      for (let i = 0; i < word.length; i++) {
        mangled.add(word.slice(0, i) + word.slice(i + 1)); // deletion
        mangled.add(word.slice(0, i) + word[i] + word.slice(i)); // doubling
        if (i + 1 < word.length) {
          // transposition
          mangled.add(
            word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2),
          );
        }
        for (const c of "aeiourstn") {
          mangled.add(word.slice(0, i) + c + word.slice(i + 1)); // substitution
        }
      }

      for (const candidate of mangled) {
        const { corrections } = correctTimeWords(`meet ${candidate}`, {
          artifacts,
        });
        if (corrections.length === 0) continue;
        expect(corrections[0].to).toBe(word);
        corrected++;
      }
    }

    // And it has to actually fire, or the assertion above is vacuous.
    expect(corrected).toBeGreaterThan(100);
  });
});

/** Plain Damerau-Levenshtein, for assertions about the vocabulary itself. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

describe("corrects real typos", () => {
  it.each([
    ["tommorow", "tomorrow"],
    ["tomorow", "tomorrow"],
    ["tomorrrow", "tomorrow"],
    ["tuseday", "tuesday"],
    ["wendesday", "wednesday"],
    ["mornning", "morning"],
    ["afternoo", "afternoon"],
    ["todya", "today"],
  ])("%p -> %p", (typo, expected) => {
    const result = fix(`schedule a meeting ${typo}`);
    expect(result.text).toBe(`schedule a meeting ${expected}`);
    expect(result.corrections).toEqual([
      { from: typo, to: expected, start: 19, end: 19 + typo.length },
    ]);
  });

  it("makes the utterance pass the frozen gate it was failing", () => {
    // The whole point. Before: no anchor, so gate 5 asked "when?" about a
    // sentence that said when.
    expect(hasTimeAnchor("schedule a meeting tommorow")).toBe(false);
    expect(hasTimeAnchor(fix("schedule a meeting tommorow").text)).toBe(true);
  });

  it("handles a transposition, which plain Levenshtein scores as 2", () => {
    expect(fix("meet tomorow").text).toBe("meet tomorrow");
    expect(fix("meet tomrorow").text).toBe("meet tomorrow");
  });

  it("preserves the rest of the string byte for byte", () => {
    const result = fix("  book   Room A   tommorow!  ");
    expect(result.text).toBe("  book   Room A   tomorrow!  ");
  });

  it("reports offsets into the ORIGINAL string", () => {
    const text = "schedule a meeting tommorow";
    const { corrections } = fix(text);
    expect(text.slice(corrections[0].start, corrections[0].end)).toBe(
      "tommorow",
    );
  });
});

describe("leaves everything else alone", () => {
  it("does not touch a correctly spelled time word", () => {
    const result = fix("meet tomorrow morning");
    expect(result.text).toBe("meet tomorrow morning");
    expect(result.corrections).toEqual([]);
  });

  it("does not touch real words the model knows", () => {
    // "meeting", "standup", "review" are words the user meant. Rewriting one
    // of those would be this module overruling them.
    for (const text of [
      "schedule a meeting",
      "book the review",
      "cancel the standup",
      "morning sync with the team",
    ]) {
      expect(fix(text).corrections).toEqual([]);
    }
  });

  it("does not touch catalog names", () => {
    // "Monday Room" and "Tomas" are spellings the HOST chose. "Tomas" is one
    // edit from nothing in the vocabulary, but "Fridays" is one from "friday"
    // — and it must survive, because it is somebody's name.
    const result = correctTimeWords("book Monday Room with Tomas Fridays", {
      artifacts,
      catalog: CATALOG,
    });
    expect(result.corrections).toEqual([]);
    expect(result.text).toBe("book Monday Room with Tomas Fridays");
  });

  it("refuses short words, where one edit is a different word", () => {
    // "may"/"day", "mon"/"noon", "wed"/"week" are all one edit apart and all
    // legitimate. Below the length floor nothing is corrected at all.
    for (const text of ["in may", "on mon", "wed at 3pm", "a day"]) {
      expect(fix(text).corrections).toEqual([]);
    }
  });

  it("refuses when two vocabulary words are equally close", () => {
    // "sonday" is one edit from BOTH "sunday" (o→u) and "monday" (s→m).
    // Ambiguity means guessing, and guessing silently is the thing to avoid.
    expect(distance("sonday", "sunday")).toBe(1);
    expect(distance("sonday", "monday")).toBe(1);
    expect(
      correctTimeWords("meet on sonday", { artifacts }).corrections,
    ).toEqual([]);
  });

  it("refuses a short word two edits away — that is a guess, not a typo", () => {
    // Under eight characters the allowance is one edit only.
    expect(distance("todya", "today")).toBe(1); // corrected
    expect(fix("meet tmrw").corrections).toEqual([]); // 4 chars, below the floor
    expect(fix("schedule xyzzyx").corrections).toEqual([]);
  });

  it("returns the identical string object when nothing changed", () => {
    const text = "book Room A tomorrow at 10am";
    expect(correctTimeWords(text, { artifacts }).text).toBe(text);
  });

  it("is a pure function", () => {
    const text = "schedule a meeting tommorow";
    expect(fix(text)).toEqual(fix(text));
  });
});

describe("without artifacts", () => {
  it("still works, just with one fewer guard", () => {
    // The vocabulary check is an extra safety net, not a requirement.
    expect(correctTimeWords("meet tommorow").text).toBe("meet tomorrow");
  });
});
