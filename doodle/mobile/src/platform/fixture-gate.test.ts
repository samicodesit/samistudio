import { describe, expect, it } from "vitest";
import { isNativeFixtureMode } from "./fixture-gate";

describe("isNativeFixtureMode", () => {
  it("requires the isolated package id and explicit flag", () => {
    expect(isNativeFixtureMode("nl.samistudio.doodle", true)).toBe(false);
    expect(isNativeFixtureMode("nl.samistudio.doodle.preview", true)).toBe(false);
    expect(isNativeFixtureMode("nl.samistudio.doodle.fixture", false)).toBe(false);
    expect(isNativeFixtureMode("nl.samistudio.doodle.fixture", "true")).toBe(false);
    expect(isNativeFixtureMode("nl.samistudio.doodle.fixture", true)).toBe(true);
  });
});
