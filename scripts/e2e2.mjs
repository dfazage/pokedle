import { chromium } from 'playwright-core';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${out}/s-${n}.png` });
await page.goto('http://localhost:4173/');
await page.waitForSelector('text=Passer'); await shot('1-onboarding');
await page.click('text=Passer');
await page.waitForSelector('text=Combat du Jour', { timeout: 60000 }); await page.waitForTimeout(300); await shot('2-accueil');
await page.click('text=Lancer le combat');
await page.waitForSelector('text=Escouade ennemie'); await shot('3-adversaire');
await page.click('text=Engager le combat');
await page.waitForSelector('text=Glisser pour confirmer'); await shot('4-equipe');
const knob = page.locator('.slide .knob'); const box = await knob.boundingBox(); const track = await page.locator('.slide').boundingBox();
await page.mouse.move(box.x + 27, box.y + 27); await page.mouse.down();
await page.mouse.move(box.x + 120, box.y + 27, { steps: 5 }); await page.mouse.move(track.x + track.width - 20, box.y + 27, { steps: 8 }); await page.mouse.up();
await page.waitForSelector('.gba');
async function advance() { for (let i = 0; i < 80 && !(await page.locator('.menu').count()) && !(await page.locator('text=Voir mon résultat').count()); i++) { await page.locator('.gba').click(); await page.waitForTimeout(40); } }
await advance(); await shot('5-combat');
for (let i = 0; i < 400; i++) {
  await advance();
  if (await page.locator('text=Voir mon résultat').count()) break;
  if (await page.locator('.menu button:has-text("COMBAT")').count()) await page.click('.menu button:has-text("COMBAT")');
  await page.locator('.menu button:not([disabled]):not(.back-btn)').first().click();
}
await page.click('text=Voir mon résultat');
await page.waitForSelector('text=Partager mon résultat'); await page.waitForTimeout(200); await shot('6-resultat');
console.log('résultat:', await page.locator('.big-result').innerText());
await page.reload(); await page.waitForSelector('text=Combat du Jour', { timeout: 60000 });
console.log('après rechargement, bouton:', await page.locator('.hero .cta').innerText());
await shot('7-accueil-apres');
for (const [label, name] of [['Historique', 'history'], ['Classement', 'leaderboard'], ['Profil', 'settings']]) { await page.click(`.nav button[aria-label="${label}"]`); await page.waitForTimeout(250); await shot('8-' + name); }
await page.click('text=Générations & versions'); await page.waitForSelector('text=Pokémon Rouge'); await shot('9-generations');
console.log('erreurs:', errors.length ? errors : 'aucune');
await browser.close();
