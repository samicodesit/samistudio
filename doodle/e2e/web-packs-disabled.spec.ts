import {test,expect} from "@playwright/test";
test.skip(process.env.PLAYWRIGHT_WEB_PACKS_ENABLED!=="false","Requires the disabled-rollout production server");
for(const size of [{name:"desktop",width:1280,height:900},{name:"short-mobile",width:360,height:640}])test(`${size.name}: web checkout stays available before Stripe pack activation`,async({page})=>{
 await page.setViewportSize(size);let catalogReads=0;
 await page.route("**/api/account",r=>r.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:0,hasPurchased:false}}));
 await page.route("**/api/checkout/catalog",r=>{catalogReads++;return r.fulfill({status:503,json:{error:"billing_unavailable"}});});
 await page.route("**/api/checkout/paywall",r=>r.fulfill({json:{accepted:true}}));
 await page.goto("/");await page.getByRole("textbox").fill("Flower cat");await page.getByRole("button",{name:"Create doodle",exact:true}).click();
 await expect(page.getByRole("button",{name:"Get 10 doodles",exact:true})).toBeEnabled();expect(catalogReads).toBe(0);
 await expect(page.locator(".web-pack-card")).toHaveCount(0);const buy=await page.getByRole("button",{name:"Get 10 doodles",exact:true}).boundingBox();expect(buy!.y+buy!.height).toBeLessThanOrEqual(size.height);
 await page.screenshot({path:`docs/qa/web-packs-2026-10-10/${size.name}-checkout-disabled.png`});
});
