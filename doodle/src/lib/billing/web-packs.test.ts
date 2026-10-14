import { beforeEach, expect, it, vi } from "vitest";
let getWebPackCatalog: typeof import("./web-packs").getWebPackCatalog;
let createWebPackPromise: typeof import("./web-packs").createWebPackPromise;
let readWebPackPromise: typeof import("./web-packs").readWebPackPromise;
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({price:vi.fn(),redis:vi.fn()}));
vi.mock("./stripe",()=>({getStripe:()=>({prices:{retrieve:m.price}})}));
vi.mock("@/lib/redis",()=>({redisCommand:m.redis}));
const user="11111111-1111-4111-8111-111111111111";
beforeEach(async()=>{vi.useRealTimers();vi.resetModules();({getWebPackCatalog,createWebPackPromise,readWebPackPromise}=await import("./web-packs"));vi.unstubAllEnvs();vi.stubEnv("DOODLE_LAUNCH_DELAY_DAYS","0");vi.stubEnv("STRIPE_PACKS_CHECKOUT_ENABLED","true");for(const p of ["MINI","REGULAR","BIG"])vi.stubEnv("STRIPE_PACK_"+p+"_PRICE_ID","price_"+p.toLowerCase());m.price.mockReset().mockImplementation(async(id:string)=>({id,active:true,type:"one_time",currency:"eur",unit_amount:id.endsWith("mini")?199:id.endsWith("regular")?499:999,tax_behavior:"inclusive",metadata:{app:"doodle",pack:"pack_"+id.slice(6)},product:{id:"prod_"+id.slice(6),active:true,metadata:{app:"doodle",pack:"pack_"+id.slice(6)}}}));m.redis.mockReset().mockResolvedValue(1)});
it("shares the Android offer schedule and uses verified Stripe numeric prices",async()=>{const c=await getWebPackCatalog(new Date("2026-10-10"));expect(c.packs.map(p=>[p.productId,p.credits,p.unitAmount])).toEqual([["pack_mini",6,199],["pack_regular",25,499],["pack_big",60,999]]);expect(c.offerEnd).toBe("2026-10-31T23:59:59+01:00");expect(JSON.stringify(c)).not.toContain("price_regular");expect((await getWebPackCatalog(new Date("2026-11-01"))).packs[1]).toMatchObject({credits:20,offerApplied:false})});
it("rejects stale quantity before any promise or checkout",async()=>{await expect(createWebPackPromise(user,"pack_regular",25,new Date("2026-11-01"))).rejects.toThrow("offer_changed");expect(m.redis).not.toHaveBeenCalled()});
it.each([{active:false},{type:"recurring"},{currency:"usd"},{unit_amount:399},{tax_behavior:"exclusive"}])("fails closed on invalid configured prices %j",async value=>{m.price.mockResolvedValue({id:"price_mini",active:true,type:"one_time",currency:"eur",unit_amount:199,tax_behavior:"inclusive",...value});await expect(getWebPackCatalog()).rejects.toThrow()});
it("recovers the promised bonus without consulting today's date",async()=>{m.redis.mockResolvedValue([user,"pack_regular","25","1","price_regular"]);expect(await readWebPackPromise(user,"pack_regular","a".repeat(64))).toMatchObject({credits:25,offerApplied:true,priceId:"price_regular"})});
it("rejects another account or forged credit quantity",async()=>{m.redis.mockResolvedValue(["other","pack_regular","60","1","price_regular"]);await expect(readWebPackPromise(user,"pack_regular","a".repeat(64))).rejects.toThrow()});

it.each([
  { metadata: { app: "other", pack: "pack_mini" } },
  { metadata: { app: "doodle", pack: "pack_big" } },
  { product: "prod_unexpanded" },
  { product: { id: "prod_deleted", deleted: true } },
  { product: { id: "prod_inactive", active: false, metadata: { app: "doodle", pack: "pack_mini" } } },
  { product: { id: "prod_other", active: true, metadata: { app: "other", pack: "pack_mini" } } },
  { product: { id: "prod_wrong_pack", active: true, metadata: { app: "doodle", pack: "pack_big" } } },
])("rejects a correctly priced item with wrong Doodle product binding %j", async changes => {
  m.price.mockImplementation(async (id: string) => ({ id, active: true, type: "one_time", currency: "eur", unit_amount: 199, tax_behavior: "inclusive", metadata: { app: "doodle", pack: "pack_mini" }, product: { id: "prod_mini", active: true, metadata: { app: "doodle", pack: "pack_mini" } }, ...changes }));
  await expect(createWebPackPromise(user, "pack_mini", 6)).rejects.toThrow("Invalid pack price");
  expect(m.redis).not.toHaveBeenCalled();
});
it("coalesces concurrent catalog reads without freezing offer quantities", async () => {
  const catalogs = await Promise.all(Array.from({length: 8}, () => getWebPackCatalog(new Date("2026-10-10"))));
  expect(catalogs.every(c => c.packs[1].credits === 25)).toBe(true);
  expect(m.price).toHaveBeenCalledTimes(3);
  expect((await getWebPackCatalog(new Date("2026-11-01"))).packs[1].credits).toBe(20);
  expect(m.price).toHaveBeenCalledTimes(3);
});
it("refreshes verified price data after thirty seconds", async () => {
  vi.useFakeTimers();
  await getWebPackCatalog();
  vi.advanceTimersByTime(30_001);
  m.price.mockRejectedValue(new Error("price no longer available"));
  await expect(getWebPackCatalog()).rejects.toThrow("price no longer available");
});
it("backs off failed catalog price reads for five seconds", async () => {
  vi.useFakeTimers();m.price.mockRejectedValue(new Error("Stripe unavailable"));
  await expect(getWebPackCatalog()).rejects.toThrow();
  await expect(getWebPackCatalog()).rejects.toThrow();
  expect(m.price).toHaveBeenCalledTimes(3);
  vi.advanceTimersByTime(5_001);
  await expect(getWebPackCatalog()).rejects.toThrow();
  expect(m.price).toHaveBeenCalledTimes(6);
});

it("catalog limit fails closed when Redis is unavailable", async () => {
  vi.stubEnv("SESSION_SECRET", "isolated-secret");m.redis.mockRejectedValue(new Error("Redis unavailable"));
  const {checkWebCatalogLimit} = await import("./web-packs");
  expect(await checkWebCatalogLimit(new Request("https://doodle.example/api/checkout/catalog"))).toBe("unavailable");
});
