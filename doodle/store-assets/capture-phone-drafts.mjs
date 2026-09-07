// Browser UI drafts, not Android/Play-installed captures. No live generation or purchases.
// Run from repository root: node store-assets/capture-phone-drafts.mjs [http://localhost:3100]
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'phone-drafts');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] || 'http://localhost:3100/?runtime=play';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce' });
const page = await context.newPage();
let image = 'birthday-dog.webp';
await page.route('**/api/account', route => route.fulfill({ json: { authenticated: false, email: null, balance: 0, freeRemaining: 2 } }));
await page.route('**/api/generate', async route => route.fulfill({ status: 200, contentType: 'image/webp', headers: { 'X-Doodle-Free-Remaining': '1' }, body: await fs.readFile(path.join(root, 'public/ideas', image)) }));
const captures = [];
async function capture(file, title, detail) {
  // Next's development indicator is tooling, not shipped app UI.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); document.activeElement?.blur(); });
  await page.screenshot({ path: path.join(output, file), animations: 'disabled', omitBackground: false });
  captures.push({ file, title, detail });
}
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('textbox').fill('A happy dog holding a birthday balloon');
await capture('01-describe.png', 'Describe a little moment', 'Actual composer, prefilled scene; anonymous two-doodle allowance fixture.');
await page.getByRole('button', { name: 'Create doodle', exact: true }).click();
await page.getByAltText('Generated sticky-note doodle').waitFor();
await capture('02-birthday.png', 'A doodle for a birthday card', 'Actual result screen displaying the existing birthday-dog.webp example via intercepted generation response.');
await page.getByRole('navigation', { name: 'Doodle app' }).getByRole('button', { name: 'Ideas', exact: true }).click();
await capture('03-ideas.png', 'Find a small scene to draw', 'Actual installed-mode Ideas screen with the existing app example gallery.');
await page.getByRole('navigation', { name: 'Doodle app' }).getByRole('button', { name: 'Create', exact: true }).click();
await page.getByRole('button', { name: /View larger/ }).click();
await page.getByRole('dialog').waitFor();
await capture('04-detail.png', 'Take a closer look', 'Actual enlarged result dialog; same birthday example.');
await page.keyboard.press('Escape');
await page.getByRole('navigation', { name: 'Doodle app' }).getByRole('button', { name: 'Settings', exact: true }).click();
await capture('05-settings-preview.png', 'Settings · additional QA preview', 'Actual installed-mode Settings tab. Optional review asset beyond the four primary listing screenshots.');
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), origin: base, provenance: 'Chromium mobile browser rendering of the app at the recorded origin. Account and generation API responses intercepted. No Android OS frame or Play installation. Drawings are existing repository examples, not new generations. Final Android verification still required.', size: '1080x1920', captures }, null, 2));
await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Doodle phone screenshot drafts</title><style>body{margin:0;padding:32px;background:#f6f3eb;color:#30342e;font:16px system-ui}h1{font-size:28px}p{max-width:950px;line-height:1.5}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:20px}figure{margin:0}img{display:block;width:100%;border:1px solid #deddd4;border-radius:6px}figcaption{font-weight:600;margin:14px 0 8px}small{line-height:1.5;display:block;color:#596154}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><h1>Doodle · phone screenshot drafts</h1><p>Browser-rendered app UI at 1080 × 1920. Existing example drawings reproduced with local response fixtures. These have not been captured from the Android app or installed through Google Play.</p><div class="grid">${captures.map(c => `<figure><img src="${c.file}" alt="${c.title}"><figcaption>${c.title}</figcaption><small>${c.detail}</small></figure>`).join('')}</div></html>`);
await page.goto(`file://${path.join(output, 'index.html')}`);
await page.setViewportSize({ width: 1440, height: 1160 });
await page.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true, scale: 'css' });
await browser.close();
console.log(`Saved ${captures.length} browser drafts and contact sheet to ${output}`);
