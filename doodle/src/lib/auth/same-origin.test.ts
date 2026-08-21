import { describe, expect, it } from "vitest";
import { hasSameOrigin } from "./same-origin";

function request(origin?: string) {
  const headers = new Headers({ host: "doodle.test" });
  if (origin !== undefined) headers.set("origin", origin);
  return new Request("https://doodle.test/api/checkout", { headers });
}

describe("same-origin guard", () => {
  it("accepts a matching full origin", () => {
    expect(hasSameOrigin(request("https://doodle.test"))).toBe(true);
  });

  it("rejects a missing Origin header", () => {
    expect(hasSameOrigin(request())).toBe(false);
  });

  it("rejects a cross-scheme same-host origin", () => {
    expect(hasSameOrigin(request("http://doodle.test"))).toBe(false);
  });

  it("rejects a malformed Origin header", () => {
    expect(hasSameOrigin(request("not an origin"))).toBe(false);
  });
});
