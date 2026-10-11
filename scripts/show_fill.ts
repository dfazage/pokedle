import { buildDaily } from '../src/game/daily'
for (const d of ['2026-10-12', '2026-10-13', '2026-10-18', '2026-10-21']) {
  const c = buildDaily(d, { candidates: 1, simsPerCandidate: 1 })
  console.log(d, 'gen' + c.gen, c.trainer.name, '→', c.opponentTeam.map((m) => m.species).join(', '))
}
