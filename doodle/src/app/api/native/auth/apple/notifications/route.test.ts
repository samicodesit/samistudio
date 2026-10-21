import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { AppleNotificationError } from "@/lib/auth/apple";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ verify: vi.fn(), process: vi.fn() }));
vi.mock("@/lib/auth/apple", async importOriginal => ({ ...await importOriginal<object>(), verifyAppleNotification: mocks.verify }));
vi.mock("@/lib/auth/apple-notifications", () => ({ processAppleNotification: mocks.process }));
function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://doodle.samistudio.nl/api/native/auth/apple/notifications", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body),
  });
}
const notification = { id: "event-1", type: "consent-revoked", subject: "private-subject", eventTime: 100 };
describe("Apple notification delivery", () => {
  beforeEach(() => {
    mocks.verify.mockReset().mockResolvedValue(notification);
    mocks.process.mockReset().mockResolvedValue(undefined);
  });
  it("accepts a verified server-to-server delivery without a user bearer or origin", async () => {
    const response = await POST(request({ payload: "apple-signed-notification" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.verify).toHaveBeenCalledWith("apple-signed-notification");
    expect(mocks.process).toHaveBeenCalledWith(notification);
  });
  it("rejects a forged notification before any mutation", async () => {
    mocks.verify.mockRejectedValueOnce(new AppleNotificationError("invalid"));
    const response = await POST(request({ payload: "forged" }));
    expect(response.status).toBe(401);
    expect(mocks.process).not.toHaveBeenCalled();
  });
  it("returns retryable failure for Apple's key outage or incomplete durable cleanup", async () => {
    mocks.verify.mockRejectedValueOnce(new AppleNotificationError("unavailable"));
    expect((await POST(request({ payload: "signed" }))).status).toBe(503);
    mocks.process.mockRejectedValueOnce(new Error("sensitive-storage-details"));
    const response = await POST(request({ payload: "signed" }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive-storage-details");
  });
  it("bounds body size and rejects non-payload fields before verification", async () => {
    expect((await POST(request({ payload: "x".repeat(17000) }))).status).toBe(413);
    expect((await POST(request({ payload: "signed", sub: "injected" }))).status).toBe(400);
    expect((await POST(request({ payload: "" }))).status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
