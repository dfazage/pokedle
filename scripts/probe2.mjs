import { Dex } from '@pkmn/dex';
const d = Dex.forGen(1);
const ls = await d.learnsets.get('onix');
console.log(Object.keys(ls.learnset).length, 'moves; ex:', Object.entries(ls.learnset).slice(0,4));
console.log(d.moves.get('earthquake').basePower, d.moves.get('earthquake').exists, d.moves.get('crunch').exists);
