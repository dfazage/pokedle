import { buildDaily } from '../src/game/daily'
for (const d of ['2026-10-12', '2026-10-13', '2026-10-14']) {
  const t0 = Date.now()
  const c = buildDaily(d)
  const again = buildDaily(d)
  const same = JSON.stringify(c.playerTeam) === JSON.stringify(again.playerTeam) && c.trainer.id === again.trainer.id
  console.log(d, 'gen', c.gen, c.trainer.name, '| équipe:', c.playerTeam.map((s) => s.species).join(', '),
    '| winrate≈', c.estimatedWinRate.toFixed(2), '| déterministe:', same, '|', Date.now() - t0, 'ms (x2)')
}
