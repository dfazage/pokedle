import { Dex } from '@pkmn/dex';
import fs from 'node:fs';
const gen = Dex.forGen(3);
const data = JSON.parse(fs.readFileSync('src/data/trainers.gen3.json','utf8'));
let bad = 0;
for (const t of data) for (const m of t.team) {
  if (!gen.species.get(m.species).exists) { console.log('SPECIES', t.name, m.species); bad++; }
  for (const mv of m.moves) if (!gen.moves.get(mv).exists) { console.log('MOVE', t.name, m.species, mv); bad++; }
  if (m.item && !gen.items.get(m.item).exists) { console.log('ITEM', t.name, m.species, m.item); bad++; }
}
console.log(bad ? `${bad} problème(s)` : 'OK: tout est valide en gen 3');
