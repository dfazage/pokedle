// Calibrage de l'IA et de l'équilibrage.
//   npx tsx scripts/calib_ai.ts old [n]          : taux du « joueur de référence » (IA niveau 2) contre l'IA d'origine, sur les défis déjà joués,
//                                                  à comparer aux taux réels du tableau de bord (validation du joueur de référence).
//   npx tsx scripts/calib_ai.ts new [jours] [n]  : défis recalibrés (≥ HARD_FROM), les deux combats de chaque jour : taux estimé par buildDaily
//                                                  et taux mesuré indépendamment (autres graines), niveau 2 contre niveau 2.
import { Battle, Teams } from '@pkmn/sim'
import { buildDaily, battleFormat, HARD_FROM } from '../src/game/daily'
import { aiChoose, type AiLevel } from '../src/game/ai'
import { addDays, seedArray, slotsPerDay } from '../src/game/rng'

function run(c: ReturnType<typeof buildDaily>, l1: AiLevel, l2: AiLevel, seed: number) {
  const b = new Battle({
    formatid: battleFormat(c.battleGen) as any,
    seed: seedArray(seed) as any,
    p1: { name: 'A', team: Teams.pack(c.playerTeam) as any },
    p2: { name: 'B', team: Teams.pack(c.opponentTeam) as any },
  } as any)
  let g = 0
  while (!b.ended && g++ < 400) b.makeChoices(aiChoose(b, 0, c.battleGen, l1), aiChoose(b, 1, c.battleGen, l2))
  return b.winner === 'A' ? 1 : 0
}
const rate = (c: ReturnType<typeof buildDaily>, l1: AiLevel, l2: AiLevel, n: number) => {
  let w = 0
  for (let i = 0; i < n; i++) w += run(c, l1, l2, 987654 + i * 104729)
  return Math.round((100 * w) / n)
}

const mode = process.argv[2] ?? 'new'
if (mode === 'old') {
  const n = Number(process.argv[3] ?? 100)
  const real: Record<string, number> = { '2026-10-13': 80.9, '2026-10-14': 87.7, '2026-10-15': 93.2, '2026-10-16': 89.0, '2026-10-17': 97.4 }
  console.log('jour        dresseur   réel%   IA1 vs IA1   IA2 vs IA1 (joueur de référence)')
  for (const day of Object.keys(real)) {
    const c = buildDaily(day)
    console.log(day, c.trainer.name.padEnd(10), String(real[day]).padStart(5), String(rate(c, 1, 1, n)).padStart(8), String(rate(c, 2, 1, n)).padStart(14))
  }
} else {
  const days = Number(process.argv[3] ?? 10)
  const n = Number(process.argv[4] ?? 60)
  const est: number[] = []
  const meas: number[] = []
  console.log('jour        n°  dresseur   estimé  mesuré  (ms)')
  for (let d = 0; d < days; d++) {
    const day = addDays(HARD_FROM, d)
    for (let slot = 1; slot <= slotsPerDay(day); slot++) {
      const t0 = Date.now()
      const c = buildDaily(day, { slot })
      const ms = Date.now() - t0
      const m = rate(c, 2, 2, n)
      est.push(c.estimatedWinRate * 100)
      meas.push(m)
      console.log(day, slot, c.trainer.name.padEnd(10), String(Math.round(c.estimatedWinRate * 100)).padStart(5), String(m).padStart(7), String(ms).padStart(6))
    }
  }
  const avg = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)
  const sd = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length).toFixed(1) }
  console.log(`moyenne estimé ${avg(est)} (σ ${sd(est)}) · mesuré ${avg(meas)} (σ ${sd(meas)}) · min ${Math.min(...meas)} max ${Math.max(...meas)}`)
}
