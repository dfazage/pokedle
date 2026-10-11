import { chromium } from 'playwright-core';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Lancer le combat', { timeout: 60000 });
await page.click('text=Lancer le combat');
await page.waitForSelector('.gba');
// avance le texte jusqu'à l'apparition du menu ou de la fin
async function step() {
  if (await page.locator('.textbox .more, .textbox:has(span)').count() && await page.locator('.menu').count() === 0) {
    await page.locator('.gba').click(); await page.waitForTimeout(60); return;
  }
}
async function playTurn() {
  for (let i = 0; i < 80 && !(await page.locator('.menu').count()) && !(await page.locator('text=Partager le résultat').count()); i++) await step();
  if (await page.locator('text=Partager le résultat').count()) return false;
  if (await page.locator('.menu button:has-text("COMBAT")').count()) {
    await page.click('.menu button:has-text("COMBAT")');
    await page.locator('.menu button:not([disabled]):not(.back-btn)').first().click();
  } else {
    await page.locator('.menu button:not([disabled]):not(.back-btn)').first().click();
  }
  return true;
}
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/g1-intro.png' });
for (let i = 0; i < 2; i++) await playTurn();
for (let i = 0; i < 80 && !(await page.locator('.menu').count()); i++) await step();
await page.screenshot({ path: out + '/g2-menu.png' });
await page.click('.menu button:has-text("COMBAT")');
await page.screenshot({ path: out + '/g3-attaques.png' });
await page.click('.menu .back-btn');
const turnBefore = await page.locator('.top .muted').innerText();
await page.reload();
await page.waitForSelector('text=Lancer le combat', { timeout: 60000 });
await page.click('text=Lancer le combat');
await page.waitForSelector('.menu');
console.log('reprise:', turnBefore, '->', await page.locator('.top .muted').innerText());
for (let i = 0; i < 400; i++) { if (!(await playTurn())) break; }
await page.waitForSelector('text=Partager le résultat', { timeout: 20000 });
console.log('résultat:', await page.locator('.win, .loss').first().innerText());
await page.screenshot({ path: out + '/g4-fin.png' });
console.log('erreurs:', errors.length ? errors : 'aucune');
await browser.close();
