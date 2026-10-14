// Équilibrage et cohérence des défis joués avec le moteur gen 5 (à partir de GEN5_FROM) : npx tsx scripts/test_gen5_balance.ts [jours]
import { buildDaily, GEN5_FROM } from '../src/game/daily'
const n = Number(process.argv[2] ?? 30)
const start = Date.parse(GEN5_FROM + 'T00:00:00Z')
const rates: number[] = []
let g5 = 0
for (let d = 0; d < n; d++) {
  const day = new Date(start + d * 86400000).toISOString().slice(0, 10)
  const c = buildDaily(day)
  rates.push(c.estimatedWinRate)
  if (c.gen === 5) {
    g5++
    console.log(day, `gen${c.gen}`, c.trainer.name, c.trainer.stage ?? '', '| winrate≈', c.estimatedWinRate.toFixed(2),
      '| adversaire:', c.opponentTeam.map((s) => `${s.species}@${s.item || '-'}/${s.ability}`).join(', '))
  }
  if (c.battleGen !== 5) console.log('MOTEUR INATTENDU', day, c.battleGen)
}
const ok = rates.filter((r) => r >= 0.35 && r <= 0.65).length
console.log(`${n} jours, dont ${g5} avec un dresseur gen 5 ; winrate dans la cible 35–65 % : ${ok}/${n} ; moyenne ${(rates.reduce((a, b) => a + b, 0) / n).toFixed(2)}`)
