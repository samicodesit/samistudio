import { expect, test } from "@playwright/test";
import { SUPPORTED_LOCALES, localePath } from "../src/lib/i18n";

for (const width of [320,390,1280]) {
  test(`translated detail labels and examples fit at ${width}px`,async({page})=>{
    test.setTimeout(120_000);
    await page.setViewportSize({width,height:844});
    await page.route("**/api/account",route=>route.fulfill({json:{authenticated:false,email:null,balance:0,freeRemaining:2}}));
    for(const locale of SUPPORTED_LOCALES){
      await page.goto(localePath(locale));
      const trigger=page.locator('.detail-trigger');
      await expect(trigger).toBeEnabled();
      const bounds=(await trigger.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);expect(bounds.x+bounds.width).toBeLessThanOrEqual(width);
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const choices=page.locator('.detail-choice');await expect(choices).toHaveCount(3);
      for(const choice of await choices.all()){
        const b=(await choice.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(844);
        await expect.poll(()=>choice.locator('img').evaluate(e=>(e as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      await choices.nth(1).focus();await page.keyboard.press(locale==='ar'?'ArrowLeft':'ArrowRight');
      await expect(choices.nth(2)).toBeFocused();await expect(choices.nth(2)).toHaveAttribute('aria-checked','true');
      await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(trigger).toBeFocused();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  });
}
