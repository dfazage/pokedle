import { buildDaily } from '../src/game/daily'
import { BattleSession } from '../src/game/session'
const seen = new Map<number, number>(); let stalls = 0, wins = 0, total = 0
const t0 = Date.now()
for (let d = 0; d < 24; d++) {
  const day = new Date(Date.UTC(2026, 9, 12 + d)).toISOString().slice(0, 10)
  const c = buildDaily(day, { candidates: 4, simsPerCandidate: 3 })
  seen.set(c.gen, (seen.get(c.gen) ?? 0) + 1)
  if (c.playerTeam.length !== 6 || c.opponentTeam.length !== 6) console.log('ÉQUIPE INCOMPLÈTE', day, c.playerTeam.length, c.opponentTeam.length)
  const s = new BattleSession(c)
  let steps = 0
  while (!s.view().ended && steps++ < 400) {
    const v = s.view()
    if (v.request === 'move') s.choose('move ' + (v.player.moves.find((m) => !m.disabled)?.slot ?? 1))
    else if (v.request === 'switch') s.choose('switch ' + (v.player.team.find((t) => !t.fainted && !t.active)!.idx + 1))
    else { stalls++; console.log('BLOCAGE', day, c.gen, c.trainer.name); break }
  }
  total++; if (s.view().result === 'win') wins++
  if (!s.view().ended) console.log('PAS FINI', day, c.gen, c.trainer.name)
}
console.log('gens vues:', [...seen.entries()].sort().map(([g, n]) => `gen${g}×${n}`).join(' '), '| blocages:', stalls, '| victoires (1er coup dispo):', wins + '/' + total, '|', ((Date.now() - t0) / 1000).toFixed(0) + 's')
