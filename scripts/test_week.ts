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
// semaine calendaire lundi → dimanche. Un jour de jeu porte la date de sa FIN (clé) ; on affiche la date de son DÉBUT (displayDay).
assert.equal(mondayOf('2026-10-13'), '2026-10-12') // mardi
assert.equal(mondayOf('2026-10-18'), '2026-10-12') // dimanche
assert.equal(mondayOf('2026-10-12'), '2026-10-12') // lundi
assert.equal(isoWeek('2026-10-13'), 42)
assert.equal(isoWeek('2026-01-01'), 1)
assert.equal(isoWeek('2027-01-01'), 53) // vendredi 1er janvier 2027 : semaine 53 de 2026
// cas réel du lancement : jours n°1, n°2 (même date affichée, lundi 12) et n°3 (clé 14/10 = affiché mardi 13)
const w = calendarWeek([r('2026-10-12', true), r('2026-10-13', true), r('2026-10-14', true)], '2026-10-14')
assert.deepEqual(w.cells.map((c) => c.label), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
assert.deepEqual(w.cells.map((c) => c.state), ['win', 'win', 'future', 'future', 'future', 'future', 'future'])
assert.deepEqual(w.cells.map((c) => c.isToday), [false, true, false, false, false, false, false]) // aujourd'hui = mardi 13, pas mercredi 14
assert.equal(w.from, '2026-10-12')
assert.equal(w.to, '2026-10-18')
assert.equal(w.number, 42)
assert.equal(w.wins, 3) // les trois jours de jeu, comme la tuile Victoires
assert.equal(w.run, 3)
assert.equal(w.todayDone, true)
// aujourd'hui pas encore joué : la série part d'hier
const p1 = calendarWeek([r('2026-10-12', true), r('2026-10-13', true)], '2026-10-14')
assert.deepEqual(p1.cells.slice(0, 3).map((c) => c.state), ['win', 'today', 'future'])
assert.equal(p1.run, 2)
assert.equal(p1.todayDone, false)
// une semaine ordinaire : lundi 19 → dimanche 25 octobre ; clé 21/10 = mardi 20, clé 24/10 = vendredi 23
const q = calendarWeek([r('2026-10-20', true), r('2026-10-21', false), r('2026-10-22', true), r('2026-10-23', true), r('2026-10-24', true)], '2026-10-24')
assert.deepEqual(q.cells.map((c) => c.state), ['win', 'loss', 'win', 'win', 'win', 'future', 'future'])
assert.equal(q.cells[4].isToday, true)
assert.equal(q.wins, 4)
assert.equal(q.run, 3) // la défaite du mardi coupe la série
assert.equal(calendarWeek([], '2026-10-20').cells[0].state, 'today') // lundi 19 en cours, rien joué
assert.equal(calendarWeek([], '2026-10-20').run, 0)
// le jour de jeu qui s'affiche dimanche a pour clé le lundi suivant ; la semaine ne déborde pas
const sun = calendarWeek([r('2026-10-26', true)], '2026-10-26')
assert.equal(sun.cells[6].isToday, true)
assert.equal(sun.cells[6].state, 'win')
assert.equal(sun.to, '2026-10-25')
// la série ne remonte pas dans la semaine précédente
const mon = calendarWeek([r('2026-10-25', true), r('2026-10-26', true)], '2026-10-27')
assert.equal(mon.from, '2026-10-26')
assert.equal(mon.run, 0) // les clés 25 et 26 s'affichent samedi 24 et dimanche 25 : semaine précédente
assert.equal(mon.wins, 0)
assert.equal(mon.cells[0].state, 'today')
console.log('week OK')
