// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared native/web waiting artwork", () => {
  it("ships Android's exact self-contained Lottie file", () => {
    const native = readFileSync("mobile/assets/pencil-loader.json");
    const web = readFileSync("public/animations/pencil-loader.json");
    expect(web.equals(native)).toBe(true);
    expect(JSON.parse(web.toString())).toMatchObject({ fr: 60, ip: 0, op: 480, w: 320, h: 280 });
  });
});
