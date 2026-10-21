import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { DoodleClient } from "./doodle-client";
import {getCopy} from "@/lib/i18n";
vi.mock("@vercel/analytics",()=>({track:vi.fn()}));
vi.mock("./purchase-dialog",()=>({PurchaseDialog:({onClose,paymentPending,confirmationBusy,errorMessage}:{onClose:()=>void;paymentPending?:boolean;confirmationBusy?:boolean;errorMessage?:string|null})=><dialog open aria-label="Keep doodling">{(paymentPending||confirmationBusy)?<button disabled aria-busy="true">Payment processing</button>:null}{errorMessage?<p role="alert">{errorMessage}</p>:null}<button disabled={confirmationBusy&&!paymentPending} onClick={onClose}>Not now</button></dialog>}));
beforeEach(()=>{
 const accountHost=document.createElement("div");accountHost.dataset.accountHost="web";document.body.append(accountHost);
const m=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>m.set(k,v),removeItem:(k:string)=>m.delete(k)});window.sessionStorage.clear();URL.createObjectURL=vi.fn(()=>"blob:retained");URL.revokeObjectURL=vi.fn();history.replaceState({},"","/");});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it("leaves the fourth free drawing available and only opens the sheet after Get more",async()=>{
 vi.stubGlobal("fetch",vi.fn(async u=>u==="/api/account"?Response.json({authenticated:false,email:null,balance:0,freeRemaining:1}):u==="/api/generate"?new Response(new Blob(["png"],{type:"image/png"}),{headers:{"X-Doodle-Free-Remaining":"0"}}):new Response(null,{status:204})));
 render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);await screen.findByRole("button",{name:"Sign in"});fireEvent.click(screen.getByRole("button",{name:"Create doodle"}));await screen.findByText("That was your last free doodle.");expect(screen.queryByRole("dialog")).toBeNull();expect(screen.getByRole("link",{name:"Download"})).toBeVisible();fireEvent.click(screen.getByRole("button",{name:"Get more"}));expect(screen.getByRole("dialog")).toBeVisible();expect(document.querySelector('.workspace-visual img[src="blob:retained"]')).not.toBeNull();expect(URL.revokeObjectURL).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Not now"}));fireEvent.click(screen.getByRole("button",{name:"More options"}));fireEvent.click(screen.getByRole("button",{name:"Redraw this idea"}));expect(screen.getByRole("dialog")).toBeVisible();expect(vi.mocked(fetch).mock.calls.filter(([u])=>u==="/api/generate")).toHaveLength(1);
});
it("restores a ready drawing when the server discovers that credits ran out",async()=>{
 let calls=0;vi.stubGlobal("fetch",vi.fn(async u=>u==="/api/account"?Response.json({authenticated:true,email:null,balance:1,freeRemaining:0}):u==="/api/generate"?++calls===1?new Response(new Blob(["png"],{type:"image/png"})):new Response(null,{status:402,headers:{"X-Doodle-Paid-Remaining":"0"}}):new Response(null,{status:204})));
 render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);await screen.findByText("Account");fireEvent.click(screen.getByRole("button",{name:"Create doodle"}));fireEvent.click(await screen.findByRole("button",{name:"More options"}));fireEvent.click(screen.getByRole("button",{name:"Redraw this idea"}));await screen.findByRole("dialog");expect(document.querySelector('.workspace-visual img[src="blob:retained"]')).not.toBeNull();expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});
it("reports the actual fulfilled pack and returns without another confirmation",async()=>{
 history.replaceState({},"","/?checkout=cs_regular");vi.stubGlobal("fetch",vi.fn(async u=>u==="/api/account"?Response.json({authenticated:true,email:null,balance:0,freeRemaining:0}):Response.json({balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true})));
 render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);await screen.findByText("Added 25 doodles");expect(screen.queryByRole("dialog")).toBeNull();expect(screen.getByRole("textbox")).toHaveValue("Flower cat");await waitFor(()=>expect(location.search).toBe(""));
});

it("keeps pending payment neutral and recovers the actual grant without another Buy tap", async () => {
 vi.useFakeTimers();
 history.replaceState({}, "", "/?checkout=cs_pending");
 let confirmations = 0;
 vi.stubGlobal("fetch", vi.fn(async u => u === "/api/account" ? Response.json({ authenticated: true, email: null, balance: 0, freeRemaining: 0 }) : ++confirmations === 1 ? new Response(null, { status: 202 }) : Response.json({ balance: 25, productId: "pack_regular", creditsGranted: 25, offerApplied: true })));
 try {
  await act(async () => { render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat" />); });
  expect(screen.getByRole("button", { name: "Payment processing" })).toBeDisabled();
  expect(screen.queryByRole("alert")).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
  expect(screen.getByText("Added 25 doodles")).toBeVisible();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("textbox")).toHaveValue("Flower cat");
  expect(confirmations).toBe(2);
 } finally { vi.useRealTimers(); }
});

it.each(["Create", "Account"])("retains the pending session after closing and reopening from %s", async origin => {
 vi.useFakeTimers(); history.replaceState({}, "", "/?checkout=cs_reopen");
 const host=document.createElement("div");host.dataset.accountHost="web";document.body.append(host);
 const requests:string[]=[];
 vi.stubGlobal("fetch",vi.fn(async u=>{requests.push(String(u));return u==="/api/account"?Response.json({authenticated:true,email:"buyer@example.test",balance:0,freeRemaining:0}):u==="/api/checkout/confirm"?new Response(null,{status:202}):new Response(null,{status:204});}));
 try {
  await act(async()=>{render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);});
  fireEvent.click(screen.getByRole("button",{name:"Not now"}));
  if(origin==="Create")fireEvent.click(screen.getByRole("button",{name:"Create doodle"}));
  else fireEvent.click(screen.getByRole("button",{name:"Get more"}));
  expect(screen.getByRole("button",{name:"Payment processing"})).toBeDisabled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(requests.filter(u=>u==="/api/checkout/confirm")).toHaveLength(2);
 }finally{host.remove();vi.useRealTimers();}
});

it("recovers a payment in the background without reopening a dismissed sheet", async()=>{
 vi.useFakeTimers();history.replaceState({},"","/?checkout=cs_background");let confirmations=0;
 vi.stubGlobal("fetch",vi.fn(async u=>u==="/api/account"?Response.json({authenticated:true,email:null,balance:0,freeRemaining:0}):++confirmations<3?new Response(null,{status:202}):Response.json({balance:6,creditsGranted:6})));
 try{
  await act(async()=>{render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);});
  fireEvent.click(screen.getByRole("button",{name:"Not now"}));
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_000);});
  expect(screen.getByText("Added 6 doodles")).toBeVisible();expect(screen.queryByRole("dialog")).toBeNull();
 }finally{vi.useRealTimers();}
});

it("bounds a hung confirmation and leaves a processing payment dismissible",async()=>{
 vi.useFakeTimers();history.replaceState({},"","/?checkout=cs_hung");const signals:AbortSignal[]=[];
 vi.stubGlobal("fetch",vi.fn(async(u,init)=>u==="/api/account"?Response.json({authenticated:true,email:null,balance:0,freeRemaining:0}):new Promise<Response>((_,reject)=>{signals.push(init.signal);init?.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")));})));
 try{
  await act(async()=>{render(<DoodleClient locale="en" copy={getCopy("en")} initialScene="Flower cat"/>);});
  await act(async()=>{await vi.advanceTimersByTimeAsync(15_001);});
  expect(screen.getByRole("button",{name:"Payment processing"})).toBeDisabled();expect(screen.queryByRole("alert")).toBeNull();
  expect(signals[0].aborted).toBe(true);
  expect(screen.getByRole("button",{name:"Not now"})).toBeEnabled();
  fireEvent.click(screen.getByRole("button",{name:"Not now"}));expect(screen.queryByRole("dialog")).toBeNull();
 }finally{vi.useRealTimers();}
});
