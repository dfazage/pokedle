import { chromium } from 'playwright-core';
const out = process.argv[2];
const days = { 1: '2026-10-12', 2: '2026-10-21', 4: '2026-10-18' };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
for (const [gen, day] of Object.entries(days)) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(`(() => { const RealDate = Date; const fixed = new RealDate('${day}T12:00:00Z').getTime();
    class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(fixed); else super(...a); } static now() { return fixed; } }
    window.Date = FakeDate; })()`);
  await page.goto('http://localhost:4173/');
  await page.waitForSelector('text=Lancer le combat', { timeout: 60000 });
  await page.screenshot({ path: `${out}/gen${gen}-accueil.png` });
  await page.click('text=Lancer le combat');
  await page.waitForSelector('.gba');
  for (let i = 0; i < 60 && !(await page.locator('.menu').count()); i++) { await page.locator('.gba').click(); await page.waitForTimeout(40); }
  await page.screenshot({ path: `${out}/gen${gen}-combat.png` });
  console.log('gen', gen, day, errors.length ? errors : 'ok');
  await ctx.close();
}
await browser.close();
