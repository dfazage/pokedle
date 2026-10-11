import fs from 'node:fs';
import { Dex } from '@pkmn/dex';
const fr = JSON.parse(fs.readFileSync('src/data/names.fr.json', 'utf8'));
const missS = new Set(), missM = new Set();
for (const s of Dex.species.all()) if (s.num > 0 && s.num <= 493 && !s.forme && !fr.species[s.id]) missS.add(s.id);
for (const m of Dex.moves.all()) if (m.num > 0 && m.num <= 467 && !fr.moves[m.id]) missM.add(m.id);
console.log('espèces sans nom FR:', [...missS].join(', ') || 'aucune');
console.log('attaques sans nom FR:', [...missM].join(', ') || 'aucune');
console.log(fr.species.charizard, '|', fr.species.mrmime, '|', fr.moves.flamethrower, '|', fr.moves.psychic, '|', fr.moves.hiddenpower, '|', fr.moves.faintattack);
