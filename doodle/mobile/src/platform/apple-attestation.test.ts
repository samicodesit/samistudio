import { expect, it, vi } from "vitest";
import { createAppleAttestation, type AppleIntegrityModule } from "./apple-attestation";
import { NativeServiceError } from "../services/errors";
vi.mock("@expo/app-integrity", () => ({ isSupported: false }));
const scope = "a".repeat(64), key = Buffer.alloc(32, 1).toString("base64"), nextKey = Buffer.alloc(32, 2).toString("base64");
function setup() {
  const data = new Map<string,string>();
  const storage = { getItem: async (k:string) => data.get(k) ?? null, setItem: async (k:string,v:string) => {data.set(k,v);}, deleteItem: async (k:string) => {data.delete(k);} };
  const module: AppleIntegrityModule = { isSupported: true, generateKeyAsync: vi.fn().mockResolvedValue(key), attestKeyAsync: vi.fn().mockResolvedValue("attestation"), generateAssertionAsync: vi.fn().mockResolvedValue("assertion") };
  const attest = createAppleAttestation(storage, module); const register = vi.fn(async (_input: { keyId:string; challenge:string; attestation:string }) => {});
  const context = { keyScope: scope, challenge: "b".repeat(43), requestHash: "c".repeat(43), expiresAt: Date.now()+300000 };
  return { data, storage, module, attest, register, context };
}
it("registers a hardware key once, then signs later requests for that principal", async () => {
  const h=setup(); expect(await h.attest.prove(h.context,h.register)).toEqual({registered:true});
  expect(h.register).toHaveBeenCalledWith({keyId:key,challenge:h.context.challenge,attestation:"attestation"});
  expect(await h.attest.prove({...h.context,requestHash:"d".repeat(43)},h.register)).toEqual({keyId:key,assertion:"assertion"});
  expect(h.module.generateAssertionAsync).toHaveBeenCalledWith(key,"d".repeat(43)); expect(h.module.generateKeyAsync).toHaveBeenCalledOnce();
});
it("creates separate keys after an account or environment scope changes", async () => {
  const h=setup(); vi.mocked(h.module.generateKeyAsync).mockResolvedValueOnce(key).mockResolvedValueOnce(nextKey);
  await h.attest.prove(h.context,h.register); await h.attest.prove({...h.context,keyScope:"e".repeat(64)},h.register);
  expect(h.register.mock.calls.map(call=>call[0].keyId)).toEqual([key,nextKey]);
});
it("fails closed on unsupported devices", async () => {
  const h=setup(); h.module.isSupported=false;
  await expect(h.attest.prove(h.context,h.register)).rejects.toMatchObject({code:"native_generation_unavailable"}); expect(h.register).not.toHaveBeenCalled(); expect(h.module.generateKeyAsync).not.toHaveBeenCalled();
});
it("coalesces first-key registration while the provider is in flight", async () => {
  const h=setup(); let finish!:()=>void; h.register.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const first=h.attest.prove(h.context,h.register); const second=h.attest.prove(h.context,h.register); while(!finish) await new Promise(resolve=>setTimeout(resolve,0));
  finish(); expect(await Promise.all([first,second])).toEqual([{registered:true},{registered:true}]); expect(h.register).toHaveBeenCalledOnce();
});
it("replaces a stale restored key when Apple reports invalid key", async () => {
  const h=setup(); await h.attest.prove(h.context,h.register); vi.mocked(h.module.generateAssertionAsync).mockRejectedValueOnce({code:"ERR_APP_INTEGRITY_INVALID_KEY"}); vi.mocked(h.module.generateKeyAsync).mockResolvedValueOnce(nextKey);
  expect(await h.attest.prove(h.context,h.register)).toEqual({registered:true}); expect(h.register.mock.calls[1][0].keyId).toBe(nextKey);
});
it("retains the generated key during a temporary Apple outage", async () => {
  const h=setup(); vi.mocked(h.module.attestKeyAsync).mockRejectedValueOnce({code:"ERR_APP_INTEGRITY_SERVER_UNAVAILABLE"});
  await expect(h.attest.prove(h.context,h.register)).rejects.toMatchObject({code:"native_generation_unavailable"}); await h.attest.prove(h.context,h.register);
  expect(h.module.generateKeyAsync).toHaveBeenCalledOnce(); expect(h.module.attestKeyAsync).toHaveBeenLastCalledWith(key,h.context.requestHash);
});
it("retries uncertain server registration with the same verified attestation and original challenge", async () => {
  const h=setup(); h.register.mockRejectedValueOnce(new NativeServiceError("network")); await expect(h.attest.prove(h.context,h.register)).rejects.toMatchObject({code:"network"});
  expect(await h.attest.prove({...h.context,challenge:"f".repeat(43)},h.register)).toEqual({registered:true}); expect(h.register).toHaveBeenLastCalledWith({keyId:key,challenge:h.context.challenge,attestation:"attestation"}); expect(h.module.attestKeyAsync).toHaveBeenCalledOnce();
});
it("forgets a rejected key so the next retry registers a fresh one", async () => {
  const h=setup(); await h.attest.prove(h.context,h.register); await h.attest.forget(scope); vi.mocked(h.module.generateKeyAsync).mockResolvedValueOnce(nextKey); await h.attest.prove(h.context,h.register); expect(h.register.mock.calls[1][0].keyId).toBe(nextKey);
});
