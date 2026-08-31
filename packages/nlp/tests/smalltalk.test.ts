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
});
