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
    expect(controller.thread[controller.thread.length - 1].text).toContain(
      "Hi!",
    );
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
    expect(successMsg.canUndo).toBe(true);

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
});
