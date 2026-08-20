import { describe, expect, it } from "vitest";
import { SceneValidationError, normalizeScene } from "./scene";

describe("normalizeScene", () => {
  it("trims a valid scene", () => expect(normalizeScene("  Two cats hug  ")).toBe("Two cats hug"));

  it.each([undefined, null, 12, " "])("rejects invalid input %s", (value) => {
    expect(() => normalizeScene(value)).toThrow(SceneValidationError);
  });

  it("rejects more than 180 characters", () => {
    expect(() => normalizeScene("a".repeat(181))).toThrowError(/180/);
  });
});
