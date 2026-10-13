import assert from 'node:assert/strict'
import { weekCells, nextDay, calendarWeek, isoWeek, mondayOf } from '../src/game/week'
import type { DayRecord } from '../src/game/history'
const r = (d: string, w: boolean): DayRecord => ({ dayKey: d, trainer: 'x', gen: 3, result: w ? 'win' : 'loss', turns: 10 })
const cells = weekCells([r('2026-10-11', false), r('2026-10-12', true), r('2026-10-13', true)], '2026-10-13')
assert.equal(cells.length, 7)
assert.deepEqual(cells.map((c) => c.dayKey), ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'])
assert.deepEqual(cells.map((c) => c.state), ['none', 'none', 'none', 'loss', 'win', 'win', 'tomorrow'])
assert.deepEqual(cells.map((c) => c.isToday), [false, false, false, false, false, true, false])
assert.equal(nextDay('2026-10-31'), '2026-11-01')
assert.equal(nextDay('2026-12-31'), '2027-01-01')
assert.equal(weekCells([], '2026-10-13')[5].state, 'none') // aujourd'hui pas encore joué
// semaine calendaire lundi → dimanche
assert.equal(mondayOf('2026-10-13'), '2026-10-12') // mardi
assert.equal(mondayOf('2026-10-18'), '2026-10-12') // dimanche
assert.equal(mondayOf('2026-10-12'), '2026-10-12') // lundi
assert.equal(isoWeek('2026-10-13'), 42)
assert.equal(isoWeek('2026-01-01'), 1)
assert.equal(isoWeek('2027-01-01'), 53) // vendredi 1er janvier 2027 : semaine 53 de 2026
const w0 = calendarWeek([r('2026-10-11', true)], '2026-10-14')
assert.equal(w0.cells[0].state, 'none') // lundi manqué
const w = calendarWeek([r('2026-10-11', true), r('2026-10-12', true), r('2026-10-13', true), r('2026-10-14', true)], '2026-10-14')
assert.deepEqual(w.cells.map((c) => c.state), ['win', 'win', 'win', 'future', 'future', 'future', 'future']) // le dimanche 11 appartient à la semaine précédente
assert.equal(w.cells[0].dayKey, '2026-10-12')
assert.equal(w.cells[6].dayKey, '2026-10-18')
assert.equal(w.wins, 3)
assert.equal(w.run, 3)
assert.equal(w.todayDone, true)
assert.equal(w.number, 42)
// aujourd'hui pas encore joué : la série part d'hier ; une défaite coupe la série
const p1 = calendarWeek([r('2026-10-12', true), r('2026-10-13', true)], '2026-10-14')
assert.deepEqual(p1.cells.slice(0, 4).map((c) => c.state), ['win', 'win', 'today', 'future'])
assert.equal(p1.run, 2)
assert.equal(p1.todayDone, false)
const p2 = calendarWeek([r('2026-10-12', true), r('2026-10-13', false), r('2026-10-14', true)], '2026-10-14')
assert.equal(p2.run, 1)
assert.equal(p2.wins, 2)
assert.equal(calendarWeek([], '2026-10-12').run, 0) // lundi, rien joué
assert.equal(calendarWeek([r('2026-10-18', true)], '2026-10-18').cells[6].isToday, true) // dimanche
console.log('week OK')
