import { beforeEach, expect, it, vi } from "vitest";
import { createPackCheckout, createPackElementsCheckout, fulfillCheckoutDetails, reconcileStripePackRefund } from "./checkout";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({create:vi.fn(),retrieve:vi.fn(),list:vi.fn(),charge:vi.fn(),payment:vi.fn(),balance:vi.fn(),promise:vi.fn(),read:vi.fn(),receipt:vi.fn(),grant:vi.fn(),refund:vi.fn()}));
vi.mock("./stripe",()=>({getStripe:()=>({checkout:{sessions:{create:m.create,retrieve:m.retrieve,list:m.list}},charges:{retrieve:m.charge},paymentIntents:{retrieve:m.payment}})}));
vi.mock("./credits",()=>({getPaidBalance:m.balance,fulfillCreditPack:vi.fn()}));
vi.mock("./web-packs",()=>({createWebPackPromise:m.promise,readWebPackPromise:m.read}));
vi.mock("./web-pack-ledger",()=>({readStripeGrant:m.receipt,fulfillStripePack:m.grant,refundStripePack:m.refund}));
const user="7d9ac733-9336-4c2a-93c1-5d597d0f7f8e", reference="a".repeat(64), promise={productId:"pack_regular",credits:25,offerApplied:true,priceId:"price_regular",reference};
const session={id:"cs_paid",mode:"payment",payment_status:"paid",livemode:true,amount_total:499,client_reference_id:user,payment_intent:"pi_paid",metadata:{userId:user,pack:"pack_regular",checkoutRef:reference},line_items:{has_more:false,data:[{price:{id:"price_regular"},quantity:1}]}};
beforeEach(()=>{Object.values(m).forEach(f=>f.mockReset());m.balance.mockResolvedValue(0);m.promise.mockResolvedValue(promise);m.read.mockResolvedValue(promise);m.receipt.mockResolvedValue(null);m.retrieve.mockResolvedValue(session);m.payment.mockResolvedValue({status:"succeeded",latest_charge:{currency:"eur",amount:499,amount_refunded:0,payment_intent:"pi_paid",metadata:{pack:"pack_regular",checkoutRef:reference}}});m.grant.mockResolvedValue({balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true});});
it.each([createPackCheckout,createPackElementsCheckout])("uses the selected verified price and durable promise in either Stripe presentation",async create=>{await create({userId:user,email:null,locale:"en",origin:"https://doodle.test",productId:"pack_regular",expectedCredits:25});expect(m.promise).toHaveBeenCalledWith(user,"pack_regular",25);expect(m.create).toHaveBeenCalledWith(expect.objectContaining({line_items:[{price:"price_regular",quantity:1}],metadata:{userId:user,pack:"pack_regular",checkoutRef:reference},payment_intent_data:{metadata:{app:"doodle",pack:"pack_regular",checkoutRef:reference}}}));});
it.each([createPackCheckout, createPackElementsCheckout])("offers Adaptive Pricing without changing the verified EUR pack or its credits", async create => {
  await create({ userId: user, email: null, locale: "en", origin: "https://doodle.test", productId: "pack_regular", expectedCredits: 25 });
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ adaptive_pricing: { enabled: true }, line_items: [{ price: "price_regular", quantity: 1 }] }));
});
it("creates an embedded pack session without unsupported hosted-only custom text", async () => {
  m.create.mockImplementation(async options => {
    if (options.ui_mode === "elements" && options.custom_text) throw new Error("custom_text is not supported with ui_mode elements");
    return { id: "cs_elements", client_secret: "cs_elements_secret" };
  });
  await expect(createPackElementsCheckout({ userId: user, email: null, locale: "en", origin: "https://doodle.test", productId: "pack_regular", expectedCredits: 25 })).resolves.toEqual({ id: "cs_elements", client_secret: "cs_elements_secret" });
});
it("grants the immutable credits when Stripe reports customer presentment separately", async () => {
  const presentment = { presentment_currency: "usd", presentment_amount: 576 };
  m.retrieve.mockResolvedValue({ ...session, currency: "eur", presentment_details: presentment });
  m.payment.mockResolvedValue({ status: "succeeded", currency: "eur", amount: 499, presentment_details: presentment, latest_charge: { currency: "eur", amount: 499, amount_refunded: 0, presentment_details: presentment, payment_intent: "pi_paid", metadata: { pack: "pack_regular", checkoutRef: reference } } });
  expect(await fulfillCheckoutDetails("cs_paid", user)).toEqual({ balance: 25, productId: "pack_regular", creditsGranted: 25, offerApplied: true });
});
it.each([{ currency: "usd", amount: 576 }, { currency: "eur", amount: 498 }])("rejects a changed integration amount or currency despite local presentment", async changes => {
  m.payment.mockResolvedValue({ status: "succeeded", latest_charge: { currency: changes.currency, amount: changes.amount, amount_refunded: 0, presentment_details: { presentment_currency: "usd", presentment_amount: 576 }, payment_intent: "pi_paid", metadata: { pack: "pack_regular", checkoutRef: reference } } });
  await expect(fulfillCheckoutDetails("cs_paid", user)).rejects.toThrow("Invalid paid charge");
  expect(m.grant).not.toHaveBeenCalled();
});
it("reverses local-currency refunds using the provider's base-currency proportion", async () => {
  m.receipt.mockResolvedValue(promise);
  m.list.mockResolvedValue({ data: [session], has_more: false });
  m.charge.mockResolvedValue({ currency: "eur", amount: 499, amount_refunded: 250, presentment_details: { presentment_currency: "usd", presentment_amount: 576 }, payment_intent: "pi_paid", metadata: { pack: "pack_regular", checkoutRef: reference } });
  await reconcileStripePackRefund("ch_paid");
  expect(m.refund).toHaveBeenLastCalledWith("cs_paid", 12);
  m.charge.mockResolvedValue({ currency: "eur", amount: 499, amount_refunded: 499, presentment_details: { presentment_currency: "usd", presentment_amount: 576 }, payment_intent: "pi_paid", metadata: { pack: "pack_regular", checkoutRef: reference } });
  await reconcileStripePackRefund("ch_paid");
  expect(m.refund).toHaveBeenLastCalledWith("cs_paid", 25);
});
it("returns the promised bonus after expiry and passes verified ownership to the atomic ledger",async()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));try{expect((await fulfillCheckoutDetails("cs_paid",user)).creditsGranted).toBe(25);expect(m.grant).toHaveBeenCalledWith(user,"cs_paid","pi_paid",promise,expect.objectContaining({isTest:false}),0);}finally{vi.useRealTimers();}});
it.each([{payment_status:"unpaid"},{client_reference_id:"someone_else"},{mode:"subscription"},{line_items:{has_more:false,data:[{price:{id:"price_other"},quantity:1}]}},{line_items:{has_more:false,data:[{price:{id:"price_regular"},quantity:2}]}}])("rejects mismatched or pending Stripe purchases",async changes=>{m.retrieve.mockResolvedValue({...session,...changes});await expect(fulfillCheckoutDetails("cs_paid",user)).rejects.toThrow();expect(m.grant).not.toHaveBeenCalled();});
it("replays the receipt quantity even when the checkout intent has expired",async()=>{m.receipt.mockResolvedValue(promise);await fulfillCheckoutDetails("cs_paid",user);expect(m.read).not.toHaveBeenCalled();expect(m.grant).toHaveBeenCalledWith(user,"cs_paid","pi_paid",promise,expect.anything(),0);});
it("reconciles cumulative partial and full refunds against the recorded grant",async()=>{m.receipt.mockResolvedValue(promise);m.list.mockResolvedValue({data:[session],has_more:false});m.charge.mockResolvedValue({payment_intent:"pi_paid",amount:499,amount_refunded:250,metadata:{pack:"pack_regular",checkoutRef:reference}});await reconcileStripePackRefund("ch_paid");expect(m.refund).toHaveBeenLastCalledWith("cs_paid",12);m.charge.mockResolvedValue({payment_intent:"pi_paid",amount:499,amount_refunded:499,metadata:{pack:"pack_regular",checkoutRef:reference}});await reconcileStripePackRefund("ch_paid");expect(m.refund).toHaveBeenLastCalledWith("cs_paid",25);});
it("ignores refunds belonging to other apps",async()=>{m.charge.mockResolvedValue({metadata:{app:"other",pack:"other_pack"}});await reconcileStripePackRefund("ch_other");expect(m.list).not.toHaveBeenCalled();expect(m.refund).not.toHaveBeenCalled();});
it("rejects a mismatched charge checkout reference before debiting credits",async()=>{m.charge.mockResolvedValue({payment_intent:"pi_paid",amount:499,amount_refunded:499,metadata:{pack:"pack_regular",checkoutRef:"b".repeat(64)}});m.list.mockResolvedValue({data:[session],has_more:false});m.receipt.mockResolvedValue(promise);await expect(reconcileStripePackRefund("ch_paid")).rejects.toThrow();expect(m.refund).not.toHaveBeenCalled();});

it("checks payment state and ownership before retrieving a charge or granting",async()=>{m.retrieve.mockResolvedValue({...session,payment_status:"unpaid"});await expect(fulfillCheckoutDetails("cs_paid",user)).rejects.toThrow("checkout_pending");expect(m.payment).toHaveBeenCalledOnce();m.payment.mockClear();await expect(fulfillCheckoutDetails("cs_paid","someone_else")).rejects.toThrow("Invalid pack checkout");expect(m.payment).not.toHaveBeenCalled();expect(m.grant).not.toHaveBeenCalled();});
it("passes the already refunded quantity into the atomic first grant",async()=>{m.payment.mockResolvedValue({status:"succeeded",latest_charge:{currency:"eur",amount:499,amount_refunded:499,payment_intent:"pi_paid",metadata:{pack:"pack_regular",checkoutRef:reference}}});m.receipt.mockResolvedValue(promise);m.grant.mockResolvedValue({balance:0,creditsGranted:25,productId:"pack_regular",offerApplied:true});
 // getPaidBalance is a separate authoritative read after refund reconciliation.
 expect((await fulfillCheckoutDetails("cs_paid",user)).balance).toBe(0);expect(m.grant).toHaveBeenCalledWith(user,"cs_paid","pi_paid",promise,expect.anything(),25);expect(m.refund).toHaveBeenCalledWith("cs_paid",25);
});

it.each(["expired", "cancelled", "failed"])("ends processing for a verified %s payment",async outcome=>{
 m.retrieve.mockResolvedValue({...session,payment_status:"unpaid",status:outcome==="expired"?"expired":"complete"});
 m.payment.mockResolvedValue({status:outcome==="cancelled"?"canceled":"requires_payment_method"});
 await expect(fulfillCheckoutDetails("cs_paid",user)).rejects.toThrow("checkout_failed");expect(m.grant).not.toHaveBeenCalled();
});
it("keeps an asynchronous payment processing without granting credits",async()=>{
 m.retrieve.mockResolvedValue({...session,payment_status:"unpaid",status:"complete"});m.payment.mockResolvedValue({status:"processing"});
 await expect(fulfillCheckoutDetails("cs_paid",user)).rejects.toThrow("checkout_pending");expect(m.grant).not.toHaveBeenCalled();
});
