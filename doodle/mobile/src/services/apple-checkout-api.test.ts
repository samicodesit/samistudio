import { expect, it, vi } from "vitest";
import { NativeApiClient } from "./api-client";
const token = "11111111-1111-4111-8111-111111111111";
const catalog = { enabled: true, environment: "Sandbox", version: 1, offerEnd: "2026-10-31T23:59:59+01:00", packs: [
  { productId: "pack_mini", credits: 6, normalCredits: 6, offerApplied: false },
  { productId: "pack_regular", credits: 25, normalCredits: 20, offerApplied: true },
  { productId: "pack_big", credits: 60, normalCredits: 60, offerApplied: false },
] };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
it("uses authenticated Apple endpoints and accepts a bound confirmed grant", async () => {
  const paths: string[] = []; const bodies: unknown[] = [];
  const client = new NativeApiClient({ platform: "ios", baseUrl: "https://doodle.samistudio.nl", getAccessToken: async () => "a".repeat(43), fetchImpl: vi.fn(async (url, init) => {
    const path = new URL(String(url)).pathname; paths.push(path); bodies.push(init?.body ? JSON.parse(String(init.body)) : null);
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer " + "a".repeat(43));
    if (path === "/api/apple/config") return json(catalog);
    if (path === "/api/apple/intent") return json({ ...catalog.packs[0], appAccountToken: token });
    return json({ status: "granted", balance: 6, productId: "pack_mini", creditsGranted: 6, offerApplied: false, checkoutReference: token });
  }) });
  expect((await client.getAppleCatalog()).packs).toHaveLength(3);
  expect((await client.createAppleIntent("pack_mini", 6)).appAccountToken).toBe(token);
  expect(await client.verifyApplePurchase("200000000000001")).toMatchObject({ status: "granted", balance: 6 });
  expect(paths).toEqual(["/api/apple/config", "/api/apple/intent", "/api/apple/verify"]);
  expect(bodies).toEqual([null, { productId: "pack_mini", expectedCredits: 6 }, { transactionId: "200000000000001" }]);
});
it("rejects malformed quantity and grant responses before a transaction can finish", async () => {
  const client = new NativeApiClient({ platform: "ios", baseUrl: "https://doodle.samistudio.nl", getAccessToken: async () => "a".repeat(43), fetchImpl: vi.fn(async () => json({ ...catalog, packs: [{ ...catalog.packs[0], credits: 999 }] })) });
  await expect(client.getAppleCatalog()).rejects.toMatchObject({ code: "billing_unavailable" });
  await expect(client.verifyApplePurchase("not-a-transaction")).rejects.toMatchObject({ code: "invalid_request" });
});
