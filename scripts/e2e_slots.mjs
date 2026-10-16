// Parcours « deux combats par jour » dans Chromium avec un faux serveur Supabase (nécessite un build avec
// VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_KEY=x puis `npm run preview`) : node scripts/e2e_slots.mjs <dossier de captures>
import { chromium } from 'playwright-core';
const out = process.argv[2] ?? '.';
const SB = 'http://localhost:54321';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', aud: 'authenticated', role: 'authenticated', exp: 1893456000 })}.sig`;
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 't@test.dev', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
const session = { access_token: jwt, refresh_token: 'r', expires_at: 1893456000, expires_in: 99999, token_type: 'bearer', user };
const rows = []; // faux table `results`
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Asia/Kuala_Lumpur' });
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
await ctx.route(`${SB}/**`, async (route) => {
  const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const m = req.method();
  const ok = (body, status = 200) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (p === '/auth/v1/user') return ok(user);
  if (p === '/auth/v1/token') return ok(session);
  if (p === '/rest/v1/profiles') {
    const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
    return m === 'GET' ? ok(single ? { username: 'Tester', avatar: null } : [{ username: 'Tester', avatar: null }]) : route.fulfill({ status: 204, headers: cors });
  }
  if (p === '/rest/v1/results') {
    if (m === 'GET') return ok([...rows].sort((a, b) => a.day_key.localeCompare(b.day_key) || a.slot - b.slot));
    const body = JSON.parse(req.postData() ?? '{}');
    if (m === 'POST') {
      if (rows.some((r) => r.day_key === body.day_key && r.slot === body.slot)) return ok({ code: '23505', message: 'duplicate' }, 409);
      rows.push(body); return route.fulfill({ status: 201, headers: cors, body: '' });
    }
    if (m === 'PATCH') {
      const day = url.searchParams.get('day_key')?.replace('eq.', ''); const slot = Number(url.searchParams.get('slot')?.replace('eq.', '') ?? 1);
      const hit = rows.filter((r) => r.day_key === day && r.slot === slot && r.result === 'loss'); hit.forEach((r) => Object.assign(r, body));
      return ok(hit.map((r) => ({ day_key: r.day_key })));
    }
  }
  if (p.startsWith('/rest/v1/rpc/')) {
    const fn = p.split('/').pop();
    if (fn === 'daily_salt' || fn === 'daily_reset_n') return ok(0);
    if (fn === 'daily_stats_v2') return ok([{ players: 10, wins: 7 }]);
    if (fn === 'is_admin') return ok(false);
    return ok([]);
  }
  return ok([]);
});
await ctx.addInitScript((s) => { try { localStorage.setItem('pokedle:lang', 'fr'); if (!localStorage.getItem('sb-localhost-auth-token')) localStorage.setItem('sb-localhost-auth-token', JSON.stringify(s)); } catch {} }, session);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errors.push('console: ' + m.text()); });
const shot = (n) => page.screenshot({ path: `${out}/s-${n}.png`, fullPage: true });
const must = async (label, cond) => { console.log(cond ? 'ok  ' : 'ÉCHEC', label); if (!cond) process.exitCode = 1; };
const has = async (txt) => (await page.locator(`text=${txt}`).count()) > 0;

async function playBattle() {
  await page.click('.cta');
  await page.waitForSelector('text=Engager le combat', { timeout: 20000 }); await page.click('text=Engager le combat');
  await page.waitForSelector('text=Glisser pour confirmer');
  const knob = page.locator('.slide .knob'); const box = await knob.boundingBox(); const track = await page.locator('.slide').boundingBox();
  await page.mouse.move(box.x + 27, box.y + 27); await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + 27, { steps: 5 }); await page.mouse.move(track.x + track.width - 20, box.y + 27, { steps: 8 }); await page.mouse.up();
  await page.waitForSelector('text=Lancer le combat', { timeout: 5000 }).then(() => page.click('text=Lancer le combat')).catch(() => {});
  await page.waitForSelector('.nds', { timeout: 30000 });
  for (let i = 0; i < 2500; i++) {
    if (await page.locator('text=Voir mon résultat').count()) break;
    const fight = page.locator('.tbtn.fight:not([disabled])'); const move = page.locator('.tbtn.move:not([disabled])'); const mon = page.locator('.tbtn.mon:not([disabled])');
    if (await fight.count()) { await fight.click(); await page.waitForTimeout(30); continue; }
    if (await move.count()) { await move.first().click(); await move.first().click(); await page.waitForTimeout(30); continue; }
    if (await mon.count()) { await mon.first().click(); await page.waitForTimeout(30); continue; }
    await page.locator('.textbox').click({ force: true }).catch(() => {}); await page.waitForTimeout(40);
  }
  await page.click('text=Voir mon résultat');
  await page.waitForSelector('text=Partager mon résultat'); await page.waitForTimeout(300);
}

// 1) 17/10 à 13h KL (05:00Z) : jour n°1 à deux combats, seul le 1/2 est publié
await page.clock.setFixedTime(new Date('2026-10-17T05:00:00Z'));
await page.goto('http://localhost:4173/');
await page.waitForSelector('.cta', { timeout: 90000 }); await page.waitForTimeout(500);
await must('accueil : Combat 1/2', await has('Combat 1/2'));
await shot('1-accueil-1');
await page.waitForTimeout(3000);
await must('annonce « 2 combats par jour » affichée', await has('2 combats par jour dès le'));
await shot('2-annonce');
await page.click('text=Compris'); await page.waitForTimeout(300);
await playBattle();
const r1 = await page.locator('.big-result').innerText();
await must('résultat du combat 1/2 (pastille)', (await page.locator('.pill', { hasText: 'Combat 1/2' }).count()) > 0);
await must('bouton vers le combat 2/2', await has('Continuer vers le combat 2/2'));
await shot('3-resultat-1');
await page.click('text=Continuer vers le combat 2/2');
await page.waitForTimeout(2500);
// 2) Combat 2/2 pas encore publié : écran verrouillé
await page.waitForSelector('text=Prochain dresseur à 18h', { timeout: 60000 });
await must('accueil verrouillé : Combat 2/2', await has('Combat 2/2'));
await must('rappel du combat 1/2 terminé', await has('Combat 1/2 terminé'));
await shot('4-accueil-verrou');
await page.click('text=Voir le résultat du combat 1/2');
await page.waitForSelector('text=Partager mon résultat');
await must('revoir le résultat du 1/2', (await page.locator('.big-result').innerText()) === r1);
// 3) 19h KL (11:00Z) : le combat 2/2 est publié
await page.clock.setFixedTime(new Date('2026-10-17T11:00:00Z'));
await page.reload();
await page.waitForSelector('.cta', { timeout: 90000 }); await page.waitForTimeout(500);
await must('accueil : Combat 2/2 jouable', (await has('Combat 2/2')) && !(await has('Prochain dresseur à 18h')));
await shot('5-accueil-2');
await playBattle();
await must('résultat du combat 2/2 (pastille)', (await page.locator('.pill', { hasText: 'Combat 2/2' }).count()) > 0);
await shot('6-resultat-2');
console.log('lignes enregistrées:', rows.map((r) => `${r.day_key}#${r.slot}:${r.result}`).join(', '));
await must('deux résultats enregistrés (slots 1 et 2)', rows.length === 2 && rows[0].slot === 1 && rows[1].slot === 2 && rows[0].day_key === '2026-10-18');
// 4) Historique
await page.click('text=Historique').catch(() => {}); await page.waitForTimeout(500);
await shot('7-historique');
await must('historique : combat 2 listé', await has('Combat 2'));
console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'aucune erreur console');
if (errors.length) process.exitCode = 1;
await browser.close();
