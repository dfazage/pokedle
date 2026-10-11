import { buildDaily } from '../src/game/daily'
import { BattleSession, formatLog } from '../src/game/session'
let wins = 0, stalls = 0
for (const day of ['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']) {
  const s = new BattleSession(buildDaily(day, { candidates: 3, simsPerCandidate: 2 }))
  let steps = 0
  while (!s.view().ended && steps++ < 300) {
    const v = s.view()
    if (v.request === 'move') s.choose('move ' + (v.player.moves.find(m => !m.disabled)?.slot ?? 1))
    else if (v.request === 'switch') s.choose('switch ' + (v.player.team.find(t => !t.fainted && !t.active)!.idx + 1))
    else { stalls++; break }
  }
  const v = s.view()
  if (v.result === 'win') wins++
  console.log(day, s.challenge.trainer.name, 'résultat:', v.result, 'tours:', v.turn, 'étapes:', steps)
}
const s2 = new BattleSession(buildDaily('2026-10-12', { candidates: 1, simsPerCandidate: 1 }))
s2.choose('move 1'); console.log(formatLog(s2.battle.log).slice(0, 10).map((x) => x.text).join('\n'))
console.log('stalls:', stalls)
