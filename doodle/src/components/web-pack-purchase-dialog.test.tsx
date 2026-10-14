import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { WebPackPurchaseDialog } from "./web-pack-purchase-dialog";
import { hasPurchaseWording } from "@/lib/purchase-wording";
vi.mock("@/lib/purchase-wording",()=>({hasPurchaseWording:vi.fn(()=>false)}));
import { getCopy } from "@/lib/i18n";
vi.mock("./apple-pay-checkout", () => ({ApplePayCheckout:()=>null}));
vi.mock("./google-sign-in-button", () => ({isIosBrowser:()=>false,GoogleSignInButton:({onCredential}:{onCredential:(s:string)=>void})=><button onClick={()=>onCredential("token")}>Google sign-in</button>}));
const catalog=(credits=25)=>({offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits,normalCredits:20,offerApplied:credits===25,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]});
const props={open:true,account:{authenticated:false,email:null,balance:0,freeRemaining:0,hasPurchased:false},scene:"Flower cat",locale:"en" as const,copy:getCopy("en"),success:false,onClose:vi.fn(),onAccountChange:vi.fn()};
beforeEach(()=>{vi.mocked(hasPurchaseWording).mockReturnValue(false);window.sessionStorage.clear();vi.stubGlobal("fetch",vi.fn(async()=>Response.json(catalog())));});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("uses the Arabic plural when selecting the Mini pack",async()=>{
  render(<WebPackPurchaseDialog {...props} locale="ar" copy={getCopy("ar")}/>);
  await screen.findByRole("button",{name:/احصل على 25 رسمة/});
  fireEvent.click(screen.getByRole("radio",{name:/^صغيرة/}));
  expect(screen.getByText("6 رسومات")).toBeVisible();
  expect(screen.getByRole("button",{name:/احصل على 6 رسومات/})).toBeEnabled();
});
it("preselects Regular and selects a different card without sign-in",async()=>{render(<WebPackPurchaseDialog {...props}/>);const buy=await screen.findByRole("button",{name:"Get 25 doodles \u00b7 \u20ac4.99"});expect(buy).toBeEnabled();expect(screen.getByText("\u20ac0.20 each")).toBeVisible();fireEvent.click(screen.getByRole("radio",{name:/Mini/}));expect(screen.getByRole("button",{name:"Get 6 doodles \u00b7 \u20ac1.99"})).toBeEnabled();expect(screen.queryByText("Google sign-in")).toBeNull();});
it("shows returning copy and the correct normal quantity and unit price",async()=>{vi.mocked(fetch).mockResolvedValue(Response.json(catalog(20)));render(<WebPackPurchaseDialog {...props} account={{...props.account,authenticated:true,hasPurchased:true}}/>);await screen.findByText("\u20ac0.25 each");expect(screen.getByText(/You're out of doodles\./)).toBeVisible();expect(screen.queryByText(/Launch offer/)).toBeNull();expect(screen.getByRole("button",{name:"Get 20 doodles \u00b7 \u20ac4.99"})).toBeEnabled();});
it("refreshes a stale offer before asking for sign-in",async()=>{let reads=0;vi.mocked(fetch).mockImplementation(async()=>Response.json(catalog(++reads===1?25:20)));render(<WebPackPurchaseDialog {...props}/>);fireEvent.click(await screen.findByRole("button",{name:/Get 25 doodles/}));await screen.findByText("The offer has changed. Check the updated pack before buying.");expect(screen.queryByText("Google sign-in")).toBeNull();expect(screen.getByRole("button",{name:/Get 20 doodles/})).toBeEnabled();});
it("keeps Not now and a retry action usable when prices cannot load",async()=>{vi.mocked(fetch).mockResolvedValue(new Response(null,{status:503}));render(<WebPackPurchaseDialog {...props}/>);await screen.findByText("Packs aren't available right now. Please try again.");expect(screen.getByRole("button",{name:"Not now"})).toBeEnabled();expect(screen.getByRole("button",{name:props.copy.actions.tryAgain})).toBeEnabled();});
it("restores the selected pack across sign-in and sends its promised quantity",async()=>{const before=vi.fn().mockResolvedValue(undefined);vi.mocked(fetch).mockImplementation(async url=>url==="/api/account"?Response.json({...props.account,authenticated:true}):url==="/api/auth/google"?new Response(null,{status:204}):url==="/api/checkout"?new Response(null,{status:503}):Response.json(catalog()));render(<WebPackPurchaseDialog {...props} onBeforeCheckout={before}/>);fireEvent.click(await screen.findByRole("radio",{name:/Big/}));fireEvent.click(screen.getByRole("button",{name:/Get 60 doodles/}));fireEvent.click(await screen.findByText("Google sign-in"));await waitFor(()=>expect(fetch).toHaveBeenCalledWith("/api/checkout",expect.objectContaining({body:JSON.stringify({locale:"en",productId:"pack_big",expectedCredits:60})})));expect(before).toHaveBeenCalled();});

it("uses known signed-in account history ahead of another buyer on this browser",async()=>{vi.mocked(hasPurchaseWording).mockReturnValue(true);render(<WebPackPurchaseDialog {...props} account={{...props.account,authenticated:true,hasPurchased:false}}/>);await screen.findByRole("radio",{name:/Regular/});expect(screen.getByText(/Your 4 free doodles are used/)).toBeVisible();expect(screen.queryByText(/You're out of doodles/)).toBeNull();});

it("disables checkout with a spinner label during verification, without an error", async () => {
 render(<WebPackPurchaseDialog {...props} confirmationBusy />);
 const button = await screen.findByRole("button", { name: "Payment processing" });
 expect(button).toBeDisabled();
 expect(button).toHaveAttribute("aria-busy", "true");
 expect(button).toHaveClass("is-loading");
 expect(screen.queryByRole("alert")).toBeNull();
});
it("keeps a pending payment disabled but lets the buyer leave", async () => {
 render(<WebPackPurchaseDialog {...props} paymentPending onRetryConfirmation={vi.fn()} />);
 expect(await screen.findByRole("button", { name: "Payment processing" })).toBeDisabled();
 expect(screen.getByRole("button", { name: "Not now" })).toBeEnabled();
 expect(screen.queryByRole("alert")).toBeNull();
});

it("prevents repeated checkout taps while the checkout request is running", async () => {
 const pending = new Promise<Response>(() => {});
 vi.mocked(fetch).mockImplementation(async url => url === "/api/checkout" ? pending : Response.json(catalog()));
 render(<WebPackPurchaseDialog {...props} account={{ ...props.account, authenticated: true }} />);
 fireEvent.click(await screen.findByRole("button", { name: /Get 25 doodles/ }));
 const button = await screen.findByRole("button", { name: "Payment processing" });
 expect(button).toBeDisabled();
 fireEvent.click(button);
 await waitFor(() => expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/checkout")).toHaveLength(1));
});
