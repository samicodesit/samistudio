import { describe, expect, it } from "vitest";
import { APP_NAME, MAX_SCENE_LENGTH, SESSION_TTL_SECONDS } from "./app-config";

describe("app config", () => {
  it("exports the approved product limits", () => {
    expect(APP_NAME).toBe("Doodle");
    expect(MAX_SCENE_LENGTH).toBe(180);
    expect(SESSION_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
  });
});
