import { Battle, Teams } from '@pkmn/sim';
import { TeamGenerators } from '@pkmn/randoms';
Teams.setGeneratorFactory(TeamGenerators);
const gen = Teams.getGenerator('gen3randombattle', [1,2,3,4]);
const t1 = gen.getTeam(); const t2 = gen.getTeam();
console.log(t1.length, t1[0].species, t1[0].level, t1[0].moves);
const b = new Battle({ formatid: 'gen3customgame', seed: [1,2,3,4],
  p1:{name:'A', team: Teams.pack(t1.map(s=>({...s, level:100})))}, p2:{name:'B', team: Teams.pack(t2.map(s=>({...s, level:100})))} });
console.log(Object.keys(b).includes('makeChoices'), typeof b.makeChoices, typeof b.sides[0].getRequestData);
let turns=0;
while(!b.ended && turns<300){ b.makeChoices('default','default'); turns++; }
console.log('ended', b.ended, 'winner', b.winner, 'turns', b.turn);
const r = b.sides[0].activeRequest; console.log(r && Object.keys(r));
