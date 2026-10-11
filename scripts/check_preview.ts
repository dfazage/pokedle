import { buildDaily } from '../src/game/daily'
import { BattleSession } from '../src/game/session'
let bad = 0, n = 0
for (const d of ['2026-10-12', '2026-10-21', '2026-10-13', '2026-10-18']) {
  const c = buildDaily(d, { candidates: 1, simsPerCandidate: 1 })
  const s = new BattleSession(c)
  const team = s.view().player.team
  for (const mon of team) {
    const pv = c.playerPreview.find((p) => p.species === mon.name)!
    n++; if (pv.stats.hp !== mon.maxhp) { bad++; console.log('ÉCART PV', 'gen' + c.gen, mon.name, 'calcul', pv.stats.hp, 'moteur', mon.maxhp) }
  }
}
console.log(`PV vérifiés: ${n - bad}/${n} identiques au moteur`)
