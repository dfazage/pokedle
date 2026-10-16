// Vérifie qu'aucun dresseur n'est tiré deux combats de suite à partir de NO_REPEAT_FROM (n°1 et n°2 du jour compris) : npx tsx scripts/test_no_repeat.ts [jours]
import { dailyTrainerName, NO_REPEAT_FROM } from '../src/game/daily'
import { addDays, slotsPerDay } from '../src/game/rng'
const n = Number(process.argv[2] ?? 365)
let bad = 0
let prev = dailyTrainerName(addDays(NO_REPEAT_FROM, -1))
for (let i = 0; i < n; i++) {
  const day = addDays(NO_REPEAT_FROM, i)
  for (let slot = 1; slot <= slotsPerDay(day); slot++) {
    const name = dailyTrainerName(day, slot)
    if (i < 17) console.log(day, slot, name)
    if (name === prev) { bad++; console.log('DOUBLON', day, slot, name) }
    prev = name
  }
}
console.log(`${n} jours depuis ${NO_REPEAT_FROM} : ${bad} doublon(s) consécutif(s)`)
if (bad) process.exit(1)
