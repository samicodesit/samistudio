import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { DELETE, POST } from "./route";

const url = "http://localhost:3000/api/session";

function request(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("session route", () => {
  beforeEach(() => {
    process.env.DOODLE_PASSWORD = "correct horse";
    process.env.SESSION_SECRET = "session-secret-with-at-least-32-characters";
  });

  it("logs in with the correct password", async () => {
    const response = await POST(request({ passphrase: "correct horse" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("doodle_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects the wrong password without setting a cookie", async () => {
    const response = await POST(request({ passphrase: "wrong" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a cross-origin request", async () => {
    const response = await POST(request({ passphrase: "correct horse" }, "https://evil.example"));
    expect(response.status).toBe(403);
  });

  it("expires the cookie on logout", async () => {
    const response = await DELETE(
      new NextRequest(url, {
        method: "DELETE",
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("doodle_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
