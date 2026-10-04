import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DOODLE_PAPER_COLOR, SIMPLE_PROFILE } from "./profile";
import { buildDoodlePrompt } from "./prompt";

describe("buildDoodlePrompt", () => {
  it("preserves the exact pre-feature Simple prompt", () => {
    expect(createHash("sha256").update(buildDoodlePrompt("Two cats hug")).digest("hex")).toBe("e2e0c20905e94eb2892aae2a18b62cac81d38c282edab46acc0182293c85f952");
  });
  it("delimits scene content and preserves simple-profile rules", () => {
    const prompt = buildDoodlePrompt("Two cats hug");
    expect(prompt).toContain("<scene>Two cats hug</scene>");
    expect(prompt).toContain("copy by hand in under two minutes");
    expect(prompt).toContain(`sRGB ${DOODLE_PAPER_COLOR}`);
    expect(SIMPLE_PROFILE.id).toBe("simple");
    expect(SIMPLE_PROFILE.model).toBe("gpt-image-1-mini");
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
