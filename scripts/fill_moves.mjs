// Valide les données de dresseurs et génère des attaques cohérentes quand l'original n'en a pas (gens 1 et 2).
import { Dex } from '@pkmn/dex';
import fs from 'node:fs';

const BAD = new Set(['explosion','selfdestruct','hyperbeam','dreameater','fissure','horndrill','guillotine','counter','bide','focuspunch','skullbash','skyattack','razorwind','solarbeam','megakick','struggle','rage','metronome','mirrormove','transform','splash','sleeptalk','snore','nightmare','present','magnitude','psywave','superfang','seismictoss','nightshade','dragonrage','sonicboom','flail','reversal','rollout','furycutter','spitup','return','frustration']);
const UTILITY = ['recover','softboiled','rest','thunderwave','toxic','swordsdance','amnesia','agility','reflect','lightscreen','sleeppowder','hypnosis','spore','sing','stunspore','substitute','curse','calmmind','bulkup'];

async function autoMoves(dex, gen, speciesId) {
  const sp = dex.species.get(speciesId);
  const ls = await dex.learnsets.get(sp.id);
  const learnable = new Set(Object.entries(ls?.learnset ?? {}).filter(([, src]) => src.some(s => Number(s[0]) <= gen)).map(([m]) => m));
  const all = [...learnable].map(id => dex.moves.get(id)).filter(m => m.exists && m.gen <= gen && !BAD.has(m.id));
  const dmg = all.filter(m => m.category !== 'Status' && m.basePower > 0)
    .map(m => {
      const stab = sp.types.includes(m.type) ? 1.5 : 1;
      const physSpecialFit = gen >= 4 ? (m.category === 'Physical' ? sp.baseStats.atk : sp.baseStats.spa) / 100 : 1;
      return { m, score: m.basePower * (m.accuracy === true ? 1 : m.accuracy / 100) * stab * physSpecialFit };
    }).sort((a, b) => b.score - a.score);
  const picked = [];
  const types = new Set();
  for (const { m } of dmg) { if (picked.length >= 3) break; if (!types.has(m.type)) { picked.push(m.id); types.add(m.type); } }
  for (const { m } of dmg) { if (picked.length >= 4) break; if (!picked.includes(m.id)) picked.push(m.id); }
  if (picked.length < 4) for (const u of UTILITY) { if (picked.length >= 4) break; if (learnable.has(u) && dex.moves.get(u).gen <= gen) picked.push(u); }
  return picked.slice(0, 4);
}

let problems = 0;
for (const gen of [1, 2, 3, 4]) {
  const file = `src/data/trainers.gen${gen}.json`;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const dex = Dex.forGen(gen);
  let filled = 0;
  for (const t of data) for (const m of t.team) {
    const sp = dex.species.get(m.species);
    if (!sp.exists || sp.gen > gen) { console.log(`gen${gen} ESPECE`, t.name, m.species); problems++; continue; }
    m.moves = m.moves.filter(mv => { const ok = dex.moves.get(mv).exists && dex.moves.get(mv).gen <= gen; if (!ok) { console.log(`gen${gen} MOVE`, t.name, m.species, mv); problems++; } return ok; });
    if (m.item && !(dex.items.get(m.item).exists)) { console.log(`gen${gen} ITEM`, t.name, m.species, m.item, '-> retiré'); m.item = null; }
    if (m.moves.length === 0) { m.moves = await autoMoves(dex, gen, m.species); filled++; m.autoMoves = true; }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
  console.log(`gen${gen}: ${data.length} dresseurs, attaques générées pour ${filled} Pokémon`);
}
console.log(problems ? `${problems} problème(s)` : 'OK : tout est valide');
const demo = JSON.parse(fs.readFileSync('src/data/trainers.gen1.json', 'utf8'));
for (const n of ['Brock', 'Lance']) { const t = demo.find(x => x.name === n); console.log(n, t.team.map(m => `${m.species}: ${m.moves.join('/')}`).join(' | ')); }
