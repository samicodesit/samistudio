import { describe, expect, it } from "vitest";
import { SIMPLE_PROFILE } from "./profile";
import { buildDoodlePrompt } from "./prompt";

describe("buildDoodlePrompt", () => {
  it("delimits scene content and preserves simple-profile rules", () => {
    const prompt = buildDoodlePrompt("Two cats hug");
    expect(prompt).toContain("<scene>Two cats hug</scene>");
    expect(prompt).toContain("copy by hand in under two minutes");
    expect(prompt).toContain("no text, labels, captions, signatures, borders, or speech bubbles");
    expect(SIMPLE_PROFILE.id).toBe("simple");
    expect(SIMPLE_PROFILE.model).toBe("gpt-image-1-mini");
  });
});
