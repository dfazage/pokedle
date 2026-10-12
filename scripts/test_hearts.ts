// Tests rapides du système de cœurs : npx tsx scripts/test_hearts.ts
import { heartsAfter, heartsInfo } from '../src/game/hearts'
import type { DayRecord } from '../src/game/history'
const r = (d: string, win: boolean, attempts?: number): DayRecord => ({ dayKey: d, trainer: 'x', gen: 3, result: win ? 'win' : 'loss', turns: 10, attempts })
let fails = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
const T = '2026-10-12'
eq('nouveau joueur = 3 cœurs', heartsAfter([]), 3)
eq('défaite sans rejeu : rien perdu', heartsAfter([r('2026-10-10', false)]), 3)
eq('2 rejeux puis défaite : 1 cœur', heartsAfter([r('2026-10-10', false, 3)]), 1)
eq('3 rejeux puis défaite : 0 cœur', heartsAfter([r('2026-10-10', false, 4)]), 0)
eq('rejeu puis victoire : neutre', heartsAfter([r('2026-10-10', true, 2)]), 3)
eq('0 cœur puis victoire du 1er essai : 1', heartsAfter([r('2026-10-09', false, 4), r('2026-10-10', true)]), 1)
eq('plafond à 3', heartsAfter([r('2026-10-09', true), r('2026-10-10', true)]), 3)
// aujourd'hui
let i = heartsInfo([], T, 0)
eq('avant le combat', [i.count, i.attempt, i.canReplay, i.replayPending], [3, 0, false, false])
i = heartsInfo([], T, 1)
eq('1er essai en cours (gratuit)', [i.count, i.attempt, i.canReplay], [3, 1, false])
i = heartsInfo([r(T, false, 1)], T, 1)
eq('défaite essai 1 : rejeu possible', [i.count, i.canReplay, i.replayPending, i.gained], [3, true, false, false])
i = heartsInfo([r(T, false, 1)], T, 2)
eq('rejeu payé, en cours', [i.count, i.canReplay, i.replayPending], [2, false, true])
i = heartsInfo([r(T, true, 2)], T, 2)
eq('victoire à l\'essai 2 : neutre', [i.count, i.gained], [3, true])
i = heartsInfo([r('2026-10-11', false, 4), r(T, false, 1)], T, 1)
eq('0 cœur hier : essai offert, pas de rejeu', [i.count, i.canReplay], [0, false])
i = heartsInfo([r('2026-10-11', false, 4), r(T, true, 1)], T, 1)
eq('0 cœur hier + victoire : 1 cœur gagné', [i.count, i.gained], [1, true])
i = heartsInfo([r('2026-10-11', true), r(T, true, 1)], T, 1)
eq('réserve pleine : pas de gain', [i.count, i.gained], [3, false])
i = heartsInfo([r(T, false, 3)], T, 3)
eq('3e essai perdu avec 1 cœur : 1 cœur restant', [i.count, i.canReplay], [1, true])
i = heartsInfo([r(T, false, 4)], T, 4)
eq('4e essai perdu : 0 cœur', [i.count, i.canReplay], [0, false])
console.log(fails ? `${fails} échec(s)` : 'tous les tests passent')
process.exit(fails ? 1 : 0)
