import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reviseSlot } from "../src/revise";
import { beginSession } from "../src/session";
import { parseArtifacts, parsePrototypes } from "../src/artifacts";
import type { SessionContext, Artifacts, Prototype } from "../src/types";

const ARTIFACTS_DIR = resolve(__dirname, "../artifacts");

describe("reviseSlot", () => {
  let ctx: SessionContext;

  beforeAll(() => {
    const artifacts: Artifacts = parseArtifacts({
      vocab: readFileSync(resolve(ARTIFACTS_DIR, "vocab.json"), "utf8"),
      vectors: readFileSync(resolve(ARTIFACTS_DIR, "vectors.bin")),
    });
    const prototypes: Prototype[] = parsePrototypes(
      readFileSync(resolve(ARTIFACTS_DIR, "prototypes.json"), "utf8"),
    );
    ctx = {
      artifacts,
      prototypes,
      catalog: {
        resources: [
          { id: "room-a", name: "Room A", type: "room" },
          { id: "room-b", name: "Room B", type: "room" },
        ],
        participants: [{ id: "sarah", name: "Sarah Chen", type: "person" }],
      },
      now: new Date("2026-08-05T08:00:00.000Z"), // Wednesday
      timezone: "UTC",
    };
  });

  it("replaces an explicit span in text and re-evaluates", () => {
    const s1 = beginSession("book Room A tomorrow at 10am", ctx);
    expect(s1.status).toBe("ready");
    expect(s1.draft?.time?.localTime).toBe("10:00");

    const timeSpan = s1.draft?.timeSpan;
    expect(timeSpan).toBeDefined();

    const s2 = reviseSlot(s1, timeSpan, "at 3pm", ctx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.localTime).toBe("15:00");
  });

  it("appends and re-evaluates when span is undefined on ready session", () => {
    const s1 = beginSession("book Room A tomorrow", ctx);
    expect(s1.status).toBe("ready");

    const s2 = reviseSlot(s1, undefined, "at 4pm", ctx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.localTime).toBe("16:00");
  });

  it("delegates to provideAnswer when span is undefined on awaiting session", () => {
    const s1 = beginSession("book Room A", ctx);
    expect(s1.status).toBe("awaiting");
    expect(s1.question?.slot).toBe("when");

    const s2 = reviseSlot(s1, undefined, "tomorrow at 10am", ctx);
    expect(s2.status).toBe("ready");
    expect(s2.draft?.time?.localTime).toBe("10:00");
  });
});
