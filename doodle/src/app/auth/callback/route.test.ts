import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  })),
}));

describe("auth callback", () => {
  beforeEach(() => exchangeCodeForSession.mockReset());

  it("exchanges an OAuth code and returns only to a validated locale", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=ok&locale=de"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("ok");
    expect(response.headers.get("location")).toBe("https://doodle.test/de?auth=success");
  });

  it("does not accept an arbitrary redirect", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=ok&locale=https://evil.test"));

    expect(response.headers.get("location")).toBe("https://doodle.test/?auth=success");
  });

  it("returns a fixed auth error when exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("bad code") });

    const response = await GET(new NextRequest("https://doodle.test/auth/callback?code=bad&locale=ar"));

    expect(response.headers.get("location")).toBe("https://doodle.test/ar?auth=error");
  });
});
