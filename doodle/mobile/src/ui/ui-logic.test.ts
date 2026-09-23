import { describe, expect, it } from "vitest";
import { canSubmitReport, characterCountLabel, loadingMessageAt, canSubmitScene, shouldShowCharacterCount } from "./ui-logic";

describe("native UI presentation logic", () => {
  it("keeps a loading message available for every visible waiting state", () => {
    const messages = ["first", "second", "third"] as const;

    expect(loadingMessageAt(messages, 0)).toBe("first");
    expect(loadingMessageAt(messages, 5)).toBe("third");
    expect(loadingMessageAt([], 0)).toBe("");
  });

  it("reports the prompt count against the native maximum", () => {
    expect(characterCountLabel("hello", 180)).toEqual({ used: 5, remaining: 175 });
  });

  it("does not submit blank or over-limit scenes", () => {
    expect(canSubmitScene("  ", 180)).toBe(false);
    expect(canSubmitScene("a".repeat(181), 180)).toBe(false);
    expect(canSubmitScene("a small cat", 180)).toBe(true);
  });

  it("only exposes the prompt counter near the native limit", () => {
    expect(shouldShowCharacterCount(149)).toBe(false);
    expect(shouldShowCharacterCount(150)).toBe(true);
    expect(shouldShowCharacterCount(180)).toBe(true);
  });

  it("keeps report submission disabled while pending and validates optional details", () => {
    expect(canSubmitReport("", "", false)).toBe(false);
    expect(canSubmitReport("sexual", "", false)).toBe(true);
    expect(canSubmitReport("other", "", false)).toBe(false);
    expect(canSubmitReport("other", "context", true)).toBe(false);
    expect(canSubmitReport("sexual", "a".repeat(501), false)).toBe(false);
  });
});
