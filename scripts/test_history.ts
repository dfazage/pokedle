import { computeStats, type DayRecord } from '../src/game/history'
const r = (d: string, w: boolean): DayRecord => ({ dayKey: d, trainer: 'x', gen: 3, result: w ? 'win' : 'loss', turns: 10 })
const h = [r('2026-10-08', true), r('2026-10-09', true), r('2026-10-10', true), r('2026-10-11', false), r('2026-10-12', true)]
console.log(computeStats(h, '2026-10-12'))   // attendu: total 4, current 1, best 3
console.log(computeStats(h.slice(0, 3), '2026-10-12')) // jour non joué: série en cours 3 (depuis hier=11? non: 11 absent) -> 0
console.log(computeStats(h.slice(0, 3), '2026-10-11')) // attendu current 3
