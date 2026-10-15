import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const offerEnd="2026-10-31T23:59:59+01:00";
const catalog=(credits=25)=>({offerEnd,packs:[{productId:"pack_mini",credits:6,normalCredits:6,offerApplied:false,unitAmount:199,currency:"EUR"},{productId:"pack_regular",credits,normalCredits:20,offerApplied:credits===25,unitAmount:499,currency:"EUR"},{productId:"pack_big",credits:60,normalCredits:60,offerApplied:false,unitAmount:999,currency:"EUR"}]});
const proof=process.env.DOODLE_QA_OUTPUT_DIR ?? "test-results/web-packs";
for(const size of [{name:"desktop",width:1280,height:900},{name:"short-mobile",width:360,height:640}])test(`${size.name}: four free results, gentle exhaustion and pinned pack checkout`,async({page})=>{
 await page.setViewportSize(size);let left=4;
 await page.route("**/api/account",r=>r.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:left,hasPurchased:false}}));
 await page.route("**/api/checkout/catalog",r=>r.fulfill({json:catalog()}));
 await page.route("**/api/checkout/paywall",r=>r.fulfill({json:{accepted:true}}));
 const image=await readFile("public/landing/flower-cat.webp");await page.route("**/api/generate",r=>r.fulfill({body:image,contentType:"image/webp",headers:{"X-Doodle-Free-Remaining":String(--left)}}));
 await page.goto("/");await page.getByRole("textbox").fill("A cat holding a flower");
 for(let i=0;i<4;i++){
  await page.getByRole("button",{name:"Create doodle",exact:true}).click();await expect(page.getByRole("link",{name:"Download",exact:true})).toBeVisible();
  if(i<3){await expect(page.getByText(`${3-i} free doodle${3-i===1?"":"s"} left`,{exact:true})).toBeVisible();await page.getByRole("button",{name:"Back",exact:true}).click();}
 }
 await expect(page.getByText("That was your last free doodle.",{exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);
 await page.screenshot({path:`${proof}/${size.name}-fourth.png`});
 await page.getByRole("button",{name:"Get more",exact:true}).click();const sheet=page.getByRole("dialog",{name:"Keep doodling"});await expect(sheet).toBeVisible();
 if(size.name==="short-mobile"){const frame=await sheet.boundingBox();expect(frame!.x).toBe(0);expect(frame!.width).toBe(size.width);}
 const buy=page.getByRole("button",{name:/Get 25 doodles/});await expect(buy).toBeEnabled();
 await expect(page.getByText("\u20ac0.20 each",{exact:true})).toBeVisible();await expect(page.getByRole("radio",{name:/Regular/})).toHaveAttribute("aria-checked","true");
 for(const card of await page.locator(".web-pack-card").all()){const cardBox=await card.boundingBox();const priceBox=await card.locator(".web-pack-card-price strong").last().boundingBox();expect(cardBox!.x+cardBox!.width-priceBox!.x-priceBox!.width).toBeLessThanOrEqual(22);}
 const before=await buy.boundingBox();expect(before!.y+before!.height).toBeLessThanOrEqual(size.height);
 await page.screenshot({path:`${proof}/${size.name}-launch.png`});
 await page.getByRole("radio",{name:/Big/}).click();await expect(page.getByRole("button",{name:/Get 60 doodles/})).toBeVisible();
 await page.getByRole("button",{name:"Not now",exact:true}).click();await expect(page.getByRole("link",{name:"Download",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Back",exact:true}).click();await expect(page.getByRole("textbox")).toHaveValue("A cat holding a flower");
 await page.getByRole("button",{name:"Create doodle",exact:true}).click();expect(left).toBe(0);await expect(sheet).toBeVisible();
});
test("normal pricing, returning buyer wording and large text keep the footer visible",async({page})=>{
 await page.setViewportSize({width:360,height:640});await page.route("**/api/account",r=>r.fulfill({json:{authenticated:true,email:"qa@example.test",balance:0,freeRemaining:0,hasPurchased:true}}));await page.route("**/api/checkout/catalog",r=>r.fulfill({json:catalog(20)}));
 await page.goto("/");await page.getByRole("textbox").fill("Flower cat");await page.getByRole("button",{name:"Create doodle",exact:true}).click();await expect(page.getByText(/You're out of doodles/)).toBeVisible();await expect(page.getByText("\u20ac0.25 each",{exact:true})).toBeVisible();await expect(page.getByText(/Launch offer/)).toHaveCount(0);
 await page.screenshot({path:`${proof}/short-mobile-normal.png`});
 await page.addStyleTag({content:".web-pack-dialog p,.web-pack-dialog button,.web-pack-dialog span{font-size:26px!important}.web-pack-heading h2{font-size:42px!important}"});
 const buy=page.getByRole("button",{name:/Get 20 doodles/});await expect(buy).toBeVisible();const bounds=await buy.boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(640);await expect(page.getByRole("button",{name:"Not now",exact:true})).toBeVisible();await page.screenshot({path:`${proof}/short-mobile-large-text.png`});
});
test("all languages render pack quantity, selection and localized dismiss controls",async({page})=>{
 await page.setViewportSize({width:360,height:640});await page.route("**/api/account",r=>r.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:0,hasPurchased:false}}));await page.route("**/api/checkout/catalog",r=>r.fulfill({json:catalog()}));
 for(const locale of ["en","nl","de","fr","es","pt-br","it","ja","ko","ar"]){await page.goto(locale==="en"?"/":`/${locale}`);await page.locator("textarea").fill("Flower cat");await page.locator("#composer .composer-footer > button").click();await expect(page.locator(".web-pack-card")).toHaveCount(3);await expect(page.locator(".web-pack-buy")).toBeEnabled();const box=await page.locator(".web-pack-buy").boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(640);await expect(page.locator(".web-pack-dismiss")).toBeVisible();if(locale==="ar")await page.screenshot({path:`${proof}/short-mobile-arabic.png`});await page.locator(".web-pack-dismiss").click();}
});
test("checkout return preserves the real local result and prompt",async({page})=>{
 let purchased=false;await page.route("**/api/account",r=>r.fulfill({json:{authenticated:true,email:"qa@example.test",balance:purchased?25:0,freeRemaining:purchased?0:1,hasPurchased:purchased}}));await page.route("**/api/checkout/catalog",r=>r.fulfill({json:catalog()}));const image=await readFile("public/landing/flower-cat.webp");await page.route("**/api/generate",r=>r.fulfill({body:image,contentType:"image/webp",headers:{"X-Doodle-Free-Remaining":"0"}}));
 await page.route("**/api/checkout",async r=>{const draft=await page.evaluate(async()=>{const id=sessionStorage.getItem("doodle:checkout-draft-id");return new Promise<{portable:boolean;bytes:number;scene:string}>((resolve,reject)=>{const request=indexedDB.open("doodle-checkout-draft",1);request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,read=db.transaction("drafts").objectStore("drafts").get(id!);read.onerror=()=>{db.close();reject(read.error);};read.onsuccess=()=>{const value=read.result;db.close();resolve({portable:value.imageBytes instanceof ArrayBuffer && !(value.image instanceof Blob),bytes:value.imageBytes?.byteLength??0,scene:value.scene});};};});});expect(draft).toEqual({portable:true,bytes:image.length,scene:"My preserved flower cat"});expect(r.request().postDataJSON()).toEqual({locale:"en",productId:"pack_regular",expectedCredits:25});return r.fulfill({json:{url:"https://checkout.stripe.com/c/pay/local_fixture"}});});
 await page.route("https://checkout.stripe.com/c/pay/local_fixture",r=>{purchased=true;return r.fulfill({contentType:"text/html",body:'<script>location.replace("http://127.0.0.1:3100/?checkout=cs_fixture")</script>'});});
 await page.route("**/api/checkout/confirm",r=>r.fulfill({json:{balance:25,productId:"pack_regular",creditsGranted:25,offerApplied:true}}));
 await page.goto("/");await page.getByRole("textbox").fill("My preserved flower cat");await page.getByRole("button",{name:"Create doodle",exact:true}).click();await page.getByRole("button",{name:"Get more",exact:true}).click();await page.getByRole("button",{name:/Get 25 doodles/}).click();await expect(page.getByText("Added 25 doodles",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Download",exact:true})).toBeVisible();await expect(page.getByRole("dialog")).toHaveCount(0);await page.getByRole("button",{name:"Back",exact:true}).click();await expect(page.getByRole("textbox")).toHaveValue("My preserved flower cat");
});
