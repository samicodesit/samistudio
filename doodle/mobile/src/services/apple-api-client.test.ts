import { expect, it, vi } from "vitest";
import { NativeApiClient } from "./api-client";
import type { NativeAppleAttestation } from "../platform/apple-attestation";
const installId="11111111-1111-4111-8111-111111111111", keyId=Buffer.alloc(32,1).toString("base64"), scope="a".repeat(64);
const iosConfig={enabled:true,packageName:"nl.samistudio.doodle",minimumBuild:"1",attestation:"app_attest",guestEnabled:true,environment:"production"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const challenge={challenge:"c".repeat(43),requestHash:"h".repeat(43),expiresAt:Date.now()+300000,keyScope:scope};
function setup() {
  let challengeCount=0, trial:string|null=null;
  const apple:NativeAppleAttestation={prove:vi.fn(async()=>({keyId,assertion:"a".repeat(64)})),forget:vi.fn(async()=>{})};
  const hash=vi.fn(async(_value:string)=>"a".repeat(64));
  const fetchImpl=vi.fn<typeof fetch>(async(url,_init)=>{
    const path=new URL(String(url)).pathname;
    if(path==="/api/native/config")return json(iosConfig);
    if(path==="/api/native/attestation/challenge")return json({...challenge,challenge:(++challengeCount===1?"c":"d").repeat(43)});
    if(path==="/api/native/attestation/apple/register")return json({registered:true});
    if(path==="/api/native/session/guest")return json({trialToken:"trial-token-123456789012345",expiresAt:Date.now()+3600000,freeRemaining:4});
    if(path==="/api/account")return json({authenticated:true,email:null,balance:89,freeRemaining:null});
    if(path==="/api/generate")return new Response(new Uint8Array([1,2,3]),{headers:{"Content-Type":"image/png","X-Doodle-Paid-Remaining":"88"}});
    throw Error("Unexpected endpoint "+path);
  });
  const legacy=vi.fn(async()=>"legacy-token");
  const client=new NativeApiClient({baseUrl:"https://doodle-stage.vercel.app",platform:"ios",fetchImpl,appleAttestation:apple,requestIntegrity:legacy,getAccessToken:async()=>"a".repeat(43),getTrialToken:async()=>trial,setTrialToken:async(value)=>{trial=value;},getInstallId:async()=>installId,hashScene:hash,stagePng:async()=>"file:///doodle.png"});
  return {client,apple,fetchImpl,legacy,hash};
}
it("registers first-use App Attest, gets a fresh challenge, and sends an authenticated iPhone proof",async()=>{
  const h=setup(); vi.mocked(h.apple.prove).mockImplementationOnce(async(context,register)=>{await register({keyId,challenge:context.challenge,attestation:"Apple attestation"});return {registered:true};});
  await expect(h.client.generate("Two cats hug")).resolves.toMatchObject({imageUri:"file:///doodle.png",paidRemaining:88});
  expect(h.legacy).not.toHaveBeenCalled();
  const registration=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/register"))!;
  expect(JSON.parse(String(registration[1]?.body))).toEqual({installId,keyId,challenge:"c".repeat(43),attestation:"Apple attestation"});
  const generate=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/api/generate"))!; const headers=new Headers(generate[1]?.headers);
  expect(headers.get("Origin")).toBe("https://doodle-stage.vercel.app");expect(headers.get("x-doodle-client")).toBe("native-ios");expect(headers.get("x-doodle-app-attest-key")).toBe(keyId);expect(headers.get("x-doodle-attestation-challenge")).toBe("d".repeat(43));expect(headers.get("authorization")).toBe(`Bearer ${"a".repeat(43)}`);
});
it("creates a signed iPhone guest trial without sending an account bearer",async()=>{
  const h=setup();await expect(h.client.createGuestSession(installId)).resolves.toMatchObject({freeRemaining:4});const call=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/guest"))!;
  expect(JSON.parse(String(call[1]?.body))).toEqual({installId,keyId,challenge:"c".repeat(43),assertion:"a".repeat(64)});expect(new Headers(call[1]?.headers).has("authorization")).toBe(false);
});
it("binds the selected photo and detail before sending it to generation",async()=>{
  const h=setup();await h.client.generate("", "detailed", "AQID");expect(h.hash).toHaveBeenCalledWith("doodle-photo-v1:AQID");const call=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/attestation/challenge"))!;expect(JSON.parse(String(call[1]?.body))).toMatchObject({sceneHash:"a".repeat(64),detailLevel:"detailed"});
});
it.each([false,"wrong-provider"])("fails closed for unavailable or incorrect iPhone configuration: %s",async value=>{
  const h=setup();h.fetchImpl.mockResolvedValue(json(value===false?{...iosConfig,enabled:false}:{enabled:true,packageName:"nl.samistudio.doodle",minimumVersionCode:2,attestation:"play_integrity",guestEnabled:true,cloudProjectNumber:"123"}));await expect(h.client.generate("Two cats hug")).rejects.toMatchObject({code:"native_generation_unavailable"});expect(h.apple.prove).not.toHaveBeenCalled();
});
it("forgets a server-rejected key before the next user retry",async()=>{
  const h=setup();const fetch=h.fetchImpl.getMockImplementation()!;h.fetchImpl.mockImplementation(async(url,init)=>String(url).endsWith("/api/generate")?json({error:"native_attestation_failed"},403):fetch(url,init));await expect(h.client.generate("Two cats hug")).rejects.toMatchObject({code:"native_attestation_failed"});expect(h.apple.forget).toHaveBeenCalledWith(scope);
});
it("keeps an authenticated zero-balance iPhone's original trial available",async()=>{
  const h=setup();const fetch=h.fetchImpl.getMockImplementation()!;h.fetchImpl.mockImplementation(async(url,init)=>String(url).endsWith("/api/account")?json({authenticated:true,email:null,balance:0,freeRemaining:null}):fetch(url,init));await h.client.getAccount();await h.client.generate("Two cats hug");const guest=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/guest"));expect(guest).toBeDefined();const generation=h.fetchImpl.mock.calls.find(call=>String(call[0]).endsWith("/api/generate"))!;expect(new Headers(generation[1]?.headers).has("authorization")).toBe(false);expect(new Headers(generation[1]?.headers).get("x-doodle-trial-token")).toBe("trial-token-123456789012345");
});
