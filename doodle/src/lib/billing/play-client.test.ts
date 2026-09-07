import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlayRuntime, preparePlayPurchase, purchasePlayPack, recoverPlayPurchases } from "./play-client";

const product = { itemId: "doodle_credits_10", price: { currency: "EUR", value: "4.99" } };
const service = () => ({ getDetails: vi.fn().mockResolvedValue([product]), listPurchases: vi.fn().mockResolvedValue([]) });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe("Play client", () => {
  it("retains Play intent across locale navigation and API failure", async () => {
    vi.stubGlobal("location", { search: "?runtime=play" });
    expect(isPlayRuntime()).toBe(true);
    vi.stubGlobal("location", { search: "" });
    expect(isPlayRuntime()).toBe(true);
    await expect(preparePlayPurchase()).rejects.toThrow();
  });

  it("uses store price and opens PaymentRequest synchronously with server account binding", async () => {
    const goods = service();
    vi.stubGlobal("getDigitalGoodsService", vi.fn().mockResolvedValue(goods));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ enabled: true, productId: product.itemId, obfuscatedAccountId: "a".repeat(64) })).mockResolvedValueOnce(Response.json({ balance: 10 }));
    const complete = vi.fn().mockResolvedValue(undefined);
    const show = vi.fn().mockResolvedValue({ details: { purchaseToken: "token" }, complete });
    const request = vi.fn(function () { return { show }; });
    vi.stubGlobal("PaymentRequest", request);
    const prepared = await preparePlayPurchase();
    const result = purchasePlayPack(prepared);
    expect(show).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith([{ supportedMethods: "https://play.google.com/billing", data: { sku: product.itemId, obfuscatedAccountId: "a".repeat(64) } }], { total: { label: "Doodle", amount: product.price } });
    await result;
    expect(fetchMock).toHaveBeenLastCalledWith("/api/play/verify", expect.objectContaining({ body: JSON.stringify({ purchaseToken: "token", productId: product.itemId }) }));
    expect(complete).toHaveBeenCalledWith("success");
  });

  it("does not complete successfully when backend verification fails", async () => {
    const complete = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("PaymentRequest", vi.fn(function () { return { show: () => Promise.resolve({ details: { purchaseToken: "token" }, complete }) }; }));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: "pending" }, { status: 409 }));
    await expect(purchasePlayPack({ service: service(), product, obfuscatedAccountId: "a".repeat(64) })).rejects.toThrow();
    expect(complete).toHaveBeenCalledWith("fail");
  });

  it("recovers only the fixed pack and never consumes purchases on the client", async () => {
    const goods = service();
    goods.listPurchases.mockResolvedValue([{ itemId: product.itemId, purchaseToken: "pending-token" }, { itemId: "other", purchaseToken: "ignored" }]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ balance: 10 }));
    expect(await recoverPlayPurchases(goods)).toEqual({ recovered: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("continues recovery after a foreign or pending token", async () => {
    const goods = service();
    goods.listPurchases.mockResolvedValue([{ itemId: product.itemId, purchaseToken: "foreign" }, { itemId: product.itemId, purchaseToken: "own" }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 409 })).mockResolvedValueOnce(Response.json({ status: "granted_consume_pending", balance: 10 }));
    expect(await recoverPlayPurchases(goods)).toEqual({ recovered: 1, failed: 1 });
  });
});
