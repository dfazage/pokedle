import assert from 'node:assert/strict'
import { weekCells, nextDay } from '../src/game/week'
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
console.log('week OK')
