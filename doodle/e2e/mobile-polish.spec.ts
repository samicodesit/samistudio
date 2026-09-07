import { expect, test } from '@playwright/test';
import fs from 'node:fs';

test('mobile compose and result actions stay in reach after generation', async ({ page }) => {
  await page.route('**/api/account', route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.route('**/api/generate', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync('public/references/doodle-reference-kiss.png') }));
  for (const viewport of [{width:320,height:700}, {width:360,height:800}, {width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByText('First 2 doodles free')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path:`test-results/polish-idle-${viewport.width}.png`});
    const heading = await page.locator('#scene-title').boundingBox();
    expect(heading!.y).toBeLessThan(120);
    await page.getByRole('textbox').fill('A little love note');
    await page.locator('.composer-footer > button').click();
    await expect(page.locator('.doodle-workspace-ready')).toBeVisible();
    await page.screenshot({path:`test-results/polish-ready-${viewport.width}.png`});
    const stage = await page.locator('.doodle-stage').boundingBox();
    expect(stage!.y).toBeGreaterThanOrEqual(0);
    for (const selector of ['.result-save-actions', '.new-scene-action']) {
      const box = await page.locator(selector).boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.locator('.new-scene-action').click();
    await expect(page.getByRole('textbox')).toBeFocused();
  }
});

test('mobile dialogs remain scrollable in a keyboard-sized viewport and restore focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/account', route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.route('**/api/generate', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync('public/references/doodle-reference-kiss.png') }));
  await page.goto('/');
  await page.getByRole('textbox').fill('A little love note');
  await page.locator('.composer-footer > button').click();
  await page.locator('.doodle-stage-result').click();
  await page.screenshot({path:'test-results/polish-image-dialog.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('.doodle-stage-result')).toBeFocused();
  await page.locator('.report-action').click();
  await page.setViewportSize({ width: 390, height: 420 });
  await page.locator('.report-dialog textarea').fill('An issue with the drawing');
  await page.locator('.report-dialog-actions button').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.report-dialog-actions button').last()).toBeInViewport();
  await page.screenshot({path:'test-results/polish-report-keyboard-height.png'});
  expect(await page.locator('.report-dialog').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('.report-action')).toBeFocused();
});

test('installed tabs retain a result and background generation does not move Ideas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/account', route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  let finish!: () => void;
  const generation = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/api/generate', async route => {
    await generation;
    await route.fulfill({contentType:'image/png',body:fs.readFileSync('public/references/doodle-reference-kiss.png')});
  });
  await page.goto('/?runtime=play');
  const nav = page.locator('.app-bottom-nav');
  await expect(nav).toBeVisible();
  await page.getByRole('textbox').fill('A little love note');
  await page.locator('.composer-footer > button').click();
  await expect(page.locator('.doodle-workspace-generating')).toBeVisible();
  await nav.getByRole('button', {name:'Ideas', exact:true}).click();
  await page.evaluate(() => window.scrollTo(0, 400));
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(0);
  finish();
  await expect(page.locator('.doodle-workspace-ready')).toBeAttached();
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  await nav.getByRole('button', {name:'Create', exact:true}).click();
  await expect(page.locator('.doodle-workspace-ready')).toBeVisible();
  const result = await page.locator('.doodle-stage-result img').getAttribute('src');
  await nav.getByRole('button', {name:'Settings', exact:true}).click();
  await nav.getByRole('button', {name:'Create', exact:true}).click();
  await expect(page.locator('.doodle-stage-result img')).toHaveAttribute('src',result!);
});

test('installed Arabic shell fits 320px and preserves RTL navigation', async ({ page }) => {
  await page.setViewportSize({width:320,height:700});
  await page.route('**/api/account', route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
  await page.goto('/ar?runtime=play');
  await expect(page.locator('html')).toHaveAttribute('dir','rtl');
  const nav = page.locator('.app-bottom-nav');
  await expect(nav).toBeVisible();
  for (let index=0;index<3;index++) {
    await nav.locator('button').nth(index).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(nav).toBeInViewport();
    await page.screenshot({path:`test-results/polish-app-ar-${index}.png`});
  }
});
