import { classifySmalltalk } from "../src/smalltalk";
import { EntityCatalog } from "../src/types";

describe("classifySmalltalk", () => {
  const catalog: EntityCatalog = {
    resources: [
      { id: "room-morning", name: "Morning Room", aliases: ["Morning"] },
      { id: "room-help", name: "Help Desk", aliases: ["Help"] },
    ],
  };

  it("classifies standard greetings", () => {
    expect(classifySmalltalk("hi")).toBe("greeting");
    expect(classifySmalltalk("hello")).toBe("greeting");
  });

  it("does not swallow resource names when a catalog is provided", () => {
    // "Morning" is a greeting, but it's also a resource alias in our test catalog
    expect(classifySmalltalk("morning", catalog)).toBeNull();
    // "Help" is a smalltalk phrase, but it's also a resource alias
    expect(classifySmalltalk("help", catalog)).toBeNull();
  });

  it("handles 4-word help phrases correctly", () => {
    expect(classifySmalltalk("what can you do")).toBe("help");
    expect(classifySmalltalk("how does this work")).toBe("help");
  });

  it("rejects help phrases that have trailing words", () => {
    // 5 words, and doesn't match the strict end anchor \s*$
    expect(classifySmalltalk("what can you do please")).toBeNull();
    expect(classifySmalltalk("help me with this booking")).toBeNull();
  });

  it("rejects phrases over 4 words", () => {
    expect(classifySmalltalk("hi there how are you")).toBeNull();
  });

  // ══════════════════════════════════════════════════════════════════════
  //  F-1 / F-2 — the two phrasings the shipped HELP_RE dropped
  //
  //  `docs/NLP_TIER1_INSTRUCTIONS.md` §2.1 specified a trailing `[?!.]*` and
  //  the phrase "what can i say". Neither made it in, so the commonest way
  //  anyone asks for help — with a question mark — fell through to the
  //  classifier and was refused.
  // ══════════════════════════════════════════════════════════════════════

  it.each([
    "what can you do?",
    "what can you do!",
    "what can you do.",
    "help?",
    "how does this work?",
    "stuck?",
  ])("tolerates trailing punctuation: %s", (text) => {
    expect(classifySmalltalk(text)).toBe("help");
  });

  it.each(["what can i say", "what can i say?"])("understands %s", (text) => {
    expect(classifySmalltalk(text)).toBe("help");
  });

  it("still refuses a help word with real words after it", () => {
    // The anchor is what protects a room called “Help Desk”; punctuation
    // tolerance must not become a prefix match.
    expect(classifySmalltalk("what can you do about Room A")).toBeNull();
    expect(classifySmalltalk("help me with this booking")).toBeNull();
    expect(classifySmalltalk("options for tomorrow")).toBeNull();
  });

  it("still protects a catalog name", () => {
    const catalog = {
      resources: [{ id: "h1", name: "Help Desk", type: "room" }],
      participants: [],
    };
    expect(classifySmalltalk("Help Desk", catalog)).toBeNull();
  });
});
