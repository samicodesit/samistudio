import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notifyOwnerSale, sendOwnerSale } from "./sale-notification";

const mocks = vi.hoisted(() => ({ after: vi.fn(), redis: vi.fn(), fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("../redis", () => ({ redisCommand: mocks.redis }));

const sale = { channel: "android" as const, id: "private-purchase-token", isTest: false };

describe("owner sale notification", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.redis.mockResolvedValue("OK");
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ id: "email-id" }), { status: 200 }));
  });

  it("runs after the response and keeps receipt tokens out of the email", async () => {
    notifyOwnerSale(sale);
    expect(mocks.fetch).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body);
    expect(body.to).toEqual(["samicodesit@gmail.com"]);
    expect(body.subject).toBe("Doodle sale: 10 doodles on Google Play");
    expect(body.text).not.toContain(sale.id);
    expect(body.text).toContain("10 doodles have been delivered");
  });

  it.each(["preview", "development"])("does not send from %s", (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    notifyOwnerSale(sale);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not notify about test purchases or missing configuration", () => {
    notifyOwnerSale({ ...sale, isTest: true });
    vi.stubEnv("RESEND_API_KEY", "");
    notifyOwnerSale(sale);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not send a duplicate or overlapping notification", async () => {
    mocks.redis.mockResolvedValueOnce(null);
    await sendOwnerSale(sale);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retries temporary failures with the same idempotency key", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("timeout"));
    await sendOwnerSale(sale);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch.mock.calls[0][1].headers["Idempotency-Key"]).toBe(mocks.fetch.mock.calls[1][1].headers["Idempotency-Key"]);
    expect(mocks.redis.mock.calls.at(-1)?.[0][0]).toBe("EVAL");
  });

  it("email and database failures cannot fail the customer's purchase", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(sendOwnerSale(sale)).resolves.toBeUndefined();
    mocks.redis.mockRejectedValue(new Error("offline"));
    await expect(sendOwnerSale(sale)).resolves.toBeUndefined();
    mocks.after.mockImplementationOnce(() => { throw new Error("outside request"); });
    expect(() => notifyOwnerSale(sale)).not.toThrow();
  });
});
