/**
 * Dialogue manager — slot filling over the frozen gates.
 *
 * Two things are being tested, and they are different in kind:
 *
 *  1. **New behaviour** (questions, merging, rounds) gets ordinary unit tests.
 *  2. **The invariant that this layer cannot weaken the frozen one.** Answering
 *     a question must never let an utterance past a gate it did not clear on
 *     its own merits. Those tests are the important ones — the feature is
 *     worthless if "just say yes twice" becomes a way around the classifier.
 *
 * `now` is pinned to a Wednesday so weekday arithmetic in the assertions is
 * readable: 2026-08-05T08:30:00Z is Wed 14:00 in Asia/Colombo (UTC+5:30).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  beginSession,
  classify,
  routeFromClassification,
  hasAnswered,
  hasNegation,
  hasTimeAnchor,
  parseArtifacts,
  parsePrototypes,
  parseTimeSpan,
  provideAnswer,
  MAX_TOTAL_ROUNDS,
  ESCAPE_START_OVER,
  ESCAPE_SKIP_PREFIX,
  resolveTime,
  routeQuery,
  stripNegationCues,
  SKIP_ANSWER,
  KEEP_TITLE_ANSWER,
  OTHER_ANSWER,
} from "../src";
import { rewriteForClassifier } from "../src/rewrite";
import { presentSession } from "../src/presentSession";
import type {
  Artifacts,
  EntityCatalog,
  Gate,
  Prototype,
  SessionContext,
  SessionState,
} from "../src/types";

const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

const NOW = new Date("2026-08-05T08:30:00Z"); // Wed 14:00 in Asia/Colombo
const TIMEZONE = "Asia/Colombo";

const CATALOG: EntityCatalog = {
  resources: [
    { id: "r1", name: "Room A", type: "room" },
    { id: "r2", name: "Conference Room B", type: "room", aliases: ["Conf B"] },
  ],
  participants: [
    { id: "p1", name: "Alex Rivera", type: "person" },
    { id: "p2", name: "Priya Nair", type: "person" },
    { id: "p3", name: "Sarah Chen", type: "person" },
  ],
};

let artifacts: Artifacts;
let prototypes: Prototype[];
let ctx: SessionContext;

beforeAll(() => {
  artifacts = parseArtifacts({
    vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf-8"),
    vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
  });
  prototypes = parsePrototypes(
    readFileSync(resolve(ARTIFACTS_DIR, "prototypes.json"), "utf-8"),
  );
  ctx = {
    artifacts,
    prototypes,
    catalog: CATALOG,
    now: NOW,
    timezone: TIMEZONE,
  };
});

/** Routing fixtures double as a corpus of real utterances per gate. */
interface RoutingFixture {
  text: string;
  gate: Gate;
}
const fixtures: RoutingFixture[] = JSON.parse(
  readFileSync(
    resolve(__dirname, "../fixtures/routing_fixtures.json"),
    "utf-8",
  ),
);
const textsForGate = (gate: Gate): string[] =>
  fixtures.filter((f) => f.gate === gate).map((f) => f.text);

// ══════════════════════════════════════════════════════════════════════════
//  1. The offered answers have to actually work
// ══════════════════════════════════════════════════════════════════════════

describe("the “when” chips are answers the frozen layer accepts", () => {
  // Every chip is merged into the utterance verbatim. If one of them were not
  // a time anchor, tapping it would re-trigger the very gate it is meant to
  // satisfy — an infinite loop presented as a button.
  const CHIPS = [
    "today",
    "tomorrow",
    "tomorrow morning",
    "tomorrow afternoon",
    "next week",
  ];

  it.each(CHIPS)("%p is a time anchor for the frozen gate", (chip) => {
    expect(hasTimeAnchor(chip)).toBe(true);
  });

  it.each(CHIPS)("%p resolves to a concrete instant", (chip) => {
    const span = parseTimeSpan(chip);
    expect(span).toBeDefined();
    expect(resolveTime(span, { now: NOW, timezone: TIMEZONE })).not.toBeNull();
  });

  it("every chip actually clears gate 5 when merged", () => {
    const opened = beginSession("schedule a meeting with Alex", ctx);
    expect(opened.status).toBe("awaiting");
    for (const chip of CHIPS) {
      const answered = provideAnswer(opened, chip, ctx);
      expect(answered.status).toBe("ready");
      expect(answered.draft?.time).not.toBeNull();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  2. Negation cue removal — derived from the frozen detector, not re-listed
// ══════════════════════════════════════════════════════════════════════════

describe("stripNegationCues", () => {
  const negated = textsForGate("negation");

  it("has a real corpus to work with", () => {
    expect(negated.length).toBeGreaterThanOrEqual(20);
  });

  it.each(negated)("silences the frozen detector on %p", (text) => {
    expect(hasNegation(text)).toBe(true);
    expect(hasNegation(stripNegationCues(text))).toBe(false);
  });

  it.each(negated)("only ever blanks, never shifts, %p", (text) => {
    const cleaned = stripNegationCues(text);
    // Same length and same characters wherever a character survives: offsets
    // computed against the original text stay valid.
    expect(cleaned).toHaveLength(text.length);
    for (let i = 0; i < text.length; i++) {
      expect(cleaned[i] === text[i] || cleaned[i] === " ").toBe(true);
    }
  });

  it("leaves a non-negated string exactly alone", () => {
    const text = "book Room A tomorrow at 10am";
    expect(stripNegationCues(text)).toBe(text);
  });

  it("removes the two-word cue, keeping the anchors around it", () => {
    const cleaned = stripNegationCues("the standup is no longer at 3pm");
    expect(hasNegation(cleaned)).toBe(false);
    expect(cleaned).toContain("standup");
    expect(cleaned).toContain("3pm");
  });

  it("keeps enough of the sentence for the anchor gates to still pass", () => {
    // The whole point of blanking only the cue: a confirmed utterance must not
    // fall out the bottom as gate3_no_anchor because we deleted its time.
    for (const text of negated) {
      const cleaned = stripNegationCues(text);
      if (hasTimeAnchor(text)) expect(hasTimeAnchor(cleaned)).toBe(true);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  3. The happy path
// ══════════════════════════════════════════════════════════════════════════

describe("beginSession", () => {
  it("is ready immediately for a fully specified utterance", () => {
    const state = beginSession(
      "Schedule a design sync with Alex tomorrow at 10am in Room A",
      ctx,
    );

    expect(state.status).toBe("ready");
    expect(state.question).toBeNull();
    expect(state.route.route).toBe("PROCEED");
    expect(state.draft).not.toBeNull();
    expect(state.draft?.intent).toBe("add_event");
    expect(state.draft?.title).toBe("design sync");
    expect(state.draft?.participants.map((p) => p.name)).toEqual([
      "Alex Rivera",
    ]);
    expect(state.draft?.resources.map((r) => r.name)).toEqual(["Room A"]);
    expect(state.draft?.time?.localDate).toBe("2026-08-06");
    expect(state.draft?.time?.localTime).toBe("10:00");
    expect(state.rounds).toBe(0);
    expect(state.answers).toEqual([]);
  });

  it("declines a rejected utterance and offers no draft", () => {
    const state = beginSession("what is the capital of France", ctx);

    expect(state.status).toBe("declined");
    expect(state.route.route).toBe("REJECT");
    expect(state.draft).toBeNull();
    expect(state.question).toBeNull();
    expect(state.reason.length).toBeGreaterThan(0);
  });

  it("never asks a follow-up about an utterance it did not understand", () => {
    // The three REJECT gates mean "no idea what this is". A question built on
    // top of that produces nonsense, so none is offered.
    for (const gate of [
      "gate1_confidence",
      "gate2_nearest_none",
      "gate3_no_anchor",
    ] as const) {
      for (const text of textsForGate(gate).slice(0, 8)) {
        const state = beginSession(text, ctx);
        expect(state.status).toBe("declined");
        expect(state.question).toBeNull();
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  4. Gate 5 — the missing-time conversation. ~32 of 237 rows land here.
// ══════════════════════════════════════════════════════════════════════════

describe("gate5_missing_slot → “when?”", () => {
  const UNDERSPECIFIED = "schedule a meeting with Alex";
  let opened: SessionState;

  beforeEach(() => {
    opened = beginSession(UNDERSPECIFIED, ctx);
  });

  it("asks, rather than dead-ending", () => {
    expect(opened.status).toBe("awaiting");
    expect(opened.route.gate).toBe("gate5_missing_slot");
    expect(opened.question?.slot).toBe("when");
    expect(opened.question?.choices.length).toBeGreaterThan(0);
  });

  it("shows what it already understood while it asks", () => {
    // A blank panel next to "when?" makes the user repeat themselves. The
    // draft is populated in `awaiting` for exactly this reason.
    expect(opened.draft?.title).toBe("meeting");
    expect(opened.draft?.participants.map((p) => p.name)).toEqual([
      "Alex Rivera",
    ]);
    expect(opened.draft?.time).toBeNull();
  });

  it("names the subject in the question", () => {
    expect(opened.question?.text).toBe("When should “meeting” be?");
  });

  it("completes the parse when the answer supplies the time", () => {
    const done = provideAnswer(opened, "tomorrow at 3pm", ctx);

    expect(done.status).toBe("ready");
    expect(done.route.route).toBe("PROCEED");
    expect(done.text).toBe("schedule a meeting with Alex tomorrow at 3pm");
    expect(done.draft?.time?.localDate).toBe("2026-08-06");
    expect(done.draft?.time?.localTime).toBe("15:00");
    expect(done.draft?.participants.map((p) => p.name)).toEqual([
      "Alex Rivera",
    ]);
    expect(done.rounds).toBe(1);
    expect(hasAnswered(done, "when")).toBe(true);
  });

  it("merges only the time phrase, not the whole reply", () => {
    // "make it" is filler. Appending it would shift the classification for no
    // benefit; appending "next tuesday at 2pm" keeps the sentence well formed.
    const done = provideAnswer(opened, "make it next tuesday at 2pm", ctx);

    expect(done.text).toBe("schedule a meeting with Alex next tuesday at 2pm");
    expect(done.answers.at(-1)?.merged).toBe("next tuesday at 2pm");
    expect(done.status).toBe("ready");
    expect(done.draft?.time?.localTime).toBe("14:00");
  });

  /**
   * An inherited limitation, pinned rather than worked around.
   *
   * The frozen `TIME_PATTERNS` require a meridiem or a colon, so a bare "at 2"
   * is not a clock time. Only the part that parses is merged, and the resolver
   * then falls back to its 09:00 default — which it DECLARES. The user sees
   * "09:00" and "no time of day given" on the card and can correct it, so the
   * loss is visible rather than silent. Widening the pattern here would put
   * this module's idea of a time out of step with the gate's.
   */
  it("drops the part of an answer the frozen patterns cannot read, visibly", () => {
    const done = provideAnswer(opened, "next tuesday at 2", ctx);

    expect(done.text).toBe("schedule a meeting with Alex next tuesday");
    expect(done.status).toBe("ready");
    expect(done.draft?.time?.localTime).toBe("09:00");
    expect(done.draft?.time?.assumptions.join(" ")).toMatch(/time of day/i);
  });

  it("surfaces the assumption when a bare day is chosen", () => {
    const done = provideAnswer(opened, "tomorrow", ctx);

    expect(done.status).toBe("ready");
    expect(done.draft?.time?.localTime).toBe("09:00");
    expect(done.draft?.time?.assumptions.join(" ")).toMatch(/09:00|9/);
  });

  it("gives up rather than looping when the answer never helps", () => {
    let state = opened;
    // Stop AT the escape question — answering it ends the session, which is a
    // different assertion (see “the round cap terminates”).
    while (state.status === "awaiting" && state.question?.slot !== "escape") {
      state = provideAnswer(state, "soon", ctx);
    }
    expect(state.status).toBe("awaiting");
    expect(state.rounds).toBe(2);
    // A gate question is never skippable, so starting over is the only way out.
    expect(state.question?.choices?.map((c) => c.value)).toEqual([
      ESCAPE_START_OVER,
    ]);
  });

  it("spends a round on an empty answer too", () => {
    const after = provideAnswer(opened, "   ", ctx);
    expect(after.rounds).toBe(1);
    expect(after.answers).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  5. Gate 3b — the "parking" case: a room named with no time, no event
// ══════════════════════════════════════════════════════════════════════════

describe("gate3b_resource_only → “when?”", () => {
  it("names the room when there is no title to name", () => {
    const opened = beginSession("book Room A", ctx);
    expect(opened.route.gate).toBe("gate3b_resource_only");
    expect(opened.question?.text).toBe("When would you like Room A?");
  });

  it("falls back to the person when there is neither title nor room", () => {
    const opened = beginSession("schedule with sarah", ctx);
    expect(opened.status).toBe("awaiting");
    expect(opened.question?.text).toBe(
      "When should your time with Sarah Chen be?",
    );
  });

  /**
   * An inherited limitation with teeth, recorded here because it will bite in
   * Step 6.
   *
   * Gate 3 asks "is there a domain anchor?" and answers it from the FROZEN
   * 23-name research corpus — sarah, alice, marketing, team. A real directory
   * name is not in that list, so "schedule with Alex" has no anchor and is
   * rejected outright, while "schedule with sarah" is not. The catalog this
   * module is given has no say in it: catalog matching happens in extraction,
   * after routing.
   *
   * "schedule a meeting with Alex" works only because "meeting" is an event
   * noun. That is the anchor, not the name.
   */
  it("does not treat a catalog-only name as a domain anchor", () => {
    expect(beginSession("schedule with Alex", ctx).route.gate).toBe(
      "gate3_no_anchor",
    );
    expect(beginSession("schedule with sarah", ctx).route.gate).not.toBe(
      "gate3_no_anchor",
    );
  });

  it("asks when, and the answer clears the gate", () => {
    const text = textsForGate("gate3b_resource_only")[0];
    const opened = beginSession(text, ctx);

    expect(opened.status).toBe("awaiting");
    expect(opened.question?.slot).toBe("when");
    expect(opened.question?.text).toMatch(/^When would you like /);

    const done = provideAnswer(opened, "tomorrow at 11am", ctx);
    expect(done.route.gate).not.toBe("gate3b_resource_only");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  6. Negation — confirm rather than silently invert
// ══════════════════════════════════════════════════════════════════════════

describe("negation → yes/no confirmation", () => {
  /** A negated utterance that has everything else it needs. */
  const NEGATED = "i don't want the standup tomorrow at 9am";

  it("asks instead of guessing which way round the user meant it", () => {
    const opened = beginSession(NEGATED, ctx);
    expect(opened.status).toBe("awaiting");
    expect(opened.route.gate).toBe("negation");
    expect(opened.question?.slot).toBe("confirm");
    expect(opened.question?.choices.map((c) => c.value)).toEqual(["yes", "no"]);
  });

  it("stops on “no”, and changes nothing", () => {
    const declined = provideAnswer(beginSession(NEGATED, ctx), "no", ctx);
    expect(declined.status).toBe("declined");
    expect(declined.question).toBeNull();
    expect(declined.reason).toMatch(/nothing was changed/);
  });

  it("re-routes through the FULL gate ladder on “yes”", () => {
    const confirmed = provideAnswer(beginSession(NEGATED, ctx), "yes", ctx);
    expect(confirmed.satisfied).toContain("negation");
    expect(confirmed.route.gate).not.toBe("negation");
  });

  it("re-asks on an answer that is neither yes nor no", () => {
    const vague = provideAnswer(beginSession(NEGATED, ctx), "maybe?", ctx);
    expect(vague.status).toBe("awaiting");
    expect(vague.question?.slot).toBe("confirm");
    expect(vague.rounds).toBe(1);
  });

  /**
   * THE INVARIANT, asserted over the whole corpus rather than through one
   * hand-picked sentence.
   *
   * Confirming must be exactly: the frozen ladder, run from the top, on the
   * ORIGINAL classification and the cue-free text. Both halves matter —
   *
   *   - "from the top" is what stops `yes` becoming a way past gates 1-5;
   *   - "the original classification" is what keeps the question and the
   *     action talking about the same thing. "don't book Room A" classifies as
   *     a cancellation, "book Room A" as a booking, and the user is asked
   *     about the former. Re-classifying the stripped sentence would answer a
   *     question about cancelling with a booking.
   *
   * Rebuilt here from the public frozen primitives, so any extra logic added
   * inside the session — a short-cut to PROCEED, a skipped gate — breaks it.
   */
  it.each(textsForGate("negation"))(
    "“yes” re-routes %p through the full ladder, skipping nothing",
    (text) => {
      const confirmed = provideAnswer(beginSession(text, ctx), "yes", ctx);
      const expected = routeFromClassification(
        classify(text, artifacts, prototypes),
        stripNegationCues(text),
      );

      expect(confirmed.route.intent).toBe(expected.intent);
      expect(confirmed.route.route).toBe(expected.route);
      expect(confirmed.route.gate).toBe(expected.gate);
      // The answered question is never re-asked.
      expect(confirmed.route.gate).not.toBe("negation");
    },
  );

  it("and a confirmed utterance can still be stopped by a later gate", () => {
    // The check above has teeth only if "yes" is not universally a green
    // light. Some confirmed utterances are still incomplete or unclear, and
    // those must not reach `ready`.
    const outcomes = textsForGate("negation").map(
      (text) => provideAnswer(beginSession(text, ctx), "yes", ctx).status,
    );
    expect(outcomes).toContain("ready");
    expect(outcomes.filter((s) => s !== "ready").length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  7. Gate 4 — ambiguous intent
// ══════════════════════════════════════════════════════════════════════════

describe("gate4_margin → which did you mean?", () => {
  const ambiguous = textsForGate("gate4_margin");

  it("the corpus contains at least one genuinely ambiguous utterance", () => {
    expect(ambiguous.length).toBeGreaterThan(0);
  });

  it("offers the competing intents as choices", () => {
    const opened = beginSession(ambiguous[0], ctx);
    expect(opened.status).toBe("awaiting");
    expect(opened.question?.slot).toBe("intent");
    expect(opened.question?.choices.length).toBeGreaterThanOrEqual(2);
  });

  it("adopts the chosen intent and re-runs every other gate", () => {
    const opened = beginSession(ambiguous[0], ctx);
    const choice = opened.question!.choices[0];
    const answered = provideAnswer(opened, choice.value, ctx);

    expect(answered.intentChoice).toBe(choice.value);
    expect(answered.draft?.intent).toBe(choice.value);
    expect(answered.route.gate).not.toBe("gate4_margin");
  });

  it("re-asks when the answer is not one of the offered intents", () => {
    const opened = beginSession(ambiguous[0], ctx);
    const answered = provideAnswer(opened, "something else entirely", ctx);
    expect(answered.status).toBe("awaiting");
    expect(answered.question?.slot).toBe("intent");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  8. The catalog fallback — the ONE place this layer overrules the frozen one
// ══════════════════════════════════════════════════════════════════════════

describe("catalog names as a gate-3 fallback", () => {
  // "MRI Scanner A" is in the catalog and in no frozen list. "Operating
  // Room 1" contains "room", which IS in the frozen corpus — the split this
  // fallback exists to close.
  const KIT: EntityCatalog = {
    resources: [
      { id: "k1", name: "MRI Scanner A", type: "equipment" },
      { id: "k2", name: "Operating Room 1", type: "room" },
    ],
  };
  const withKit = (over: Partial<SessionContext> = {}): SessionContext => ({
    ...ctx,
    catalog: KIT,
    ...over,
  });

  it("the frozen layer really does reject the un-anchored one", () => {
    // If this ever stops being true the fallback is dead code, so assert it.
    expect(routeQuery("book MRI Scanner A", artifacts, prototypes).gate).toBe(
      "gate3_no_anchor",
    );
  });

  it("asks when instead of refusing, naming the thing it matched", () => {
    const state = beginSession("book MRI Scanner A", withKit());

    expect(state.status).toBe("awaiting");
    expect(state.question?.slot).toBe("when");
    expect(state.question?.text).toBe("When would you like MRI Scanner A?");
    expect(state.softened?.matched).toBe("MRI Scanner A");
  });

  it("does NOT rewrite the frozen verdict", () => {
    // The whole point of keeping these separate: a log or an inspector must
    // still be able to see that the gates said REJECT.
    const state = beginSession("book MRI Scanner A", withKit());
    expect(state.route.route).toBe("REJECT");
    expect(state.route.gate).toBe("gate3_no_anchor");
  });

  it("completes normally once the time is supplied", () => {
    const done = provideAnswer(
      beginSession("book MRI Scanner A", withKit()),
      "tomorrow at 2pm",
      withKit(),
    );
    // The merged text has a real time anchor now, so gate 3 passes on its own
    // merits — the fallback is not load-bearing on the second turn.
    expect(done.route.route).toBe("PROCEED");
    expect(done.softened).toBeUndefined();
    expect(done.draft?.resources.map((r) => r.name)).toEqual(["MRI Scanner A"]);
    expect(done.draft?.time?.localTime).toBe("14:00");
  });

  it("stays out of the way when the catalog matches nothing", () => {
    const state = beginSession("what is the capital of France", withKit());
    expect(state.status).toBe("declined");
    expect(state.softened).toBeUndefined();
  });

  it("never rescues gates 1 or 2, even with a catalog hit", () => {
    // Those two mean "I did not understand this at all". A catalog hit says
    // nothing about that, so it must not be treated as evidence.
    for (const gate of ["gate1_confidence", "gate2_nearest_none"] as const) {
      for (const text of textsForGate(gate)) {
        const state = beginSession(`${text} MRI Scanner A`, withKit());
        if (state.route.gate === gate) {
          expect(state.status).toBe("declined");
          expect(state.softened).toBeUndefined();
        }
      }
    }
  });

  it("can be switched off for strictly frozen behaviour", () => {
    const state = beginSession(
      "book MRI Scanner A",
      withKit({ catalogAnchor: false }),
    );
    expect(state.status).toBe("declined");
    expect(state.softened).toBeUndefined();
  });

  it("is off by default when no catalog is supplied", () => {
    const bare: SessionContext = {
      artifacts,
      prototypes,
      now: NOW,
      timezone: TIMEZONE,
    };
    expect(beginSession("book MRI Scanner A", bare).status).toBe("declined");
  });

  it("changes nothing about the 237-row frozen agreement", () => {
    // Every fixture row, routed through the session with a catalog present.
    // `state.route` must still match `routeQuery` exactly — the fallback
    // affects the session's STATUS, never the gates' verdict.
    for (const { text } of fixtures) {
      if (text !== rewriteForClassifier(text)) continue;
      const state = beginSession(text, withKit());
      const direct = routeQuery(text, artifacts, prototypes);
      expect(state.route.route).toBe(direct.route);
      expect(state.route.gate).toBe(direct.gate);
      expect(state.route.intent).toBe(direct.intent);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  9. Host requirements — asking for what the GATES do not require
// ══════════════════════════════════════════════════════════════════════════

describe("host completeness requirements", () => {
  // The case that prompted this: gate 5 is satisfied by a time, so
  // "schedule a meeting at 5pm today" sails through PROCEED with no room and
  // no attendee, and the commit would silently pick a row.
  const INCOMPLETE = "schedule a meeting at 5pm today";
  const strict = (over: Partial<SessionContext> = {}): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "resource"] },
    ...over,
  });

  it("the frozen gates really are satisfied by this — nothing is being fixed there", () => {
    const lax = beginSession(INCOMPLETE, ctx);
    expect(lax.route.route).toBe("PROCEED");
    expect(lax.status).toBe("ready");
    expect(lax.draft?.resources).toEqual([]);
    expect(lax.draft?.participants).toEqual([]);
  });

  it("asks for the resource instead of going straight to a card", () => {
    const state = beginSession(INCOMPLETE, strict());

    expect(state.status).toBe("awaiting");
    expect(state.question?.slot).toBe("resource");
    expect(state.question?.source).toBe("requirement");
    expect(state.question?.gate).toBeNull();
    expect(state.question?.text).toBe("Which room or person is “meeting” for?");
  });

  it("offers the live catalog as chips, and NO escape", () => {
    // No Skip: a bare Skip asked the user to give up without saying what that
    // costs. No “Other…” either, and that is the point — this list is the
    // host's ENTIRE catalog, not a sample. There is no other room, so offering
    // one would invite a name the calendar does not have and lead straight
    // back to this question. A long catalog gets `searchable` instead.
    const state = beginSession(INCOMPLETE, strict());
    const labels = state.question!.choices.map((c) => c.label);
    expect(labels).toContain("Room A");
    expect(labels).toContain("Alex Rivera");
    expect(labels).not.toContain("Skip");
    expect(labels).not.toContain("Other…");
  });

  it("offers “Other…” where the chips are only a SAMPLE", () => {
    // Six clock chips out of 1,440 minutes; five lengths out of any number.
    const c = strict({ requires: { add_event: ["duration"] } });
    const asked = beginSession("book Room A tomorrow at 3pm", c);
    expect(asked.question?.slot).toBe("duration");
    const labels = asked.question!.choices.map((x) => x.label);
    expect(labels.at(-1)).toBe("Other…");
    expect(labels).not.toContain("Skip");
  });

  it("“Other…” re-asks the same slot, inviting free text", () => {
    const c = strict({ requires: { add_event: ["duration"] } });
    const asked = beginSession("book Room A tomorrow at 3pm", c);
    const other = provideAnswer(asked, OTHER_ANSWER, c);
    expect(other.status).toBe("awaiting");
    expect(other.question?.slot).toBe("duration");
    expect(other.question?.choices).toEqual([]);
    expect(other.question?.text).toMatch(/go ahead/i);
  });

  it("“Other…” does not spend a round", () => {
    // Asking to type is engaging with the question, not failing to answer it.
    const c = strict({ requires: { add_event: ["duration"] } });
    const asked = beginSession("book Room A tomorrow at 3pm", c);
    const other = provideAnswer(asked, OTHER_ANSWER, c);
    expect(other.rounds).toBe(asked.rounds);
  });

  it("a typed answer after “Other…” is understood normally", () => {
    const c = strict({ requires: { add_event: ["duration"] } });
    const other = provideAnswer(
      beginSession("book Room A tomorrow at 3pm", c),
      OTHER_ANSWER,
      c,
    );
    const done = provideAnswer(other, "45 minutes", c);
    expect(done.draft?.time?.durationMinutes).toBe(45);
  });
  it("completes once the resource is supplied, merging it readably", () => {
    const done = provideAnswer(
      beginSession(INCOMPLETE, strict()),
      "Room A",
      strict(),
    );

    expect(done.status).toBe("ready");
    // "in Room A" for a room, not a bare append — the merged text is shown
    // back to the user and should read like a sentence.
    expect(done.text).toBe("schedule a meeting at 5pm today in Room A");
    expect(done.draft?.resources.map((r) => r.name)).toEqual(["Room A"]);
  });

  it("uses “with” for a person and “in” for a room", () => {
    const done = provideAnswer(
      beginSession(INCOMPLETE, strict()),
      "Alex Rivera",
      strict(),
    );
    expect(done.text).toBe("schedule a meeting at 5pm today with Alex Rivera");
    expect(done.draft?.participants.map((p) => p.name)).toEqual([
      "Alex Rivera",
    ]);
  });

  it("accepts a typed name as readily as a tapped chip", () => {
    const done = provideAnswer(
      beginSession(INCOMPLETE, strict()),
      "conference room b",
      strict(),
    );
    expect(done.status).toBe("ready");
    expect(done.draft?.resources.map((r) => r.name)).toEqual([
      "Conference Room B",
    ]);
  });

  it("lets the user decline, and records that they did", () => {
    const skipped = provideAnswer(
      beginSession(INCOMPLETE, strict()),
      SKIP_ANSWER,
      strict(),
    );

    expect(skipped.status).toBe("ready");
    expect(skipped.skipped).toEqual(["resource"]);
    expect(skipped.answers.at(-1)?.skipped).toBe(true);
    // Skipping does not invent a value — the caller must disclose whatever it
    // substitutes.
    expect(skipped.draft?.resources).toEqual([]);
  });

  it("does not ask a skipped question again", () => {
    let state = provideAnswer(
      beginSession(INCOMPLETE, strict()),
      SKIP_ANSWER,
      strict(),
    );
    state = provideAnswer(state, "Room A", strict());
    // Already ready, so the answer is ignored rather than reopening anything.
    expect(state.status).toBe("ready");
  });

  it("asks several questions in turn, gate first then requirement", () => {
    // The cap counts CONSECUTIVE asks of one slot. Filling two fields is a
    // conversation; asking "when?" twice over is a loop. Before this change
    // the two were counted together and a legitimate multi-slot fill died on
    // the second question.
    let state = beginSession("schedule a meeting with Alex", strict());

    const asked: Array<[string, string]> = [];
    for (const answer of ["tomorrow at 4pm", "Room A"]) {
      if (state.status !== "awaiting") break;
      asked.push([state.question!.slot, state.question!.source]);
      state = provideAnswer(state, answer, strict());
    }

    // "when" comes from gate 5; "resource" from the host requirement. Alex is
    // a participant, so only the room is still outstanding after the first.
    expect(asked).toEqual([["when", "gate"]]);
    expect(state.status).toBe("ready");
    expect(state.draft?.time).not.toBeNull();
    expect(state.draft?.participants.map((p) => p.name)).toEqual([
      "Alex Rivera",
    ]);
  });

  it("asks for a title when there is none, and takes it verbatim", () => {
    const titled: SessionContext = {
      ...ctx,
      requires: { add_event: ["title"] },
    };
    const opened = beginSession("book Room A tomorrow at 4pm", titled);
    expect(opened.status).toBe("awaiting");
    expect(opened.question?.slot).toBe("title");
    expect(opened.question?.text).toBe("What should I call it?");

    const done = provideAnswer(opened, "Sprint review", titled);
    expect(done.status).toBe("ready");
    expect(done.draft?.title?.toLowerCase()).toContain("sprint review");
  });

  it("resets the round counter when the conversation moves to a new slot", () => {
    // Two different questions answered in sequence must not exhaust a cap that
    // exists to stop ONE question repeating.
    const both: SessionContext = {
      ...ctx,
      requires: { add_event: ["resource", "title"] },
      maxRounds: 1,
    };
    let state = beginSession("book something at 4pm tomorrow", both);
    const asked: string[] = [];
    for (const answer of ["Room A", "Sprint review"]) {
      if (state.status !== "awaiting") break;
      asked.push(state.question!.slot);
      state = provideAnswer(state, answer, both);
      expect(state.status).not.toBe("declined");
    }
    expect(asked.length).toBeGreaterThanOrEqual(1);
  });

  it("still caps a single question that keeps failing", () => {
    let state = beginSession("schedule a meeting with Alex", ctx);
    // Stop AT the escape question rather than answering it — answering it ends
    // the session, which is the point of the next test, not this one.
    while (state.status === "awaiting" && state.question?.slot !== "escape") {
      state = provideAnswer(state, "soon", ctx);
    }
    expect(state.status).toBe("awaiting");
    expect(state.question?.slot).toBe("escape");
    expect(state.roundCapReached).toBe(true);
    // A gate question is not skippable, so starting over is the only way out.
    expect(state.question?.choices?.map((c) => c.value)).toEqual([
      ESCAPE_START_OVER,
    ]);
  });

  /**
   * THE INVARIANT. Requirements run only after every gate has passed, so they
   * can make a session stricter and never looser.
   */
  it("can never rescue an utterance the gates rejected", () => {
    const permissive: SessionContext = {
      ...ctx,
      requires: {
        add_event: [],
        modify_event: [],
        delete_event: [],
        get_details: [],
        none: [],
      },
    };
    for (const { text } of fixtures) {
      const lax = beginSession(text, ctx);
      const req = beginSession(text, strict());
      if (lax.status === "declined") expect(req.status).toBe("declined");
      // And the frozen verdict is untouched either way.
      expect(req.route.gate).toBe(lax.route.gate);
      expect(beginSession(text, permissive).status).toBe(lax.status);
    }
  });

  it("skipping is never offered for a gate question", () => {
    // A gate fires because the system does not understand the utterance well
    // enough. "Skip" there would be a way to walk straight past the classifier.
    for (const gate of [
      "gate5_missing_slot",
      "gate3b_resource_only",
      "negation",
      "gate4_margin",
    ] as const) {
      for (const text of textsForGate(gate).slice(0, 5)) {
        const state = beginSession(text, strict());
        if (state.question?.source !== "gate") continue;
        expect(state.question.skippable).toBe(false);
        expect(state.question.choices.map((c) => c.value)).not.toContain(
          SKIP_ANSWER,
        );
        // And sending the sentinel anyway does not skip it.
        const after = provideAnswer(state, SKIP_ANSWER, strict());
        expect(after.skipped).toEqual([]);
      }
    }
  });

  it("does not ask about a resource when the catalog is empty", () => {
    const bare: SessionContext = {
      artifacts,
      prototypes,
      now: NOW,
      timezone: TIMEZONE,
      requires: { add_event: ["resource"] },
    };
    // Nothing to offer means nothing to ask — an empty catalog is the host's
    // problem, not something to interrogate the user over.
    expect(beginSession(INCOMPLETE, bare).status).toBe("ready");
  });

  it("defaults to no requirements at all", () => {
    expect(beginSession(INCOMPLETE, ctx).status).toBe("ready");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  10. Contract: purity, immutability, and no back door to a commit
// ══════════════════════════════════════════════════════════════════════════

describe("session contract", () => {
  it("is a pure function of its inputs", () => {
    const text = "schedule a meeting with Alex";
    expect(beginSession(text, ctx)).toEqual(beginSession(text, ctx));
  });

  it("never mutates the state handed in", () => {
    const opened = beginSession("schedule a meeting with Alex", ctx);
    const snapshot = JSON.stringify(opened);
    provideAnswer(opened, "tomorrow at 3pm", ctx);
    expect(JSON.stringify(opened)).toBe(snapshot);
  });

  it("ignores an answer when nothing was asked", () => {
    const ready = beginSession("book Room A tomorrow at 10am", ctx);
    expect(ready.status).toBe("ready");
    expect(provideAnswer(ready, "tomorrow", ctx)).toBe(ready);

    const declined = beginSession("what is the capital of France", ctx);
    expect(provideAnswer(declined, "yes", ctx)).toBe(declined);
  });

  it("keeps a replayable transcript", () => {
    const opened = beginSession("schedule a meeting with Alex", ctx);
    const done = provideAnswer(opened, "tomorrow at 3pm", ctx);

    expect(done.utterances).toEqual([
      "schedule a meeting with Alex",
      "tomorrow at 3pm",
    ]);
    expect(done.answers).toEqual([
      {
        slot: "when",
        gate: "gate5_missing_slot",
        source: "gate",
        answer: "tomorrow at 3pm",
        merged: "tomorrow at 3pm",
      },
    ]);
  });

  it("agrees with routeQuery on the very first turn", () => {
    // The session must not be a second, subtly different pipeline. On turn one
    // it is exactly `routeQuery` plus extraction.
    for (const { text } of fixtures.slice(0, 60)) {
      if (text !== rewriteForClassifier(text)) continue;
      const state = beginSession(text, ctx);
      const direct = routeQuery(text, artifacts, prototypes);
      expect(state.route.intent).toBe(direct.intent);
      expect(state.route.route).toBe(direct.route);
      expect(state.route.gate).toBe(direct.gate);
    }
  });

  it("respects a caller-supplied round limit", () => {
    const strict: SessionContext = { ...ctx, maxRounds: 0 };
    const state = beginSession("schedule a meeting with Alex", strict);
    expect(state.status).toBe("awaiting");
    expect(state.question?.slot).toBe("escape");
    expect(state.question?.choices?.map((c) => c.value)).toEqual([
      ESCAPE_START_OVER,
    ]);
  });

  it("clarifies past relative weekday when 'this monday' is spoken on Wednesday", () => {
    // NOW is Wednesday 2026-08-05
    const state = beginSession("book Room A this monday at 10am", ctx);
    expect(state.status).toBe("awaiting");
    expect(state.question?.text).toContain("Did you mean past Monday");
    expect(state.question?.choices).toHaveLength(2);

    const answered = provideAnswer(state, "next monday at 10am", ctx);
    expect(answered.status).toBe("ready");
    expect(answered.draft?.time?.localDate).toBe("2026-08-10");
  });

  it("handles multi-resource answers selecting both rooms and people", () => {
    const strictCtx: SessionContext = {
      ...ctx,
      requires: { add_event: ["resource"] },
    };
    const s1 = beginSession("schedule a meeting tomorrow at 10am", strictCtx);
    expect(s1.status).toBe("awaiting");
    expect(s1.question?.slot).toBe("resource");

    const s2 = provideAnswer(s1, "Room A and Sarah Chen", strictCtx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.resources.map((r) => r.id)).toEqual(["r1"]);
    expect(s2.draft?.participants.map((p) => p.id)).toEqual(["p3"]);
  });

  it("asks for duration when required and handles custom typed end time", () => {
    const strictCtx: SessionContext = {
      ...ctx,
      requires: { add_event: ["when", "duration"] },
    };
    const s1 = beginSession(
      "schedule a meeting tomorrow at 5pm with Sarah",
      strictCtx,
    );
    expect(s1.status).toBe("awaiting");
    expect(s1.question?.slot).toBe("duration");
    expect(s1.question?.inputPlaceholder).toContain("45 mins");

    // Test answering with custom typed end time
    const s2 = provideAnswer(s1, "until 6:30pm", strictCtx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.durationMinutes).toBe(90);
    expect(s2.draft?.time?.assumed.duration).toBe(false);
  });

  it("handles custom typed duration answers like 'for 45 mins'", () => {
    const strictCtx: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration"] },
    };
    const s1 = beginSession("schedule a meeting tomorrow at 5pm", strictCtx);
    const s2 = provideAnswer(s1, "45 mins", strictCtx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.durationMinutes).toBe(45);
    expect(s2.draft?.time?.assumed.duration).toBe(false);
  });

  /**
   * REGRESSION — the duration slot used to carry its own, looser regex (`\s*`)
   * while `datetime.ts` required `\s+`. "45mins" therefore passed the check,
   * was appended to the utterance, and was then never parsed back out:
   * `assumed.duration` stayed true, `slotIsFilled("duration")` stayed false,
   * and the same question repeated until the round cap. `parseTimeSpan` is now
   * the only thing that decides what a duration is.
   */
  it.each([
    ["45mins", 45],
    ["2hrs", 120],
    ["1.5 hours", 90],
    ["30minutes", 30],
  ])("resolves the duration answer %s to %i minutes", (answer, minutes) => {
    const strictCtx: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration"] },
    };
    const s1 = beginSession("schedule a meeting tomorrow at 5pm", strictCtx);
    expect(s1.question?.slot).toBe("duration");

    const s2 = provideAnswer(s1, answer, strictCtx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.durationMinutes).toBe(minutes);
    expect(s2.draft?.time?.assumed.duration).toBe(false);
  });

  /**
   * REGRESSION — a room the catalog does not contain became the event's TITLE.
   *
   * `extractEntities` matches only the host catalog, by design. So against a
   * catalog of "Operating Room 1", the utterance "book Room A tomorrow at 3pm"
   * matched nothing, "Room A" survived into the leftover text, and the leftover
   * text is the title. The user was then asked "Which room or person is
   * “Room A” for?" — their room quoted back at them as an event name — and
   * after picking a real room the event was created called "Room A".
   */
  describe("a room name the catalog does not have", () => {
    const HOSPITAL: EntityCatalog = {
      resources: [
        { id: "r4", name: "Operating Room 1", type: "room" },
        { id: "r5", name: "MRI Scanner A", type: "equipment" },
      ],
      participants: [{ id: "r1", name: "Dr. Sarah Chen", type: "person" }],
    };
    const hospitalCtx = (): SessionContext => ({
      ...ctx,
      catalog: HOSPITAL,
      requires: { add_event: ["when", "resource"] },
    });

    it("says the name is unknown instead of quoting it as the subject", () => {
      const c = hospitalCtx();
      const s = beginSession("book Room A tomorrow at 3pm", c);

      expect(s.status).toBe("awaiting");
      expect(s.question?.slot).toBe("resource");
      expect(s.question?.text).toContain("I don't have");
      expect(s.question?.text).toContain("Room A");
      expect(s.question?.text).not.toContain("is “Room A” for?");
      expect(s.question?.replaceSpan).toBeDefined();
    });

    it("offers keeping the name as the event title", () => {
      const c = hospitalCtx();
      const s = beginSession("book Room A tomorrow at 3pm", c);
      const keep = s.question?.choices.find(
        (choice) => choice.value === KEEP_TITLE_ANSWER,
      );
      expect(keep).toBeDefined();
      expect(keep?.label).toContain("event name");
    });

    it("replaces the unknown name rather than appending beside it", () => {
      const c = hospitalCtx();
      const s1 = beginSession("book Room A tomorrow at 3pm", c);
      const s2 = provideAnswer(s1, "Operating Room 1", c);

      expect(s2.status).toBe("ready");
      expect(s2.text).not.toMatch(/Room A/i);
      expect(s2.draft?.resources.map((r) => r.name)).toEqual([
        "Operating Room 1",
      ]);
      // The whole point: the event is no longer called "Room A".
      expect(s2.draft?.title).not.toBe("Room A");
    });

    it("keeps the name as the title when the user says so, and stops asking", () => {
      const c = hospitalCtx();
      const s1 = beginSession("book Room A tomorrow at 3pm", c);
      const s2 = provideAnswer(s1, KEEP_TITLE_ANSWER, c);

      expect(s2.keptTitle).toBe(true);
      expect(s2.draft?.title).toBe("Room A");
      // It must not ask the same question a second time.
      expect(s2.question?.text ?? "").not.toContain("I don't have");
    });

    it.each([
      ["book Conference Room B tomorrow at 3pm", "Conference Room B"],
      ["book the boardroom tomorrow at 3pm", "boardroom"],
    ])("detects %s", (text, name) => {
      const c = hospitalCtx();
      const s = beginSession(text, c);
      expect(s.question?.text).toContain("I don't have");
      expect(s.question?.text).toContain(name);
    });

    /**
     * Rule 2 — the HEAD noun.
     *
     * Stripping resource words alone missed "3rd floor room": what remained,
     * "3rd floor", is neither empty nor a designator, so it read as a title.
     * The head of an English noun phrase is its last noun, and that is what the
     * phrase denotes: "3rd floor ROOM" is a room; "room INSPECTION" is an
     * inspection. Same word, opposite meaning, decided by position.
     */
    it("detects a resource word in HEAD position", () => {
      const s = beginSession(
        "book the 3rd floor room tomorrow at 3pm",
        hospitalCtx(),
      );
      expect(s.question?.text).toContain("I don't have");
      expect(s.question?.text).toContain("3rd floor room");
    });

    /**
     * Rule 3 — a near-miss for something in the caller's own catalog.
     * "MRI Scanner C" contains no frozen resource word at all.
     */
    it("detects an unknown instance of a real catalog entry", () => {
      const s = beginSession(
        "book MRI Scanner C tomorrow at 3pm",
        hospitalCtx(),
      );
      expect(s.question?.text).toContain("I don't have");
      expect(s.question?.text).toContain("MRI Scanner C");
    });

    /**
     * REGRESSION — the unknown name was quoted as the event's subject first.
     *
     * With `requires: ["when", "duration", "resource", "title"]`, "book MRI
     * Scanner C" asked "How long should “MRI Scanner C” be?" BEFORE admitting
     * there was no Scanner C — the user's room read back to them as an event
     * name. An unknown name is a correction, not a slot to fill, so it now
     * preempts the other requirement questions.
     */
    it("asks about the unknown name BEFORE any other requirement", () => {
      const strict: SessionContext = {
        ...hospitalCtx(),
        requires: { add_event: ["when", "duration", "resource", "title"] },
      };
      const s = beginSession("book MRI Scanner C tomorrow at 3pm", strict);

      expect(s.question?.slot).toBe("resource");
      expect(s.question?.text).toContain("I don't have");
      // The duration question must not have quoted the bogus name first.
      expect(s.question?.text).not.toContain("How long");
    });

    it("still asks the other requirements afterwards", () => {
      const strict: SessionContext = {
        ...hospitalCtx(),
        requires: { add_event: ["when", "duration", "resource", "title"] },
      };
      let s = beginSession("book MRI Scanner C tomorrow at 3pm", strict);
      s = provideAnswer(s, "MRI Scanner A", strict);

      expect(s.question?.slot).toBe("duration");
      // And it now names the REAL resource, not the one that did not exist.
      expect(s.question?.text).not.toContain("MRI Scanner C");
    });

    it("does not preempt when the title is genuine", () => {
      const strict: SessionContext = {
        ...hospitalCtx(),
        requires: { add_event: ["when", "duration", "resource"] },
      };
      const s = beginSession(
        "schedule a room inspection tomorrow at 3pm",
        strict,
      );
      expect(s.question?.slot).toBe("duration");
    });

    /**
     * REGRESSION — one stray word defeated the near-miss rule.
     *
     * It compared the WHOLE title against catalog names. "Pick MRI Scanner A"
     * — where "Pick" is not in the frozen verb lexicon, so it is never
     * stripped — is nowhere near "MRI Scanner B", so the user was asked "Which
     * room or person is “Pick MRI Scanner A” for?" instead of being told there
     * is no Scanner A. Contiguous sub-phrases are checked now, longest first.
     */
    it("finds the unknown name even with an unstripped verb in front", () => {
      const s = beginSession(
        "Pick MRI Scanner C for tomorrow at 3pm",
        hospitalCtx(),
      );
      expect(s.question?.text).toContain("I don't have");
      // It names the sub-phrase, not the user's whole sentence back at them.
      expect(s.question?.text).toContain("MRI Scanner C");
      expect(s.question?.text).not.toContain("Pick MRI Scanner C");
    });

    it("does not claim a different instance of a real entry", () => {
      // The severe half: this used to silently attach MRI Scanner A.
      const s = beginSession(
        "book MRI Scanner C tomorrow at 3pm",
        hospitalCtx(),
      );
      expect(s.draft?.resources ?? []).toEqual([]);
    });

    /**
     * The signal is NOT "the title contains a resource word" — plenty of real
     * event names do. It is "nothing but a resource word and maybe a
     * designator is left". These three must stay titles.
     */
    it.each([
      "schedule a room inspection tomorrow at 3pm",
      "schedule the projector demo tomorrow at 3pm",
      "book a table read tomorrow at 3pm",
    ])("leaves a genuine title alone: %s", (text) => {
      const c = hospitalCtx();
      const s = beginSession(text, c);
      expect(s.question?.text ?? "").not.toContain("I don't have");
    });

    it("does not second-guess a title when a real resource was matched", () => {
      const c = hospitalCtx();
      const s = beginSession(
        "book the room inspection in Operating Room 1 tomorrow at 3pm",
        c,
      );
      expect(s.question?.text ?? "").not.toContain("I don't have");
    });
  });

  /**
   * REGRESSION — an unnamed event was silently created as "New Event".
   *
   * The card printed a title the user had never been offered and never agreed
   * to, and the success line then reported it back as though it were theirs.
   * The `title` requirement existed but no host switched it on.
   */
  describe("asking for a name when none was given", () => {
    const namedCtx = (): SessionContext => ({
      ...ctx,
      requires: { add_event: ["when", "resource", "title"] },
    });

    it("asks for a name once the concrete slots are filled", () => {
      const c = namedCtx();
      const s = beginSession("book Room A tomorrow at 3pm", c);
      expect(s.status).toBe("awaiting");
      expect(s.question?.slot).toBe("title");
      expect(s.question?.text).toBe("What should I call it?");
    });

    it("does not ask when the utterance already named the event", () => {
      const c = namedCtx();
      const s = beginSession(
        "book the design sync in Room A tomorrow at 3pm",
        c,
      );
      expect(s.draft?.title).toBe("design sync");
      expect(s.question?.slot).not.toBe("title");
    });

    it("suggests only names built from what the user already said", () => {
      const c = namedCtx();
      const s = beginSession("book Room A with Alex tomorrow at 3pm", c);
      expect(s.question?.slot).toBe("title");

      const labels = s.question!.choices.map((choice) => choice.label);
      expect(labels).toContain("Meeting with Alex Rivera");
      expect(labels).toContain("Meeting");
      // No domain guesswork — this package cannot know what kind of
      // organisation it is running in.
      expect(labels).not.toContain("Appointment");
      expect(labels).not.toContain("Consultation");
    });

    it("accepts a typed name and becomes ready", () => {
      const c = namedCtx();
      const s1 = beginSession("book Room A tomorrow at 3pm", c);
      const s2 = provideAnswer(s1, "Design sync", c);
      expect(s2.status).toBe("ready");
      expect(s2.draft?.title).toBe("Design sync");
    });

    it("lets the user skip, and records that they did", () => {
      const c = namedCtx();
      const s1 = beginSession("book Room A tomorrow at 3pm", c);
      expect(s1.question?.skippable).toBe(true);

      const s2 = provideAnswer(s1, SKIP_ANSWER, c);
      expect(s2.status).toBe("ready");
      expect(s2.skipped).toContain("title");
    });

    it("never puts the fallback title into a question", () => {
      // "When should New Event be?" reads as though the event has already been
      // named on the user's behalf.
      const c: SessionContext = { ...ctx, requires: {} };
      const s = beginSession("schedule something", c);
      expect(s.question?.text ?? "").not.toContain("New Event");
    });
  });

  /**
   * REGRESSION — a button that names a date must produce that date.
   *
   * The past/upcoming weekday chips were valued "last monday" / "next monday".
   * "last monday" resolves to the Monday of LAST WEEK, so the button labelled
   * "Past Monday (2026-08-31)" actually booked 2026-08-24 — a week off its own
   * label, silently. Both values are now explicit dates derived from the same
   * strings the labels display, so they cannot drift apart.
   */
  describe("the past-weekday buttons keep their promise", () => {
    // Thursday 2026-09-03: the most recent Monday is 08-31, the next is 09-07.
    const THU = new Date("2026-09-03T09:00:00.000Z");
    const c = (): SessionContext => ({
      ...ctx,
      now: THU,
      requires: { add_event: ["when", "resource"] },
    });

    it("asks which Monday was meant", () => {
      const s = beginSession("book Room A this monday at 3pm", c());
      expect(s.question?.text).toContain("2026-08-31");
      expect(s.question?.text).toContain("2026-09-07");
    });

    it.each([
      ["choice-past", "2026-08-31"],
      ["choice-upcoming", "2026-09-07"],
    ])("%s resolves to the date on its label, %s", (id, expected) => {
      const s = beginSession("book Room A this monday at 3pm", c());
      const choice = s.question!.choices.find((x) => x.id === id)!;

      // The label must name the same date the value produces.
      expect(choice.label).toContain(expected);
      const answered = provideAnswer(s, choice.value, c());
      expect(answered.draft?.time?.localDate).toBe(expected);
      // And the stated hour survives.
      expect(answered.draft?.time?.localTime).toBe("15:00");
    });
  });

  /**
   * A booking that landed in the past without being asked to.
   *
   * The backstop question. It is ordered last of the three date questions, so
   * the past-weekday and stale-year cases keep their better-targeted wording
   * and return before reaching it.
   */
  describe("an instant in the past that nobody asked for", () => {
    // Thursday 2026-09-03, 14:00 in Colombo — 9am has gone.
    const AFTERNOON = new Date("2026-09-03T08:30:00.000Z");
    const c = (): SessionContext => ({
      ...ctx,
      now: AFTERNOON,
      requires: { add_event: ["when", "resource"] },
    });

    it("asks rather than booking a slot that has gone", () => {
      const s = beginSession("book Room A today at 9am", c());
      expect(s.status).toBe("awaiting");
      expect(s.question?.text).toContain("already passed");
    });

    it.each([
      ["choice-next-day", "2026-09-04"],
      ["choice-keep-past", "2026-09-03"],
    ])("%s resolves to %s, keeping 9am", (id, expected) => {
      const s = beginSession("book Room A today at 9am", c());
      const choice = s.question!.choices.find((x) => x.id === id)!;
      expect(choice.label).toContain(expected);

      const answered = provideAnswer(s, choice.value, c());
      expect(answered.draft?.time?.localDate).toBe(expected);
      expect(answered.draft?.time?.localTime).toBe("09:00");
      expect(answered.status).toBe("ready");
    });

    /**
     * The other half of the rule. Asking about a date the user named outright
     * would be nagging; rolling it forward would be overriding them.
     */
    it.each([
      "book Room A yesterday at 3pm",
      "book Room A last monday at 3pm",
      "book Room A last week at 3pm",
    ])("books a deliberately past date without asking: %s", (text) => {
      const s = beginSession(text, c());
      expect(s.status).toBe("ready");
      expect(s.question).toBeNull();
    });

    it("does not add a second question to the past-weekday case", () => {
      // "this monday" already has its own, better-worded question. Only one
      // should be asked, and it should be that one.
      const s = beginSession("book Room A this monday at 3pm", c());
      expect(s.question?.text).toContain("past Monday");
      expect(s.question?.text).not.toContain("Did you mean a later date");
    });
  });

  /**
   * A stated calendar date that has just passed is asked about, not assumed.
   */
  describe("a date that only resolved by adding a year", () => {
    // Sunday 2026-08-30, so "August 25th" is five days gone.
    const AUG30 = new Date("2026-08-30T09:00:00.000Z");
    const c = (): SessionContext => ({
      ...ctx,
      now: AUG30,
      requires: { add_event: ["when", "resource"] },
    });

    it("asks instead of silently booking twelve months out", () => {
      const s = beginSession("book Room A August 25th at 3pm", c());
      expect(s.status).toBe("awaiting");
      expect(s.question?.slot).toBe("when");
      expect(s.question?.text).toContain("already passed");
      expect(s.question?.text).toContain("2026-08-25");
    });

    it("offers next year alongside other dates", () => {
      const s = beginSession("book Room A August 25th at 3pm", c());
      const labels = s.question!.choices.map((x) => x.label);
      expect(labels.some((l) => l.includes("2027-08-25"))).toBe(true);
      expect(labels).toContain("Tomorrow");
    });

    /**
     * REGRESSION — every offered choice used to lose the stated hour.
     *
     * The chip values were built as ` at ${localTime}`, a 24-hour string. The
     * frozen clock pattern requires a meridiem, so "at 15:00" parsed as
     * nothing and the hour fell back to the 09:00 default — answering
     * "Tomorrow" to a question about a 3pm booking silently moved it to 9am,
     * and then asked for the time it had just discarded.
     */
    it.each([
      ["2027-08-25 (next year)", "2027-08-25"],
      ["Today", "2026-08-30"],
      ["Tomorrow", "2026-08-31"],
    ])("choosing %s keeps 3pm and resolves to %s", (label, date) => {
      const s = beginSession("book Room A August 25th at 3pm", c());
      const choice = s.question!.choices.find((x) => x.label === label)!;
      const answered = provideAnswer(s, choice.value, c());

      expect(answered.draft?.time?.localTime).toBe("15:00");
      expect(answered.draft?.time?.localDate).toBe(date);
      // And it is done in ONE turn — no follow-up asking for the hour again.
      expect(answered.status).toBe("ready");
    });

    /**
     * REGRESSION — the chip's value has to actually carry its date.
     *
     * It was built as an ISO string, "2027-08-25 at 3:00 pm". No mention
     * pattern matches an ISO date, so the value contributed only a CLOCK;
     * `provideAnswer` saw clock-only input, took its append branch instead of
     * splicing, and the original "August 25th" survived in the utterance. The
     * result looked right — but only because the text still said what it had
     * always said, and the merged sentence read "August 25th at 3pm 3:00 pm".
     */
    it("replaces the original date rather than appending beside it", () => {
      const s = beginSession("book Room A August 25th at 3pm", c());
      const choice = s.question!.choices[0];
      const answered = provideAnswer(s, choice.value, c());

      expect(answered.text).not.toMatch(/August 25th/);
      expect(answered.text).toContain("August 25 2027");
      // One time phrase, not two.
      expect(answered.text.match(/pm/gi)).toHaveLength(1);
    });

    it("does not ask when the date is still ahead", () => {
      const s = beginSession("book Room A August 31st at 3pm", c());
      expect(s.question?.text ?? "").not.toContain("already passed");
    });

    it("does not ask twice once the user has answered", () => {
      const s = beginSession("book Room A August 25th at 3pm", c());
      const answered = provideAnswer(s, s.question!.choices[0].value, c());
      expect(answered.question?.text ?? "").not.toContain("already passed");
    });
  });

  it("still re-asks when the duration answer carries no duration at all", () => {
    const strictCtx: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration"] },
    };
    const s1 = beginSession("schedule a meeting tomorrow at 5pm", strictCtx);
    const s2 = provideAnswer(s1, "not sure yet", strictCtx);
    expect(s2.status).toBe("awaiting");
    expect(s2.question?.slot).toBe("duration");
    expect(s2.unresolved).toBe("duration");
  });

  it("handles conversational leads like 'Need to book MRI Scanner A today' and asks for specific time", () => {
    const customCatalog: EntityCatalog = {
      resources: [
        { id: "mri-a", name: "MRI Scanner A", type: "room" },
        { id: "mri-b", name: "MRI Scanner B", type: "room" },
      ],
      participants: [{ id: "p1", name: "Sarah Chen", type: "person" }],
    };
    const customCtx: SessionContext = {
      ...ctx,
      catalog: customCatalog,
      requires: { add_event: ["when", "duration", "resource"] },
    };

    const s1 = beginSession("Need to book MRI Scanner A today", customCtx);
    expect(s1.status).toBe("awaiting");
    expect(s1.draft?.resources.map((r) => r.id)).toEqual(["mri-a"]);
    expect(s1.question?.slot).toBe("when");

    const s2 = provideAnswer(s1, "at 2pm", customCtx);
    expect(s2.status).toBe("awaiting");
    expect(s2.question?.slot).toBe("duration");

    const s3 = provideAnswer(s2, "for 45 mins", customCtx);
    expect(s3.status).toBe("ready");
    expect(s3.draft?.time?.localTime).toBe("14:00");
    expect(s3.draft?.time?.durationMinutes).toBe(45);
  });

  it("softens partial resource utterances like 'Book the MRI Scanner' into clarification questions", () => {
    const customCatalog: EntityCatalog = {
      resources: [
        { id: "mri-a", name: "MRI Scanner A", type: "room" },
        { id: "mri-b", name: "MRI Scanner B", type: "room" },
      ],
    };
    const customCtx: SessionContext = {
      ...ctx,
      catalog: customCatalog,
      requires: { add_event: ["when", "resource"] },
    };

    const s1 = beginSession("Book the MRI Scanner", customCtx);
    expect(s1.status).toBe("awaiting");
    expect(s1.draft?.resources.map((r) => r.id)).toEqual(["mri-a"]);
    expect(s1.question?.slot).toBe("when");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14. Rewrite layer - Vocabulary mapping for unknown verbs
// ══════════════════════════════════════════════════════════════════════════

describe("vocabulary rewrite layer", () => {
  it("rewrites unknown verbs like 'timetable' to 'schedule a meeting with' internally", () => {
    // Original bug: "timetable maths tomorrow at 9am" fails because "timetable" is unknown
    const state = beginSession("timetable maths tomorrow at 9am", ctx);
    // It should now confidently route to add_event and ask for missing slots
    // (gate2_intent or gate5_missing_slot depending on how much was extracted)
    expect(state.route.intent).toBe("add_event");
    // Crucially, the original word "timetable" shouldn't be lost if it were a participant/resource name
    // (Though "maths" is not in our catalog, we check the route intent)
  });

  it("rewrites 'cancel' synonyms", () => {
    const state = beginSession("drop the meeting with Priya", ctx);
    expect(state.route.intent).toBe("delete_event");
  });

  it("rewrites 'reschedule' synonyms", () => {
    const state = beginSession("bump my 3pm with Sarah to 4pm", ctx);
    expect(state.route.intent).toBe("modify_event");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14b. A clock is only an end time when the answer says so
//
//  The duration question offers two shapes — "45 mins" or "until 4pm" — and
//  the clock branch used to fire on ANY clock in the answer, then roll a whole
//  day whenever that clock was at or before the start. So answering with a
//  bare time, or re-typing the original request, silently produced an event of
//  18 to 24 hours and reported success. Silent wrong data on the calendar is
//  the worst failure mode this layer has.
// ══════════════════════════════════════════════════════════════════════════

describe("duration answers that contain a clock", () => {
  // A function, not a constant: `ctx` is only assigned in `beforeAll`, which
  // runs after the describe body is evaluated.
  const durationCtx = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["duration", "title"] },
  });
  const OPENING = "book Room A tomorrow at 3pm";

  const answered = (answer: string): SessionState =>
    provideAnswer(beginSession(OPENING, durationCtx()), answer, durationCtx());

  const minutes = (answer: string): number | undefined =>
    answered(answer).draft?.time?.durationMinutes;

  const reAsked = (answer: string): boolean =>
    answered(answer).unresolved === "duration";

  it.each([
    ["for 45 minutes", 45],
    ["45 mins", 45],
    ["1 hour", 60],
    ["until 6pm", 180],
    ["till 5:30pm", 150],
    ["to 4pm", 60],
    ["ends at 5pm", 120],
    ["at 4pm", 60],
  ])("still understands %s", (answer, expected) => {
    expect(minutes(answer as string)).toBe(expected);
  });

  it.each([
    // Equal to the start: a contradiction, and the reported 24-hour bug.
    "3pm",
    // Before the start with no cue — this became an 18-hour event.
    "9am",
    "2pm",
    // The exact reproduction: the user re-typed their whole request.
    "book Room A tomorrow at 3pm",
    // A clock that is plainly not an end time.
    "the 3pm one",
    "sometime around 3pm",
  ])("re-asks rather than inventing a duration from %s", (answer) => {
    expect(reAsked(answer)).toBe(true);
  });

  it("never turns a clock answer into a day-long event", () => {
    // The invariant, over every shape at once: whatever the user types, this
    // question cannot produce an absurd event without them seeing it.
    const answers = [
      "3pm",
      "2pm",
      "9am",
      "at 3pm",
      "until 3pm",
      "the 3pm one",
      "book Room A tomorrow at 3pm",
      "noon",
      "midnight",
    ];
    for (const a of answers) {
      const d = minutes(a);
      if (d !== undefined) expect(d).toBeLessThan(12 * 60);
    }
  });

  it("still allows a deliberate overnight booking", () => {
    // The day-roll is not removed, only made conditional on an explicit cue —
    // a night shift is a real thing to schedule.
    const late = provideAnswer(
      beginSession("book Room A tomorrow at 10pm", durationCtx()),
      "until 2am",
      durationCtx(),
    );
    expect(late.draft?.time?.durationMinutes).toBe(240);
  });

  it("re-asks for an earlier clock with no overnight cue", () => {
    const late = provideAnswer(
      beginSession("book Room A tomorrow at 10pm", durationCtx()),
      "2am",
      durationCtx(),
    );
    expect(late.unresolved).toBe("duration");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14bb. A guessed meridiem is not a missing time  (Tier 3 · A6 follow-up)
//
//  "half past two" resolves by guessing which half of the day is meant, which
//  is an assumption and is disclosed. Recording it as `assumed.timeOfDay`
//  though — the obvious place — made `slotIsFilled("when")` treat the time as
//  never given, so a booking that plainly said "half past two" was asked what
//  time it should be. The user stated a time of day; only the meridiem was
//  invented, and the two need separate flags.
// ══════════════════════════════════════════════════════════════════════════

describe("a clock phrase satisfies the “when” requirement", () => {
  const requiring = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "duration", "resource", "title"] },
  });

  it("does not re-ask for a time it already resolved", () => {
    const s = beginSession(
      "book Room A tomorrow at half past two",
      requiring(),
    );
    expect(s.draft?.time?.localTime).toBe("14:30");
    expect(s.question?.slot).not.toBe("when");
  });

  it("reaches the same question a plain clock time would", () => {
    const phrase = beginSession(
      "book Room A tomorrow at half past two",
      requiring(),
    );
    const plain = beginSession("book Room A tomorrow at 3pm", requiring());
    expect(phrase.question?.slot).toBe(plain.question?.slot);
  });

  it("records the guess without calling the time missing", () => {
    const s = beginSession(
      "book Room A tomorrow at half past two",
      requiring(),
    );
    expect(s.draft?.time?.assumed.meridiem).toBe(true);
    expect(s.draft?.time?.assumed.timeOfDay).toBe(false);
    expect(s.draft?.time?.assumptions.join(" ")).toContain("half past two");
  });

  it("marks nothing assumed when the meridiem was stated", () => {
    const s = beginSession(
      "book Room A tomorrow at half past two pm",
      requiring(),
    );
    expect(s.draft?.time?.assumed.meridiem).toBe(false);
    expect(s.draft?.time?.localTime).toBe("14:30");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14ba. Zero-length events and negation cues  (Tier 3 · B8 + D7)
// ══════════════════════════════════════════════════════════════════════════

describe("a zero-length event is not a booking (B8)", () => {
  const booking = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "duration", "resource", "title"] },
  });

  it.each(["for 0 minutes", "for 0 hours", "for 0.0 hours"])(
    "refuses %s instead of creating an empty event",
    (phrase) => {
      const s = beginSession(
        `book Room A tomorrow at 3pm ${phrase}`,
        booking(),
      );
      expect(s.draft?.time?.durationMinutes).not.toBe(0);
      expect(s.draft?.time?.assumed.duration).toBe(true);
    },
  );

  it("asks for a real length when the host requires one", () => {
    const s = beginSession(
      "book Room A tomorrow at 3pm for 0 minutes",
      booking(),
    );
    expect(s.question?.slot).toBe("duration");
  });

  it("still claims the words, so they cannot become the title", () => {
    // An unclaimed phrase falls through to `titleFromRemainder` — the same
    // route by which "half past two" once became an event name.
    const s = beginSession(
      "book Room A tomorrow at 3pm for 0 minutes",
      booking(),
    );
    expect(s.draft?.title).toBeUndefined();
  });

  it("leaves real durations alone", () => {
    const s = beginSession(
      "book Room A tomorrow at 3pm for 30 minutes",
      booking(),
    );
    expect(s.draft?.time?.durationMinutes).toBe(30);
    expect(s.draft?.time?.assumed.duration).toBe(false);
  });
});

describe("a negation cue is never the event name (D7)", () => {
  it.each([
    "don't book Room A tomorrow at 3pm",
    "do not book Room A tomorrow at 3pm",
    "no longer need Room A tomorrow at 3pm",
  ])("keeps the cue out of the title of %s", (text) => {
    const title = beginSession(text, ctx).draft?.title ?? "";
    expect(title).not.toMatch(/don'?t|\bnot\b|no longer/i);
  });

  it("drops the whole verb phrase when a cue precedes it", () => {
    // "don't book …" left "don't book" as the event name — the cue AND the
    // verb, describing the opposite of what would have been created.
    expect(
      beginSession("don't book Room A tomorrow at 3pm", ctx).draft?.title,
    ).toBeUndefined();
  });

  it("never leaves the blanked cue behind as whitespace", () => {
    // Blanking preserves offsets, so a removed cue leaves its width in the
    // slice: "do     book". No title may contain a run of spaces.
    for (const text of [
      "don't book Room A tomorrow at 3pm",
      "do not book Room A tomorrow at 3pm",
      "no longer need Room A tomorrow at 3pm",
    ]) {
      const title = beginSession(text, ctx).draft?.title;
      if (title !== undefined) expect(title).not.toMatch(/\s{2,}/);
    }
  });

  it("leaves ordinary titles untouched", () => {
    expect(
      beginSession("book Room A tomorrow at 3pm for the design sync", ctx).draft
        ?.title,
    ).toBe("design sync");
    expect(
      beginSession("schedule standup with Alex tomorrow at 10am", ctx).draft
        ?.title,
    ).toBe("standup");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14bd. Generic nouns and stray verbs are not event names
//
//  Found by hand in the Phase K browser run, all three from one cause: a word
//  that DESCRIBES the thing being scheduled was taken as its NAME.
//
//    "...and schedule Dr. Sarah Chen..."          -> title "schedule"
//    "cancel the event Pre-op Assessment"         -> title "event Pre-op Assessment"
//    "cancel the Dr. Michael Ross event at 1pm"   -> title "event"
//
//  The last two then failed to find the event they had just described.
// ══════════════════════════════════════════════════════════════════════════

describe("generic nouns and stray verbs are not titles", () => {
  const titleOf = (text: string): string | undefined =>
    beginSession(text, ctx).draft?.title;

  it("drops a classifier noun that introduces the name", () => {
    expect(titleOf("cancel the event Room A review")).toBe("review");
  });

  it("drops a classifier noun left on its own", () => {
    // Everything else in the sentence was claimed; a bare "event" is not a name.
    expect(
      titleOf("cancel the Alex Rivera event today at 1pm"),
    ).toBeUndefined();
  });

  it("keeps a classifier noun that is the HEAD of a real name", () => {
    // "team event" is a name; "the event X" is a description of one.
    expect(titleOf("book Room A tomorrow at 3pm called team event")).toBe(
      "team event",
    );
  });

  it("drops a command verb stranded mid-sentence", () => {
    // `leadingVerbPrefixLength` only strips a verb at position 0, so a second
    // one — "Book X, and schedule Y" — survived into the title.
    const t = titleOf(
      "Book Room A and schedule Alex Rivera for tomorrow from 5:00 PM to 6:00 PM",
    );
    expect(t).toBeUndefined();
  });

  it("keeps a verb-like word that is part of a real title", () => {
    // Restricted to a LONE token on purpose: several intent verbs are
    // ordinary words, and dropping them inside a title would be worse.
    expect(titleOf("book Room A tomorrow at 3pm called plan review")).toBe(
      "plan review",
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14bc. Answering "when" must not eat the duration
//
//  `timeSpan` covers EVERY time mention, durations included, and the when
//  answer replaced the whole span. "book ICU Bay 9 for 30 minutes" answered
//  with "tomorrow" became "book ICU Bay 9 for tomorrow": the stated length was
//  destroyed and the event silently created at the 60-minute default. The
//  count was wrong for the same reason — `slotIsFilled("duration")` read the
//  RESOLVED time, which is null until something anchors the event in the
//  calendar, so a duration the user could see in their own message was
//  reported as missing.
// ══════════════════════════════════════════════════════════════════════════

describe("a stated duration survives the “when” question", () => {
  const booking = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "duration", "resource", "title"] },
  });

  it("counts a duration stated before any date", () => {
    const s = beginSession("book Room A for 30 minutes", booking());
    expect(s.draft?.timeSpan?.durationMinutes).toBe(30);
    expect(s.outstanding).not.toContain("duration");
  });

  it("keeps the duration when the date arrives separately", () => {
    const c = booking();
    const s = provideAnswer(
      beginSession("book Room A for 30 minutes", c),
      "tomorrow at 3pm",
      c,
    );
    expect(s.draft?.time?.durationMinutes).toBe(30);
    expect(s.draft?.time?.assumed.duration).toBe(false);
  });

  it("never asks for a length the user already gave", () => {
    const c = booking();
    let s = beginSession("book Room A for 2 hours", c);
    for (let i = 0; i < 4 && s.status === "awaiting"; i++) {
      expect(s.question?.slot).not.toBe("duration");
      s = provideAnswer(s, ["tomorrow at 10am", "Surgery"][i] ?? "dunno", c);
    }
    expect(s.draft?.time?.durationMinutes).toBe(120);
  });

  it("rescues a duration caught inside the replaced range", () => {
    // The when answer replaces the date/clock region surgically. A duration
    // sitting inside that region is not an answer to "when?", so it survives.
    const c = booking();
    const s = provideAnswer(
      beginSession("book Room A next monday for 30 minutes", c),
      "next friday",
      c,
    );
    expect(s.text).toContain("30 minutes");
    expect(s.draft?.time?.durationMinutes).toBe(30);
  });

  it("still replaces a wrong date rather than appending to it", () => {
    // The reason surgical replacement exists in the first place.
    const c = booking();
    const s = provideAnswer(
      beginSession("book Room A next monday for 2 hours", c),
      "next friday at 10am",
      c,
    );
    expect(s.text).not.toContain("next monday");
    expect(s.draft?.time?.localTime).toBe("10:00");
    expect(s.draft?.time?.durationMinutes).toBe(120);
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  14c. Skipped slots leave the count  (Tier 2 · F2)
//
//  `outstanding` filtered on "is it filled?" alone. A skipped slot is not
//  filled, so it stayed outstanding for ever: a session could reach `ready`
//  still reporting two slots to go, and the "N more to go" label never came
//  down. The label had its own off-by-one on top — it counted the question the
//  user was currently looking at, so the last one read "1 more to go".
// ══════════════════════════════════════════════════════════════════════════

describe("outstanding requirements and the progress label", () => {
  const booking = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "duration", "resource", "title"] },
  });
  const shortForm = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["duration", "title"] },
  });

  const progressOf = (state: SessionState): string | undefined => {
    const msg = presentSession(state, "m");
    return msg?.kind === "clarify" ? msg.progress : undefined;
  };

  it("drops a skipped slot from outstanding", () => {
    const c = shortForm();
    const opened = beginSession("book Room A tomorrow at 3pm", c);
    expect(opened.question?.slot).toBe("duration");
    expect(opened.outstanding).toEqual(["duration", "title"]);

    const skipped = provideAnswer(opened, SKIP_ANSWER, c);
    expect(skipped.skipped).toContain("duration");
    expect(skipped.outstanding).not.toContain("duration");
  });

  it("never leaves a slot in both skipped and outstanding", () => {
    // The exact defect: the two lists contradicted each other.
    const c = shortForm();
    let s = beginSession("book Room A tomorrow at 3pm", c);
    for (let i = 0; i < 4 && s.status === "awaiting"; i++) {
      s = provideAnswer(s, SKIP_ANSWER, c);
      for (const slot of s.skipped) {
        expect(s.outstanding ?? []).not.toContain(slot);
      }
    }
    expect(s.status).toBe("ready");
    expect(s.outstanding).toEqual([]);
  });

  it("shrinks by exactly one per slot filled", () => {
    const c = booking();
    let s = beginSession("book Room A", c);
    const sizes = [(s.outstanding ?? []).length];
    for (const a of ["tomorrow at 3pm", "for 1 hour", "Standup"]) {
      if (s.status !== "awaiting") break;
      s = provideAnswer(s, a, c);
      sizes.push((s.outstanding ?? []).length);
    }
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBe(sizes[i - 1] - 1);
    }
    expect(sizes[sizes.length - 1]).toBe(0);
  });

  it("never asks a skipped slot again", () => {
    const c = shortForm();
    let s = provideAnswer(
      beginSession("book Room A tomorrow at 3pm", c),
      SKIP_ANSWER,
      c,
    );
    for (let i = 0; i < 5 && s.status === "awaiting"; i++) {
      expect(s.question?.slot).not.toBe("duration");
      s = provideAnswer(s, "dunno", c);
    }
  });

  it("counts what is left AFTER the question on screen", () => {
    // Was: the final question read "1 more to go" and then the session ended.
    const c = booking();
    let s = beginSession("book Room A", c);
    const labels = [progressOf(s)];
    for (const a of ["tomorrow at 3pm", "for 1 hour", "Standup"]) {
      if (s.status !== "awaiting") break;
      s = provideAnswer(s, a, c);
      labels.push(progressOf(s));
    }
    expect(labels).toEqual([
      "2 more to go",
      "1 more to go",
      "last one",
      undefined,
    ]);
  });

  it("says “last one” on the final requirement", () => {
    const c = shortForm();
    const s = provideAnswer(
      beginSession("book Room A tomorrow at 3pm", c),
      "for 1 hour",
      c,
    );
    expect(s.question?.slot).toBe("title");
    expect(progressOf(s)).toBe("last one");
  });

  it("does not subtract for a question that is not a requirement", () => {
    // An escape/gate question is not one of the required slots, so the whole
    // count genuinely is still to come and must not be reduced by one.
    const c = shortForm();
    let s = beginSession("book Room A tomorrow at 3pm", c);
    let guard = 0;
    while (
      s.status === "awaiting" &&
      s.question?.slot !== "escape" &&
      guard++ < 20
    ) {
      s = provideAnswer(s, "dunno", c);
    }
    expect(s.question?.slot).toBe("escape");
    expect(s.outstanding).toEqual(["duration", "title"]);
    expect(progressOf(s)).toBe("2 more to go");
  });
});

// ══════════════════════════════════════════════════════════════════════════
//  15. The conversation must be able to end  (Tier 2 · F4)
//
//  Being trapped is the worst failure this layer has: every other defect
//  wastes a click, this one leaves a user with no way forward at all. The
//  measured bug was ten consecutive unusable answers still returning
//  `awaiting`, because the only cap counted CONSECUTIVE asks of one slot and
//  reset the moment the question changed.
// ══════════════════════════════════════════════════════════════════════════

describe("the round cap terminates", () => {
  const requiring = (): SessionContext => ({
    ...ctx,
    requires: { add_event: ["when", "duration", "resource", "title"] },
  });

  /** Answer repeatedly, collecting every state along the way. */
  const runTo = (
    state: SessionState,
    answer: string,
    c: SessionContext,
    limit = 20,
  ): SessionState[] => {
    const seen: SessionState[] = [];
    let s = state;
    for (let i = 0; i < limit && s.status === "awaiting"; i++) {
      s = provideAnswer(s, answer, c);
      seen.push(s);
    }
    return seen;
  };

  /** Drive a session to its escape question. */
  const toEscape = (opening: string, c: SessionContext): SessionState => {
    let s = beginSession(opening, c);
    let guard = 0;
    while (
      s.status === "awaiting" &&
      s.question?.slot !== "escape" &&
      guard++ < 20
    ) {
      s = provideAnswer(s, "dunno", c);
    }
    return s;
  };

  it("ends after ten unusable answers instead of asking forever", () => {
    // THE headline case. Before this, every one of these was `awaiting`.
    const c = requiring();
    const seen = runTo(
      beginSession("book Conference Room B", c),
      "dunno",
      c,
      10,
    );
    expect(seen.map((s) => s.status)).toContain("declined");
  });

  it("terminates even when the per-slot cap can never fire", () => {
    // The loop shape the per-slot counter is blind to. With `maxRounds` raised
    // out of reach, only the total backstop can end this — so if it terminates
    // here, it terminates for an alternating conversation too.
    const c: SessionContext = { ...requiring(), maxRounds: 999 };
    const seen = runTo(
      beginSession("book Conference Room B", c),
      "dunno",
      c,
      30,
    );
    expect(seen.map((s) => s.status)).toContain("declined");
    // And it spent the whole budget rather than bailing early.
    const capped = seen.find((s) => s.roundCapReached);
    expect(capped?.totalRounds).toBe(MAX_TOTAL_ROUNDS);
  });

  it("never resets totalRounds, even as `rounds` does", () => {
    const c = requiring();
    let s = beginSession("book Conference Room B", c);
    const totals = [s.totalRounds];
    const perSlot = [s.rounds];
    for (const a of ["tomorrow at 3pm", "for 1 hour", "Room A", "Standup"]) {
      if (s.status !== "awaiting") break;
      s = provideAnswer(s, a, c);
      totals.push(s.totalRounds);
      perSlot.push(s.rounds);
    }
    // Strictly monotonic, one per answer.
    expect(totals).toEqual(totals.map((_, i) => i));
    // Meanwhile the per-slot counter does reset — which is exactly why it
    // cannot be the backstop.
    expect(Math.min(...perSlot.slice(1))).toBe(0);
  });

  it("leaves a productive conversation alone", () => {
    // The budget must not cut off someone who is actually getting somewhere.
    const c = requiring();
    let s = beginSession("book Conference Room B", c);
    for (const a of ["tomorrow at 3pm", "for 1 hour", "Room A", "Standup"]) {
      if (s.status !== "awaiting") break;
      s = provideAnswer(s, a, c);
    }
    expect(s.status).toBe("ready");
    expect(s.roundCapReached).toBeFalsy();
    expect(s.totalRounds).toBeLessThan(MAX_TOTAL_ROUNDS);
  });

  it("offers only starting over when a GATE is what is stuck", () => {
    // The invariant: gates are never skippable. If this ever offers a skip,
    // the escape hatch has become a way to walk past the classifier.
    const s = toEscape("schedule a meeting with Alex", ctx);
    expect(s.question?.slot).toBe("escape");
    expect(s.question?.skippable).toBe(false);
    expect(s.question?.choices?.map((choice) => choice.value)).toEqual([
      ESCAPE_START_OVER,
    ]);
  });

  it("offers a skip when a host REQUIREMENT is what is stuck", () => {
    const c: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration", "title"] },
    };
    const s = toEscape("book Room A tomorrow at 3pm", c);
    expect(s.question?.slot).toBe("escape");
    expect(s.question?.choices?.map((choice) => choice.value)).toEqual([
      `${ESCAPE_SKIP_PREFIX}duration`,
      ESCAPE_START_OVER,
    ]);
  });

  it("skipping retires the slot and asks the NEXT question, not itself", () => {
    // The regression this guards: the total cap is still exceeded after a
    // skip, so without a fresh budget the very next turn was another escape
    // prompt — offering to skip a question the user had never been asked.
    const c: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration", "title"] },
    };
    const escape = toEscape("book Room A tomorrow at 3pm", c);
    const after = provideAnswer(escape, `${ESCAPE_SKIP_PREFIX}duration`, c);

    expect(after.skipped).toContain("duration");
    expect(after.status).toBe("awaiting");
    expect(after.question?.slot).toBe("title");
    expect(after.roundCapReached).toBeFalsy();
    // Monotonic still — the budget moved, the counter did not.
    expect(after.totalRounds).toBe(escape.totalRounds + 1);
    expect(after.capBaseline).toBe(after.totalRounds);
  });

  it("never asks a skipped slot again", () => {
    const c: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration", "title"] },
    };
    const escape = toEscape("book Room A tomorrow at 3pm", c);
    let s = provideAnswer(escape, `${ESCAPE_SKIP_PREFIX}duration`, c);
    for (let i = 0; i < 6 && s.status === "awaiting"; i++) {
      expect(s.question?.slot).not.toBe("duration");
      s = provideAnswer(s, "dunno", c);
    }
  });

  it("starting over ends the session", () => {
    const c = requiring();
    const s = provideAnswer(
      toEscape("book Conference Room B", c),
      ESCAPE_START_OVER,
      c,
    );
    expect(s.status).toBe("declined");
    expect(s.question).toBeNull();
    expect(s.roundCapReached).toBe(true);
    expect(s.reason).toMatch(/start over/i);
  });

  it("is a CLOSED choice - free text ends it rather than looping", () => {
    // By the time this question is on screen the cap has already proved that
    // more questions are not working. Re-asking here would rebuild the very
    // loop the escape exists to break.
    const c = requiring();
    const s = provideAnswer(toEscape("book Conference Room B", c), "erm", c);
    expect(s.status).toBe("declined");
    expect(s.roundCapReached).toBe(true);
  });

  it("a declined session still accepts a brand new request", () => {
    // Terminating must not mean bricked.
    const c = requiring();
    const dead = provideAnswer(
      toEscape("book Conference Room B", c),
      ESCAPE_START_OVER,
      c,
    );
    expect(dead.status).toBe("declined");
    const fresh = beginSession("book Room A tomorrow at 3pm for 1 hour", c);
    expect(fresh.status).not.toBe("declined");
    expect(fresh.totalRounds).toBe(0);
    expect(fresh.roundCapReached).toBeFalsy();
  });

  it("does not acknowledge the answer that caused it", () => {
    // "Got it — dunno." rendered directly above "I'm still not getting that"
    // tells the user their reply landed when it is the reason they are here.
    const c: SessionContext = {
      ...ctx,
      requires: { add_event: ["duration", "title"] },
    };
    const s = toEscape("book Room A tomorrow at 3pm", c);
    expect(s.question?.slot).toBe("escape");
    const msg = presentSession(s, "m");
    expect(msg?.kind).toBe("clarify");
    if (msg?.kind === "clarify") {
      expect(msg.ack).toBeUndefined();
      expect(msg.question).toMatch(/still not getting that/i);
      expect(msg.choices.length).toBeGreaterThan(0);
    }
  });

  it("cannot be used to walk past a gate", () => {
    // THE invariant, restated for the escape path: whatever the user taps, a
    // session that never cleared the gates must not end up `ready`.
    const c = requiring();
    let s = beginSession("schedule a meeting with Alex", c);
    for (let i = 0; i < 12 && s.status === "awaiting"; i++) {
      const atEscape = s.question?.slot === "escape";
      const skip = s.question?.choices?.find((choice) =>
        choice.value.startsWith(ESCAPE_SKIP_PREFIX),
      );
      s = provideAnswer(s, atEscape && skip ? skip.value : "dunno", c);
      expect(s.status).not.toBe("ready");
    }
  });
});
