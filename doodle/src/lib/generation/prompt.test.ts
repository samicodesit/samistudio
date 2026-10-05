import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOODLE_PAPER_COLOR, SIMPLE_PROFILE } from "./profile";
import { buildDoodlePrompt } from "./prompt";
import { PROMPT_VERSIONS } from "./detail-level";

describe("buildDoodlePrompt", () => {
  it("records the new Simple version while preserving other prompt versions", () => {
    expect(PROMPT_VERSIONS).toEqual({ simple: "simple-v3", medium: "medium-v1", detailed: "detailed-v1" });
  });
  it("locks the owner-approved rounded Simple prompt", () => {
    expect(createHash("sha256").update(buildDoodlePrompt("Two cats hug")).digest("hex")).toBe("3517a71cdc6b027797e3962b7168f885277b1ca26b86b8b4fec71d81642b5931");
  });
  it("delimits scene content and preserves simple-profile rules", () => {
    const prompt = buildDoodlePrompt("Two cats hug");
    expect(prompt).toContain("<scene>Two cats hug</scene>");
    expect(prompt).toContain("copy by hand in under two minutes");
    expect(prompt).toContain(`sRGB ${DOODLE_PAPER_COLOR}`);
    expect(SIMPLE_PROFILE.id).toBe("simple");
    expect(SIMPLE_PROFILE.model).toBe("gpt-image-2.5-flare");
  });

  it("uses distinct complexity rules without changing the shared paper or subject", () => {
    const medium = buildDoodlePrompt("Two cats hug", { ...SIMPLE_PROFILE, id: "medium" });
    const detailed = buildDoodlePrompt("Two cats hug", { ...SIMPLE_PROFILE, id: "detailed" });
    expect(medium).toContain("selective interior details");
    expect(detailed).toContain("intricate contours");
    for (const prompt of [medium, detailed]) {
      expect(prompt).toContain("<scene>Two cats hug</scene>");
      expect(prompt).toContain(DOODLE_PAPER_COLOR);
      expect(prompt).not.toContain("under two minutes");
      expect(prompt).not.toContain("extremely simple");
    }
  });

});
