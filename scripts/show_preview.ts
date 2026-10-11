import { buildDaily } from '../src/game/daily'
for (const d of ['2026-10-12', '2026-10-18']) {
  const c = buildDaily(d, { candidates: 1, simsPerCandidate: 1 })
  const m = c.playerPreview[0]
  console.log(d, 'gen' + c.gen, m.species, m.types.join('/'), JSON.stringify(m.stats), m.moves.map((x) => x.name).join(','))
}
