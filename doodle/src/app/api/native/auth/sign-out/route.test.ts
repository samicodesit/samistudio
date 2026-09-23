import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ revokeNativeSession: vi.fn() }));
vi.mock("@/lib/native-session", () => ({ revokeNativeSession: mocks.revokeNativeSession }));

function request(origin = "https://doodle.samistudio.nl") {
  return new NextRequest("https://doodle.samistudio.nl/api/native/auth/sign-out", {
    method: "POST",
    headers: { origin, authorization: "Bearer " + "a".repeat(43) },
  });
}

describe("native sign-out route", () => {
  beforeEach(() => {
    mocks.revokeNativeSession.mockReset();
  });

  it("revokes the bearer and returns an idempotent no-content response", async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.revokeNativeSession).toHaveBeenCalledWith(expect.any(NextRequest));
  });

  it("keeps cross-origin requests blocked and hides Redis failures", async () => {
    expect((await POST(request("https://evil.test"))).status).toBe(403);
    mocks.revokeNativeSession.mockRejectedValueOnce(new Error("redis"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "auth_unavailable" });
  });
});
