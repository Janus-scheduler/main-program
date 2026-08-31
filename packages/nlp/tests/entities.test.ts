/**
 * Entity extraction against a caller-supplied catalog.
 *
 * New behaviour, so ordinary unit tests. The catalog used here is deliberately
 * NOT the frozen `PARTICIPANT_NAMES` corpus ("sarah", "alice", "marketing") —
 * it is a realistic directory, because the whole reason the catalog is a
 * parameter is that real installations do not have those names.
 */

import { extractEntities, leadingVerbPrefixLength } from "../src";
import type { EntityCatalog, ExtractOptions } from "../src/types";

/** Wednesday 2026-08-05, 08:30 UTC. */
const NOW = new Date("2026-08-05T08:30:00.000Z");

const CATALOG: EntityCatalog = {
  resources: [
    { id: "r1", name: "Room A", type: "room" },
    { id: "r2", name: "Conference Room B", type: "room" },
    {
      id: "r3",
      name: "Recording Studio",
      type: "room",
      aliases: ["the booth"],
    },
    { id: "r4", name: "Projector", type: "equipment" },
  ],
  participants: [
    { id: "p1", name: "Alex Rivera", type: "person" },
    { id: "p2", name: "Priya Fernando", type: "person", aliases: ["PF"] },
    { id: "p3", name: "Sam Chen", type: "person" },
    { id: "p4", name: "Design Team", type: "group" },
  ],
};

function extract(text: string, overrides: Partial<ExtractOptions> = {}) {
  return extractEntities(text, {
    catalog: CATALOG,
    now: NOW,
    timezone: "UTC",
    ...overrides,
  });
}

describe("the end-story sentence", () => {
  const TEXT = "Schedule a design sync with Alex tomorrow at 10am in Room A";

  it("produces every chip the parse card needs", () => {
    const e = extract(TEXT);

    expect(e.participants.map((p) => p.name)).toEqual(["Alex Rivera"]);
    expect(e.resources.map((r) => r.name)).toEqual(["Room A"]);
    expect(e.title).toBe("design sync");
    expect(e.time).not.toBeNull();
    expect(e.time!.localDate).toBe("2026-08-06");
    expect(e.time!.localTime).toBe("10:00");
    expect(e.time!.weekday).toBe("thursday");
  });

  it("reports spans that point back at the original text", () => {
    const e = extract(TEXT);
    for (const match of [...e.participants, ...e.resources]) {
      expect(TEXT.slice(match.start, match.end)).toBe(match.text);
    }
    expect(TEXT.slice(e.timeSpan!.start, e.timeSpan!.end)).toContain(
      "tomorrow",
    );
  });

  it("marks a first-name-only hit as non-exact", () => {
    // "Alex" is one token of "Alex Rivera" — a weaker signal than the full
    // name, and the UI may want to ask rather than assume.
    expect(extract(TEXT).participants[0].exact).toBe(false);
    expect(
      extract("meet Alex Rivera tomorrow at 10am").participants[0].exact,
    ).toBe(true);
  });
});

describe("catalog matching", () => {
  it("matches the longest name when two overlap", () => {
    // "Conference Room B" must not degrade into "Room A"-style partials or
    // match twice.
    const e = extract("book Conference Room B tomorrow at 9am");
    expect(e.resources).toHaveLength(1);
    expect(e.resources[0]).toMatchObject({
      id: "r2",
      name: "Conference Room B",
      exact: true,
    });
  });

  it("matches an explicit alias", () => {
    const e = extract("book the booth tomorrow at 2pm");
    expect(e.resources[0]).toMatchObject({ id: "r3", exact: true });
  });

  it("is case-insensitive", () => {
    expect(extract("book ROOM A tomorrow at 9am").resources[0].id).toBe("r1");
    expect(extract("meet alex tomorrow at 9am").participants[0].id).toBe("p1");
  });

  it("respects word boundaries", () => {
    // "Samsung" must not match the person "Sam Chen".
    expect(extract("order a Samsung monitor tomorrow").participants).toEqual(
      [],
    );
  });

  it("does not partial-match non-person entries", () => {
    // "Design Team" must not fire on a bare "team", and "Room A" not on "room".
    const e = extract("book a room for the team tomorrow at 9am");
    expect(e.participants).toEqual([]);
    expect(e.resources).toEqual([]);
  });

  /**
   * The case that drove the opt-in design. "Design Team" is a group, so its
   * "Design" token must not match the word "design" in "a design sync" — doing
   * so would invent a participant the user never mentioned AND eat the word
   * out of the title.
   */
  it("a group named 'Design Team' does not match the word 'design'", () => {
    const e = extract("Schedule a design sync tomorrow at 10am");
    expect(e.participants).toEqual([]);
    expect(e.title).toBe("design sync");
  });

  it("still matches a group by its full name", () => {
    const e = extract("schedule a sync with the Design Team tomorrow at 10am");
    expect(e.participants.map((p) => p.id)).toEqual(["p4"]);
    expect(e.participants[0].exact).toBe(true);
  });

  it("matchPartial overrides the person-type default in both directions", () => {
    const catalog: EntityCatalog = {
      participants: [
        { id: "g1", name: "Growth Squad", type: "group", matchPartial: true },
        { id: "x1", name: "Chris Park", type: "person", matchPartial: false },
      ],
    };
    const opts = { catalog, now: NOW, timezone: "UTC" };
    expect(
      extractEntities("meet the squad tomorrow at 9am", opts).participants.map(
        (p) => p.id,
      ),
    ).toEqual(["g1"]);
    expect(
      extractEntities("meet Chris tomorrow at 9am", opts).participants,
    ).toEqual([]);
    expect(
      extractEntities("meet Chris Park tomorrow at 9am", opts).participants.map(
        (p) => p.id,
      ),
    ).toEqual(["x1"]);
  });

  it("finds several distinct people", () => {
    const e = extract("meet Alex and Priya tomorrow at 10am");
    expect(e.participants.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("reports each catalog entry at most once", () => {
    const e = extract("Alex, can Alex join Alex's sync tomorrow at 10am");
    expect(e.participants).toHaveLength(1);
  });

  it("returns empty lists when no catalog is supplied", () => {
    const e = extractEntities("meet Alex tomorrow at 10am", {
      now: NOW,
      timezone: "UTC",
    });
    expect(e.participants).toEqual([]);
    expect(e.resources).toEqual([]);
    // The time still resolves — extraction degrades, it does not fail.
    expect(e.time).not.toBeNull();
  });

  it("prefers a resource over a participant on the same span", () => {
    const catalog: EntityCatalog = {
      resources: [{ id: "r9", name: "Design", type: "room" }],
      participants: [{ id: "p9", name: "Design", type: "group" }],
    };
    const e = extractEntities("book Design tomorrow at 10am", {
      catalog,
      now: NOW,
      timezone: "UTC",
    });
    expect(e.resources.map((r) => r.id)).toEqual(["r9"]);
    expect(e.participants).toEqual([]);
  });
});

describe("title extraction", () => {
  it.each([
    ["Schedule a design sync with Alex tomorrow at 10am", "design sync"],
    ["book the quarterly review in Room A on friday", "quarterly review"],
    ["set up a 1:1 with Sam Chen tomorrow at 3pm", "1:1"],
    ["can you schedule the all-hands next monday at 9am", "all-hands"],
    ["cancel the vendor demo tomorrow", "vendor demo"],
    ["move the standup to 10am", "standup"],
  ])("%j → %j", (text, expected) => {
    expect(extract(text).title).toBe(expected);
  });

  it("drops a preposition whose object was removed", () => {
    // "with Alex" and "in Room A" both disappear; neither "with" nor "in"
    // should survive into the title.
    const title = extract(
      "schedule a retro with Alex in Room A tomorrow at 10am",
    ).title!;
    expect(title).toBe("retro");
    expect(title).not.toMatch(/\b(with|in|at|on|for)\b/);
  });

  it("is undefined when nothing meaningful is left", () => {
    expect(extract("schedule it with Alex tomorrow at 10am").title).toBe("it");
    expect(extract("book Room A tomorrow at 10am").title).toBeUndefined();
    expect(extract("cancel tomorrow").title).toBeUndefined();
  });

  it("keeps inner punctuation but trims the edges", () => {
    expect(extract("book the all-hands tomorrow at 9am.").title).toBe(
      "all-hands",
    );
  });
});

describe("leadingVerbPrefixLength", () => {
  it.each([
    ["schedule a sync", "schedule"],
    ["can you schedule a sync", "can you schedule"],
    ["please book the room", "please book"],
    ["set up a review", "set up"],
    ["reschedule the standup", "reschedule"],
  ])("%j consumes %j", (text, consumed) => {
    expect(text.slice(0, leadingVerbPrefixLength(text))).toBe(consumed);
  });

  /**
   * Only the wrapper is consumed here, not "to cancel": after stripping
   * "i need ", the remainder starts with "to", which is not in the verb
   * lexicon, and the lexicon is anchored at the start rather than scanned for.
   *
   * That is `headVerbPhraseLexicon`'s behaviour too, and matching it is
   * deliberate — this function exists to find the same prefix the frozen
   * pipeline finds. Diverging would mean the title is computed against a
   * different reading of the sentence than the intent was.
   */
  it("mirrors the frozen lexicon's anchored matching, including its limits", () => {
    const text = "i need to cancel the demo";
    expect(text.slice(0, leadingVerbPrefixLength(text))).toBe("i need ");
  });

  it("consumes nothing when the sentence opens with no known verb", () => {
    expect(leadingVerbPrefixLength("quarterly planning offsite")).toBe(0);
  });

  it("prefers the longest multi-word verb", () => {
    // "set up" must win over "set", or the title keeps a stray "up".
    expect(extract("set up a design review tomorrow at 10am").title).toBe(
      "design review",
    );
  });
});

describe("purity and independence", () => {
  it("is deterministic — same input, same output", () => {
    const text = "schedule a sync with Alex tomorrow at 10am in Room A";
    expect(JSON.stringify(extract(text))).toBe(JSON.stringify(extract(text)));
  });

  it("depends on the injected `now`, not the system clock", () => {
    const later = new Date("2026-12-24T08:30:00.000Z");
    expect(
      extract("meet tomorrow at 10am", { now: later }).time!.localDate,
    ).toBe("2026-12-25");
  });

  it("returns a null time rather than throwing when nothing resolves", () => {
    const e = extract("book Room A");
    expect(e.time).toBeNull();
    expect(e.timeSpan).toBeUndefined();
    // The rest of the extraction still works — this is exactly the CLARIFY
    // case, where the dialogue layer asks for the missing time.
    expect(e.resources.map((r) => r.id)).toEqual(["r1"]);
  });

  it("handles empty and whitespace-only input without throwing", () => {
    for (const text of ["", "   ", "\n"]) {
      const e = extract(text);
      expect(e.time).toBeNull();
      expect(e.resources).toEqual([]);
      expect(e.participants).toEqual([]);
      expect(e.title).toBeUndefined();
    }
  });

  it("handles a catalog entry with regex metacharacters in its name", () => {
    const catalog: EntityCatalog = {
      resources: [{ id: "r9", name: "Room (B) [main]", type: "room" }],
    };
    const e = extractEntities("book Room (B) [main] tomorrow at 10am", {
      catalog,
      now: NOW,
      timezone: "UTC",
    });
    expect(e.resources.map((r) => r.id)).toEqual(["r9"]);
  });

  it("strips quotation marks from extracted titles", () => {
    const e = extract('schedule "Design Sync" tomorrow at 10am');
    expect(e.title).toBe("Design Sync");
  });

  it("matches multi-word resources with partial prefix names like 'MRI Scanner'", () => {
    const catalog: EntityCatalog = {
      resources: [
        { id: "mri-a", name: "MRI Scanner A", type: "room" },
        { id: "mri-b", name: "MRI Scanner B", type: "room" },
      ],
    };
    const e = extractEntities("book the MRI Scanner tomorrow at 10am", {
      catalog,
      now: NOW,
      timezone: "UTC",
    });
    expect(e.resources.map((r) => r.id)).toEqual(["mri-a"]);
    expect(e.resources[0].exact).toBe(false);
  });
});

/**
 * REGRESSION — asking for one instance silently booked another.
 *
 * `surfaceForms` emits continuous sub-phrases so "book the MRI Scanner" can
 * match "MRI Scanner A". The cost was that "MRI Scanner C" matched it too, and
 * silently claimed Scanner A — an instance the user never named. With both A
 * and B in the catalog, which one won was arbitrary.
 *
 * A non-exact match followed by an instance designator that is not in that
 * entry's name is now dropped, so the utterance falls through to the
 * unknown-resource question instead of picking one.
 */
describe("a sub-phrase contradicted by what follows it", () => {
  const INSTANCES: EntityCatalog = {
    resources: [
      { id: "or1", name: "Operating Room 1", type: "room" },
      { id: "mri-a", name: "MRI Scanner A", type: "equipment" },
      { id: "mri-b", name: "MRI Scanner B", type: "equipment" },
    ],
    participants: [{ id: "p1", name: "Alex Rivera", type: "person" }],
  };
  const inst = (text: string) =>
    extractEntities(text, { catalog: INSTANCES, now: NOW, timezone: "UTC" });

  it.each([
    "book MRI Scanner C tomorrow at 9am",
    "book Operating Room 2 tomorrow at 9am",
    "book MRI Scanner D tomorrow at 9am",
  ])("claims nothing for an instance we do not have: %s", (text) => {
    expect(inst(text).resources).toEqual([]);
  });

  it("still matches the exact name", () => {
    expect(inst("book MRI Scanner A tomorrow at 9am").resources[0].name).toBe(
      "MRI Scanner A",
    );
  });

  it("still allows a genuine sub-phrase with nothing contradicting it", () => {
    // No designator follows, so "the MRI Scanner" may still resolve.
    const e = inst("book the MRI Scanner tomorrow at 9am");
    expect(e.resources.map((r) => r.name)).toEqual(["MRI Scanner A"]);
    expect(e.resources[0].exact).toBe(false);
  });

  /**
   * The bound that took two attempts. "Any short token" swallowed ordinary
   * function words — "and", "in" — so "meet Alex and Priya" lost its Alex. A
   * designator is a single letter or digits, not any short word.
   */
  it.each([
    ["meet Alex and Alex Rivera tomorrow at 10am", "and"],
    ["schedule a retro with Alex in Operating Room 1 tomorrow", "in"],
    ["meet Alex at 10am tomorrow", "at"],
  ])("does not treat %j's %j as a designator", (text) => {
    expect(inst(text).participants.map((p) => p.name)).toContain("Alex Rivera");
  });
});

/**
 * REGRESSION — a numbered resource name leaked into the date.
 *
 * Time was parsed BEFORE the catalog was consulted, so date patterns ran on raw
 * text and could consume part of a resource NAME:
 *
 *   "book Operating Room 1 August 25th at 9am"
 *      → monthDate "1 August"   ← the room's number, plus the month
 *      → booked 1 August 2027, and "25th" fell through and became the title
 *
 * The card showed that date confidently. Matching the catalog first and
 * blanking those spans removes the digits before any date pattern sees them.
 */
describe("resource names are not mistaken for dates", () => {
  const NUMBERED: EntityCatalog = {
    resources: [
      { id: "or1", name: "Operating Room 1", type: "room" },
      { id: "r2", name: "Room 2", type: "room" },
      { id: "mri", name: "MRI Scanner A", type: "equipment" },
    ],
    participants: [{ id: "p1", name: "Dr. Sarah Chen", type: "person" }],
  };
  const numbered = (text: string) =>
    extractEntities(text, { catalog: NUMBERED, now: NOW, timezone: "UTC" });

  it("does not read 'Room 1 August' as 1 August", () => {
    const e = numbered("book Operating Room 1 August 25th at 9am");
    expect(e.time?.localDate).toBe("2026-08-25");
    expect(e.resources.map((r) => r.name)).toEqual(["Operating Room 1"]);
    // "25th" used to survive as the title once the date had eaten "1 August".
    expect(e.title).toBeUndefined();
  });

  it("does not let a room's number become a duration", () => {
    const e = numbered("book Room 2 for 2 hours tomorrow at 3pm");
    expect(e.time?.durationMinutes).toBe(120);
    expect(e.resources.map((r) => r.name)).toEqual(["Room 2"]);
  });

  it("still resolves the date when the room has no digits", () => {
    const e = numbered("book MRI Scanner A tomorrow at 3pm");
    expect(e.time?.localDate).toBe("2026-08-06");
    expect(e.time?.localTime).toBe("15:00");
  });

  it("keeps the title when there is a real one alongside a numbered room", () => {
    const e = numbered(
      "book the design sync in Operating Room 1 tomorrow at 3pm",
    );
    expect(e.title).toBe("design sync");
    expect(e.time?.localDate).toBe("2026-08-06");
  });

  it("leaves offsets valid against the ORIGINAL text", () => {
    // Blanking preserves length, so every span can still be sliced out of the
    // string the caller passed in. `titleSpan` and question `replaceSpan` both
    // depend on this.
    const text = "book the design sync in Operating Room 1 tomorrow at 3pm";
    const e = numbered(text);
    expect(e.titleSpan).toBeDefined();
    expect(text.slice(e.titleSpan!.start, e.titleSpan!.end)).toBe(
      "design sync",
    );
    for (const m of e.timeSpan?.mentions ?? []) {
      expect(text.slice(m.start, m.end)).toBe(m.text);
    }
  });
});
