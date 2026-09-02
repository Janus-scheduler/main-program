import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ChatController } from "../src/controller";
import { parseArtifacts, parsePrototypes } from "../src/artifacts";
import type { Artifacts, Prototype } from "../src/types";

const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

describe("ChatController", () => {
  let engine: { artifacts: Artifacts; prototypes: Prototype[] };

  beforeAll(() => {
    const artifacts: Artifacts = parseArtifacts({
      vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf8"),
      vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
    });
    const prototypes: Prototype[] = parsePrototypes(
      readFileSync(resolve(ARTIFACTS_DIR, "prototypes.json"), "utf8"),
    );
    engine = { artifacts, prototypes };
  });

  it("handles smalltalk greetings immediately", () => {
    const controller = new ChatController({
      engine,
      catalog: {
        resources: [{ id: "room-a", name: "Room A", type: "room" }],
      },
      timezone: "UTC",
    });

    controller.submit("hello");
    expect(controller.thread).toHaveLength(3); // intro + user message + assistant reply
    const lastMsg = controller.thread[controller.thread.length - 1];
    expect(lastMsg.kind).toBe("text");
    if (lastMsg.kind === "text") {
      expect(lastMsg.text).toContain("Hi!");
    }
  });

  it("blocks smalltalk classification when a question is pending", async () => {
    const controller = new ChatController({
      engine,
      catalog: { resources: [] },
      timezone: "UTC",
    });

    // We can simulate an awaiting state by submitting a partial prompt
    controller.submit("book a room");
    await new Promise((res) => setTimeout(res, 350));

    // Should be in awaiting state
    expect(controller.session?.status).toBe("awaiting");

    // The user replies "morning", which could be smalltalk, but since we are awaiting, it should be processed as the time slot.
    controller.submit("morning");
    await new Promise((res) => setTimeout(res, 350));

    const lastMsg = controller.thread[controller.thread.length - 1];
    expect(lastMsg).toBeDefined();
    if (lastMsg.kind === "text" && lastMsg.text) {
      expect(lastMsg.text).not.toContain("Hi!");
    } else {
      expect(lastMsg.kind).not.toBe("text");
    }
  });

  it("processes scheduling prompts and presents parse cards", async () => {
    const controller = new ChatController({
      engine,
      catalog: {
        resources: [{ id: "room-a", name: "Room A", type: "room" }],
      },
      timezone: "UTC",
    });

    controller.submit("book Room A tomorrow at 10am");
    expect(controller.busy).toBe(true);

    // Wait for timer
    await new Promise((res) => setTimeout(res, 350));
    expect(controller.busy).toBe(false);
    expect(controller.session?.status).toBe("ready");
    const lastMsg = controller.thread[controller.thread.length - 1];
    expect(lastMsg.kind).toBe("parse");
  });

  it("handles confirmation and undo", async () => {
    let unDone = false;
    const controller = new ChatController({
      engine,
      catalog: {
        resources: [{ id: "room-a", name: "Room A", type: "room" }],
      },
      timezone: "UTC",
      onConfirm: () => ({
        ok: true,
        message: "Scheduled Room A",
        undo: () => {
          unDone = true;
        },
      }),
    });

    controller.submit("book Room A tomorrow at 10am");
    await new Promise((res) => setTimeout(res, 350));

    controller.confirm();
    const successMsg = controller.thread[controller.thread.length - 1];
    expect(successMsg.kind).toBe("success");
    if (successMsg.kind === "success") {
      expect(successMsg.canUndo).toBe(true);
    }

    controller.undo(successMsg.id);
    expect(unDone).toBe(true);
  });

  it("supports edit action", async () => {
    const controller = new ChatController({
      engine,
      catalog: {
        resources: [{ id: "room-a", name: "Room A", type: "room" }],
      },
      timezone: "UTC",
    });

    controller.submit("book Room A tomorrow at 10am");
    await new Promise((res) => setTimeout(res, 350));

    controller.edit();
    expect(controller.session?.status).toBe("awaiting");
  });

  it("handles dynamic corrections ('actually 3pm')", async () => {
    const controller = new ChatController({
      engine,
      catalog: {
        resources: [{ id: "room-a", name: "Room A", type: "room" }],
      },
      timezone: "UTC",
    });

    controller.submit("book Room A tomorrow at 10am");
    await new Promise((res) => setTimeout(res, 350));
    expect(controller.session?.draft?.time?.localTime).toBe("10:00");

    controller.submit("actually 3pm");
    await new Promise((res) => setTimeout(res, 350));
    expect(controller.session?.status).toBe("ready");
    expect(controller.session?.draft?.time?.localTime).toBe("15:00");
  });

  /**
   * Step K2 — the chat resolves in the zone the CALENDAR is displaying.
   *
   * The host used to pass `Intl.DateTimeFormat().resolvedOptions().timeZone`,
   * captured once. So after a user changed the display timezone, the parse card
   * said one time and the timeline drew the block at another. A getter is
   * re-read at the start of every turn, so the two can no longer disagree.
   */
  describe("timezone resolution", () => {
    const catalog = {
      resources: [{ id: "room-a", name: "Room A", type: "room" }],
    };

    it("accepts a plain string, as before", async () => {
      const controller = new ChatController({
        engine,
        catalog,
        timezone: "UTC",
      });
      controller.submit("book Room A tomorrow at 10am");
      await new Promise((res) => setTimeout(res, 350));
      expect(controller.session?.draft?.time?.localTime).toBe("10:00");
    });

    it("calls a getter, and re-reads it on every turn", async () => {
      let zone = "UTC";
      const seen: string[] = [];
      const controller = new ChatController({
        engine,
        catalog,
        timezone: () => {
          seen.push(zone);
          return zone;
        },
      });

      controller.submit("book Room A tomorrow at 10am");
      await new Promise((res) => setTimeout(res, 350));
      const utcStart = controller.session?.draft?.time?.startISO;

      // The user switches the calendar's display zone mid-conversation.
      zone = "Asia/Tokyo";
      controller.reset();
      controller.submit("book Room A tomorrow at 10am");
      await new Promise((res) => setTimeout(res, 350));
      const tokyoStart = controller.session?.draft?.time?.startISO;

      expect(seen).toEqual(["UTC", "Asia/Tokyo"]);
      // Same words, same local time, different instant — which is the point.
      expect(controller.session?.draft?.time?.localTime).toBe("10:00");
      expect(tokyoStart).not.toBe(utcStart);
    });

    it("falls back to the browser zone when the getter throws", async () => {
      const controller = new ChatController({
        engine,
        catalog,
        timezone: () => {
          throw new Error("store unavailable");
        },
      });

      // A broken timezone source must degrade, not take the turn down with it.
      controller.submit("book Room A tomorrow at 10am");
      await new Promise((res) => setTimeout(res, 350));
      expect(controller.session?.status).toBe("ready");
      expect(controller.session?.draft?.time?.localTime).toBe("10:00");
    });

    it("falls back to the browser zone when the getter returns empty", async () => {
      const controller = new ChatController({
        engine,
        catalog,
        timezone: () => "",
      });
      controller.submit("book Room A tomorrow at 10am");
      await new Promise((res) => setTimeout(res, 350));
      expect(controller.session?.status).toBe("ready");
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  The Edit button  (Tier 4 · #2/#6)
  //
  //  Edit parked on a DUMMY `title` slot so it could take any reply,
  //  so everything typed after pressing it went to the title handler. A time
  //  was swallowed whole — extraction is first-mention-wins, so the ORIGINAL
  //  survived — and a room or a name was APPENDED rather than replacing.
  //  Editing a 3pm booking to 5pm changed nothing at all.
  // ══════════════════════════════════════════════════════════════════════

  describe("the Edit button", () => {
    const CATALOG = {
      resources: [
        { id: "r1", name: "Room A", type: "room" },
        { id: "r2", name: "Room B", type: "room" },
      ],
      participants: [{ id: "p1", name: "Alex Rivera", type: "person" }],
    };

    const settle = () => new Promise((res) => setTimeout(res, 350));

    /** A confirmed booking: Room A, tomorrow 15:00, 60 minutes, "standup". */
    const booked = async () => {
      const c = new ChatController({
        engine,
        catalog: CATALOG,
        requires: { add_event: ["when", "duration", "resource", "title"] },
        timezone: "UTC",
      });
      c.submit("book Room A tomorrow at 3pm for 1 hour called standup");
      await settle();
      expect(c.session?.status).toBe("ready");
      return c;
    };

    it("asks which field instead of taking any text", async () => {
      const c = await booked();
      c.edit();
      expect(c.session?.question?.slot).toBe("edit");
      const msg = c.thread[c.thread.length - 1];
      expect(msg.kind).toBe("clarify");
      if (msg.kind === "clarify") {
        expect(msg.choices.map((x) => x.label)).toEqual([
          "Time",
          "Length",
          "Room or person",
          "Name",
          "Never mind",
        ]);
      }
    });

    it("changes the time when a bare time is typed", async () => {
      // THE headline case: this was a complete no-op.
      const c = await booked();
      c.edit();
      c.submit("5pm");
      await settle();
      expect(c.session?.draft?.time?.localTime).toBe("17:00");
      expect(c.session?.draft?.time?.durationMinutes).toBe(60);
      expect(c.session?.status).toBe("ready");
    });

    it("REPLACES the room rather than adding a second one", async () => {
      const c = await booked();
      c.edit();
      c.submit("Room B");
      await settle();
      expect(c.session?.draft?.resources.map((r) => r.name)).toEqual([
        "Room B",
      ]);
    });

    it("REPLACES the name rather than appending to it", async () => {
      const c = await booked();
      c.edit();
      c.submit("planning");
      await settle();
      expect(c.session?.draft?.title).toBe("planning");
    });

    it.each([
      ["Time", "5pm", "when"],
      ["Length", "30 minutes", "duration"],
      ["Room or person", "Room B", "resource"],
      ["Name", "planning", "title"],
    ])("tapping %s parks on the %s question", async (chip, _reply, slot) => {
      const c = await booked();
      c.edit();
      c.choose(chip as string);
      await settle();
      expect(c.session?.question?.slot).toBe(slot);
    });

    it("changes the length without touching the time", async () => {
      const c = await booked();
      c.edit();
      c.choose("Length");
      await settle();
      c.submit("30 minutes");
      await settle();
      expect(c.session?.draft?.time?.durationMinutes).toBe(30);
      expect(c.session?.draft?.time?.localTime).toBe("15:00");
    });

    it("changes one field and leaves the others alone", async () => {
      const c = await booked();
      c.edit();
      c.submit("5pm");
      await settle();
      const d = c.session?.draft;
      expect(d?.time?.localTime).toBe("17:00");
      expect(d?.time?.durationMinutes).toBe(60);
      expect(d?.title).toBe("standup");
      expect(d?.resources.map((r) => r.name)).toEqual(["Room A"]);
    });

    it("Never mind leaves the draft byte-identical", async () => {
      const c = await booked();
      const before = JSON.stringify(c.session?.draft);
      c.edit();
      c.choose("Never mind");
      await settle();
      expect(c.session?.status).toBe("ready");
      expect(JSON.stringify(c.session?.draft)).toBe(before);
    });

    it("can be used twice in a row", async () => {
      const c = await booked();
      c.edit();
      c.submit("5pm");
      await settle();
      c.edit();
      c.submit("Room B");
      await settle();
      expect(c.session?.draft?.time?.localTime).toBe("17:00");
      expect(c.session?.draft?.resources.map((r) => r.name)).toEqual([
        "Room B",
      ]);
    });

    it("keeps the naming verb out of the title", async () => {
      // "called standup" carried the user's grammar into the event's name.
      const c = await booked();
      expect(c.session?.draft?.title).toBe("standup");
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  Editing one field must not forget the others
  //
  //  Reported from the browser as "memory forgetting". Two greedy spans, and
  //  neither was about state persistence:
  //
  //    1. the resource edit replaced ONE range from the first named entity to
  //       the last, so a time phrase sitting between two of them was deleted;
  //    2. the title was sliced from the first surviving word to the last out
  //       of the ORIGINAL text, so every room, person and time in between
  //       reappeared inside the event's name.
  // ══════════════════════════════════════════════════════════════════════

  describe("editing one field keeps the rest", () => {
    const CATALOG = {
      resources: [
        { id: "r1", name: "Operating Room 1", type: "room" },
        { id: "r2", name: "MRI Scanner A", type: "equipment" },
        { id: "r3", name: "Room B", type: "room" },
      ],
      participants: [
        { id: "p1", name: "Dr. Sarah Chen", type: "person" },
        { id: "p2", name: "Dr. Ann Sherin", type: "person" },
      ],
    };
    const settle = () => new Promise((res) => setTimeout(res, 350));

    const booked = async (opening: string) => {
      const c = new ChatController({
        engine,
        catalog: CATALOG,
        requires: { add_event: ["when", "duration", "resource", "title"] },
        timezone: "UTC",
      });
      c.submit(opening);
      await settle();
      let guard = 0;
      while (c.session?.status === "awaiting" && guard++ < 4) {
        c.submit(c.session.question?.slot === "title" ? "Standup" : "1 hour");
        await settle();
      }
      return c;
    };

    it.each([
      [
        "a person AFTER the time",
        "book Operating Room 1 tomorrow at 3pm with Dr. Sarah Chen",
      ],
      [
        "a room BEFORE the time",
        "book Operating Room 1 tomorrow at 3pm for 1 hour called standup",
      ],
      [
        "four resources around the time",
        "Book Operating Room 1, MRI Scanner A, and schedule Dr. Sarah Chen and Dr. Ann Sherin for tomorrow from 5:00 PM to 6:00 PM",
      ],
    ])("changing the room keeps the time — %s", async (_label, opening) => {
      const c = await booked(opening);
      const before = c.session?.draft?.time;
      expect(before).toBeTruthy();
      c.edit();
      c.submit("Room B");
      await settle();
      const after = c.session?.draft?.time;
      expect(after?.localDate).toBe(before?.localDate);
      expect(after?.localTime).toBe(before?.localTime);
      expect(after?.durationMinutes).toBe(before?.durationMinutes);
      expect(c.session?.draft?.resources.map((r) => r.name)).toEqual([
        "Room B",
      ]);
    });

    it("a title never contains a room, a person or a time", async () => {
      const c = await booked(
        "Book Operating Room 1, MRI Scanner A, and schedule Dr. Sarah Chen and Dr. Ann Sherin for tomorrow from 5:00 PM to 6:00 PM",
      );
      const title = c.session?.draft?.title ?? "";
      expect(title).not.toMatch(/Operating Room|MRI Scanner|Sarah|Sherin/i);
      expect(title).not.toMatch(/tomorrow|5:00|6:00/i);
      expect(title).toBe("Standup");
    });

    it("keeps the title when the room is changed", async () => {
      const c = await booked(
        "book Operating Room 1 tomorrow at 3pm with Dr. Sarah Chen",
      );
      const before = c.session?.draft?.title;
      c.edit();
      c.submit("Room B");
      await settle();
      expect(c.session?.draft?.title).toBe(before);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  //  “set a meeting today at 10am” — three defects in one screenshot
  //
  //  1. `set` is not in the frozen verb list (only `set up`), so the whole
  //     clause fell through and “set a meeting” became the event's NAME.
  //  2. That name then SPANNED the verb, so renaming it deleted `set`, the
  //     sentence lost its only verb, and a finished booking turned into
  //     “I didn't quite follow that”.
  //  3. Tapping a field chip printed its sentinel back: “Got it —
  //     __edit__:title.”
  // ══════════════════════════════════════════════════════════════════════

  describe("a dropped verb particle", () => {
    const CATALOG = {
      resources: [{ id: "r1", name: "Operating Room 1", type: "room" }],
      participants: [{ id: "p1", name: "Dr. Ann sherin", type: "person" }],
    };
    const settle = () => new Promise((res) => setTimeout(res, 350));
    const start = async (text: string) => {
      const c = new ChatController({
        engine,
        catalog: CATALOG,
        requires: { add_event: ["when", "duration", "resource", "title"] },
        timezone: "UTC",
      });
      c.submit(text);
      await settle();
      return c;
    };

    it.each([
      ["set a meeting today at 10am", "meeting"],
      ["block Operating Room 1 today at 10am", undefined],
      ["line up a review today at 10am", "review"],
    ])("%s does not put the verb in the title", async (text, title) => {
      const c = await start(text as string);
      expect(c.session?.draft?.title).toBe(title);
    });

    it("renaming does not destroy the booking", async () => {
      const c = await start("set a meeting today at 10am");
      let guard = 0;
      while (c.session?.status === "awaiting" && guard++ < 4) {
        const slot = c.session.question?.slot;
        c.choose(
          slot === "duration"
            ? "45 min"
            : slot === "resource"
              ? "Operating Room 1"
              : "Rounds",
        );
        await settle();
      }
      expect(c.session?.status).toBe("ready");

      c.edit();
      c.choose("Name");
      await settle();
      c.submit("Standup meeting");
      await settle();

      // THE regression: this used to end `declined`.
      expect(c.session?.status).toBe("ready");
      expect(c.session?.draft?.title).toBe("Standup meeting");
      expect(c.session?.draft?.time?.localTime).toBe("10:00");
    });

    it("never reads a sentinel back to the user", async () => {
      const c = await start("set a meeting today at 10am");
      let guard = 0;
      while (c.session?.status === "awaiting" && guard++ < 4) {
        const slot = c.session.question?.slot;
        c.choose(
          slot === "duration"
            ? "45 min"
            : slot === "resource"
              ? "Operating Room 1"
              : "Rounds",
        );
        await settle();
      }
      c.edit();
      c.choose("Name");
      await settle();

      for (const m of c.thread) {
        const text =
          m.kind === "text"
            ? m.text
            : m.kind === "clarify"
              ? `${m.ack ?? ""} ${m.lead ?? ""} ${m.question}`
              : "";
        expect(text).not.toMatch(/__/);
      }
    });
  });
});
