import { test, expect } from "@playwright/test";
const packsEnabled=process.env.PLAYWRIGHT_WEB_PACKS_ENABLED!=="false";
const packs={offerEnd:"2026-10-31T23:59:59+01:00",packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits:25,normalCredits:20,offerApplied:true,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]};
for(const size of [{name:"desktop",width:1280,height:900},{name:"phone",width:360,height:640}])test(`${size.name}: pending payment stays disabled across dismissal and recovers`,async({page})=>{
 await page.setViewportSize(size);await page.clock.install();let state:"pending"|"paid"="pending",checks=0,newCheckouts=0;
 await page.route("**/api/account",r=>r.fulfill({json:{authenticated:true,email:"qa@example.test",balance:0,freeRemaining:0,hasPurchased:true}}));
 await page.route("**/api/checkout/catalog",r=>r.fulfill({json:packs}));await page.route("**/api/checkout/paywall",r=>r.fulfill({json:{accepted:true}}));
 await page.route("**/api/checkout",r=>{newCheckouts++;return r.fulfill({status:500,json:{error:"unexpected_duplicate"}});});
 await page.route("**/api/checkout/confirm",r=>{checks++;return state==="pending"?r.fulfill({status:202,json:{pending:true}}):r.fulfill({json:{balance:25,creditsGranted:25,productId:"pack_regular",offerApplied:true}});});
 await page.goto("/?checkout=cs_processing_fixture");await expect(page.getByRole("button",{name:"Payment processing",exact:true})).toBeDisabled();
 const cta=page.getByRole("button",{name:"Payment processing",exact:true});await expect(cta).toHaveClass(/is-loading/);await expect(cta).toHaveAttribute("aria-busy","true");await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
 const bounds=await cta.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(size.height);
 await page.screenshot({path:`docs/qa/combined-release-2026-10-10/web-${packsEnabled?"packs":"legacy"}-processing-${size.name}.png`});
 await page.getByRole("button",{name:"Not now",exact:true}).click();await page.getByRole("textbox").fill("My flower cat");await page.getByRole("button",{name:"Create doodle",exact:true}).click();await expect(cta).toBeDisabled();
 await page.clock.fastForward(15_000);await expect.poll(()=>checks).toBeGreaterThan(1);await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
 await page.getByRole("button",{name:"Not now",exact:true}).click();state="paid";await page.clock.fastForward(15_000);await expect(page.getByText("Added 25 doodles",{exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);expect(newCheckouts).toBe(0);await expect(page.getByRole("textbox")).toHaveValue("My flower cat");
});
test("a confirmed failed payment allows another checkout without losing the prompt",async({page})=>{
 await page.route("**/api/account",r=>r.fulfill({json:{authenticated:true,email:"qa@example.test",balance:0,freeRemaining:0,hasPurchased:true}}));await page.route("**/api/checkout/catalog",r=>r.fulfill({json:packs}));await page.route("**/api/checkout/confirm",r=>r.fulfill({status:409,json:{error:"checkout_failed"}}));
 await page.goto("/?checkout=cs_failed_fixture");await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();await expect(page.locator(packsEnabled?".web-pack-buy":".purchase-primary")).toBeEnabled();expect(new URL(page.url()).searchParams.has("checkout")).toBe(false);await expect(page.getByRole("button",{name:"Payment processing",exact:true})).toHaveCount(0);
});
