import { expect, test } from "@playwright/test";
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=","base64");
test.beforeEach(async({page})=>{
 await page.route("**/api/account",r=>r.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:4}}));
});
test("remembers the selected paper, submits it once, and redraws with the same settings",async({page})=>{
 const requests:unknown[]=[];
 await page.route("**/api/generate",r=>{requests.push(r.request().postDataJSON());return r.fulfill({body:png,contentType:"image/png",headers:{"X-Doodle-Free-Remaining":"3"}});});
 await page.goto("/?runtime=app");
 await page.getByRole("radio",{name:"White",exact:true}).check();
 await expect(page.getByRole("radio",{name:"White",exact:true})).toBeChecked();
 expect(requests).toHaveLength(0);await page.reload();
 await expect(page.getByRole("radio",{name:"White",exact:true})).toBeChecked();
 await page.getByRole("textbox").fill("A yellow bird");await page.getByRole("button",{name:"Create doodle",exact:true}).click();
 await expect(page.getByAltText("Generated sticky-note doodle")).toBeVisible();
 expect(requests).toEqual([{scene:"A yellow bird",detailLevel:"simple",paperColor:"white"}]);
 await expect(page.locator(".workspace-usage,.composer-usage")).toHaveCount(0);
 await page.getByRole("button",{name:"More options"}).click();await page.getByRole("button",{name:"Redraw this idea"}).click();
 await expect.poll(()=>requests.length).toBe(2);expect(requests[1]).toEqual(requests[0]);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page.getByRole("dialog").getByText("3 free doodles left")).toBeVisible();
});
for(const width of [320,360,390,430,768,1440]) test(`color strip fits and scrolls at ${width}px`,async({page})=>{
 await page.route("**/api/generate",r=>r.abort());
 await page.setViewportSize({width,height:844});await page.goto("/?runtime=app");
 const composer=await page.locator(".doodle-composer").boundingBox();
 await page.getByRole("radio",{name:"White",exact:true}).check();
 await expect(page.getByRole("radio",{name:"White",exact:true})).toBeChecked();
 expect((await page.locator(".doodle-composer").boundingBox())?.height).toBe(composer?.height);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await expect(page.locator(".paper-color-scroll")).toBeVisible();
});
test("Arabic controls are named and scroll to the selected paper",async({page})=>{
 await page.route("**/api/generate",r=>r.abort());await page.setViewportSize({width:320,height:568});await page.goto("/ar?runtime=app");
 await page.getByRole("radio",{name:"أبيض",exact:true}).check();await expect(page.getByRole("radio",{name:"أبيض",exact:true})).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
});
