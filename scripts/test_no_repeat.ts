// Vérifie qu'aucun dresseur n'est tiré deux jours de suite à partir de NO_REPEAT_FROM : npx tsx scripts/test_no_repeat.ts [jours]
import { dailyTrainerName, NO_REPEAT_FROM } from '../src/game/daily'
import { addDays } from '../src/game/rng'
const n = Number(process.argv[2] ?? 365)
let bad = 0
let prev = dailyTrainerName(addDays(NO_REPEAT_FROM, -1))
for (let i = 0; i < n; i++) {
  const day = addDays(NO_REPEAT_FROM, i)
  const name = dailyTrainerName(day)
  if (i < 17) console.log(day, name)
  if (name === prev) { bad++; console.log('DOUBLON', day, name) }
  prev = name
}
console.log(`${n} jours depuis ${NO_REPEAT_FROM} : ${bad} doublon(s) consécutif(s)`)
