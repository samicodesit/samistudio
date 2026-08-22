import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ clearSessionCookie: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ clearSessionCookie: mocks.clearSessionCookie }));

describe("sign-out route", () => {
  beforeEach(() => mocks.clearSessionCookie.mockReset());

  it("expires the signed session cookie", async () => {
    const request = new NextRequest("https://doodle.test/api/auth/sign-out", {
      method: "POST",
      headers: { host: "doodle.test", origin: "https://doodle.test" },
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mocks.clearSessionCookie).toHaveBeenCalledWith(response);
  });
});
