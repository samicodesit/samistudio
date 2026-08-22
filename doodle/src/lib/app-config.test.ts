import { describe, expect, it } from "vitest";
import { APP_NAME, MAX_SCENE_LENGTH } from "./app-config";

describe("app config", () => {
  it("exports the approved product limits", () => {
    expect(APP_NAME).toBe("Doodle");
    expect(MAX_SCENE_LENGTH).toBe(180);
  });

  it("does not ship abandoned Supabase or email-OTP configuration", () => {
    const config = `${readFileSync("package.json", "utf8")}\n${readFileSync(".env.example", "utf8")}`;
    expect(config).not.toMatch(/@supabase|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_EMAIL_OTP_ENABLED/);
  });
});
import { readFileSync } from "node:fs";
