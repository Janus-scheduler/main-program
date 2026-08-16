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
