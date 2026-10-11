import { buildDaily } from '../src/game/daily'
const found: Record<number, string> = {}
for (let d = 0; d < 40 && Object.keys(found).length < 4; d++) {
  const day = new Date(Date.UTC(2026, 9, 12 + d)).toISOString().slice(0, 10)
  const c = buildDaily(day, { candidates: 1, simsPerCandidate: 1 })
  if (!found[c.gen]) found[c.gen] = day + ' ' + c.trainer.name
}
console.log(found)
