import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const png=fs.readFileSync('public/references/doodle-reference-kiss.png');
test.beforeEach(async({page})=>{await page.route('**/api/account',r=>r.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:2}}));});
test('new users start at Medium and existing choices survive reload',async({page})=>{
 await page.goto('/?runtime=app');const trigger=page.locator('.detail-trigger');await expect(trigger).toHaveAccessibleName('Detail: Medium');
 await trigger.click();await page.getByRole('radio',{name:'Simple',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.reload();await expect(trigger).toHaveAccessibleName('Detail: Simple');await trigger.click();await expect(page.getByRole('radio',{name:'Simple',exact:true})).toHaveAttribute('aria-checked','true');
});
test('picker selection preserves composer geometry and draft across mobile, desktop and RTL',async({page})=>{
 for(const c of [{width:320,url:'/'},{width:390,url:'/?runtime=app'},{width:768,url:'/'},{width:1440,url:'/'},{width:320,url:'/ar?runtime=app'}]){
  await page.setViewportSize({width:c.width,height:844});await page.goto(c.url);await page.getByRole('textbox').fill('A dog holding a balloon');const before=(await page.locator('.doodle-composer').boundingBox())!;
  await page.locator('.detail-trigger').click();await expect(page.locator('.detail-picker')).toBeVisible();await page.locator('.detail-choice').nth(2).click();await expect(page.locator('.detail-picker')).toHaveCount(0);
  expect(await page.locator('.doodle-composer').boundingBox()).toEqual(before);await expect(page.getByRole('textbox')).toHaveValue('A dog holding a balloon');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('blocked preference storage uses Medium and creation carries the selected input',async({page})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');},configurable:true}));
 const requests:unknown[]=[];await page.route('**/api/generate',async route=>{requests.push(route.request().postDataJSON());await route.fulfill({status:200,contentType:'image/png',body:png});});
 await page.goto('/?runtime=app');await expect(page.locator('.detail-trigger')).toHaveAccessibleName('Detail: Medium');await page.getByRole('textbox').fill('A dog holding a balloon');await page.getByRole('button',{name:'Create doodle',exact:true}).click();await expect(page.locator('.doodle-workspace-ready')).toBeVisible();expect(requests).toEqual([{scene:'A dog holding a balloon',detailLevel:'medium'}]);
});
test('respects reduced motion and returns focus after dismissal',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?runtime=app');await page.locator('.detail-trigger').click();await expect(page.locator('.detail-picker')).toHaveCSS('animation-name','none');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.detail-trigger')).toBeFocused();
});
