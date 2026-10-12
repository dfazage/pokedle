// Parcours des cœurs dans Chromium (nécessite `npm run preview`) : node scripts/e2e_hearts.mjs <dossier de captures>
import { chromium } from 'playwright-core';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'fr-FR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${out}/h-${n}.png`, fullPage: true });
const hearts = async () => page.locator('.card .px-hearts').first().getAttribute('aria-label');
await page.goto('http://localhost:4173/');
await page.click('text=Passer');
await page.waitForSelector('text=Combat du Jour', { timeout: 60000 }); await page.waitForTimeout(300);
console.log('accueil, cœurs:', await hearts()); await shot('1-accueil');
async function playOne(first) {
  if (first) { await page.click('text=Lancer le combat'); await page.waitForSelector('text=Escouade ennemie'); await page.click('text=Engager le combat'); }
  await page.waitForSelector('text=Glisser pour confirmer');
  const knob = page.locator('.slide .knob'); const box = await knob.boundingBox(); const track = await page.locator('.slide').boundingBox();
  await page.mouse.move(box.x + 27, box.y + 27); await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 27, { steps: 5 }); await page.mouse.move(track.x + track.width - 20, box.y + 27, { steps: 8 }); await page.mouse.up();
  await page.waitForSelector('.nds', { timeout: 30000 });
  for (let i = 0; i < 1500; i++) {
    if (await page.locator('text=Voir mon résultat').count()) break;
    const fight = page.locator('.tbtn.fight:not([disabled])');
    const move = page.locator('.tbtn.move:not([disabled])');
    const mon = page.locator('.tbtn.mon:not([disabled])');
    if (await fight.count()) { await fight.click(); await page.waitForTimeout(30); continue; }
    if (await move.count()) { await move.first().click(); await move.first().click(); await page.waitForTimeout(30); continue; }
    if (await mon.count()) { await mon.first().click(); await page.waitForTimeout(30); continue; }
    await page.locator('.textbox').click({ force: true }).catch(() => {}); await page.waitForTimeout(40);
  }
  await page.click('text=Voir mon résultat');
  await page.waitForSelector('text=Partager mon résultat'); await page.waitForTimeout(300);
}
await playOne(true);
let n = 1;
for (;;) {
  const res = await page.locator('.big-result').innerText();
  console.log(`essai ${n} →`, res, '| cœurs:', await hearts());
  await shot(`2-resultat-essai${n}`);
  if (res.toLowerCase().includes('victoire')) { await page.waitForTimeout(1100); await shot(`3-victoire-essai${n}`); break; }
  const replay = page.locator('button:has-text("Rejouer")');
  if (!(await replay.count())) { console.log('plus de rejeu possible'); break; }
  await replay.click(); await page.waitForTimeout(400); await shot(`2b-eclat-essai${n}`);
  await page.waitForSelector('text=Glisser pour confirmer'); n++;
  await playOne(false);
}
await page.reload(); await page.waitForSelector('text=Combat du Jour', { timeout: 60000 });
console.log('après rechargement, cœurs:', await hearts(), '| bouton:', await page.locator('.hero .cta').innerText());
await page.click('.nav button[aria-label="Historique"]'); await page.waitForTimeout(300);
await page.locator('.hist-card').first().click(); await page.waitForTimeout(300); await shot('4-historique-detail');
console.log('erreurs:', errors.length ? errors : 'aucune');
await browser.close();
