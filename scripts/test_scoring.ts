import { scoreHistory, scoreRecord, SCORING } from '../src/game/scoring'
import type { DayRecord } from '../src/game/history'
let fail = 0
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
const rec = (d: string, o: Partial<DayRecord> = {}): DayRecord => ({ dayKey: d, trainer: 'Cynthia', gen: 4, result: 'win', turns: 24, survivors: 6, kos: 6, hpLeft: 100, ...o })

// Cynthia = Championne (150). Tours 24 -> vitesse 0.5 ; PV 100 % ; survivants 100 % -> P = 0.45*0.5+0.35+0.2 = 0.775
const a = scoreRecord(rec('2026-10-12'), 1)
eq('base champion', a.base, 150)
eq('perf', Math.round(a.perf * 1000) / 1000, 0.775)
eq('points (streak 1 + sans KO)', a.points, Math.round(150 * (0.5 + 0.5 * 0.775) * 1.05) + 10)
eq('défaite = 0', scoreRecord(rec('2026-10-12', { result: 'loss', survivors: 0 }), 0).points, 0)
eq('pas de flawless si un KO', scoreRecord(rec('2026-10-12', { survivors: 5 }), 1).flawless, false)
eq('victoire de justesse > 0', scoreRecord(rec('2026-10-12', { turns: 99, survivors: 1, hpLeft: 1 }), 1).points > 0, true)
eq('plancher garanti', scoreRecord(rec('2026-10-12', { turns: 99, survivors: 0, hpLeft: 0 }), 1).points >= Math.round(150 * SCORING.floor), true)
eq('hpLeft absent -> survivants', scoreRecord(rec('2026-10-12', { hpLeft: undefined, survivors: 3 }), 1).hp, 0.5)
eq('dresseur inconnu -> base par défaut', scoreRecord(rec('2026-10-12', { trainer: 'Inconnu' }), 1).base, SCORING.defaultBase)

// Série : 3 victoires de suite, une défaite, une victoire
const h = [rec('2026-10-08'), rec('2026-10-09'), rec('2026-10-10'), rec('2026-10-11', { result: 'loss', survivors: 0 }), rec('2026-10-12')]
const s = scoreHistory(h)
eq('série j3', s.byDay.get('2026-10-10')!.streak, 3)
eq('série brisée', s.byDay.get('2026-10-12')!.streak, 1)
eq('total = somme', s.total, [...s.byDay.values()].reduce((x, y) => x + y.points, 0))
eq('plafond de série', scoreRecord(rec('x'), 99).streakMult, 1.5)

// Cœurs : malus par essai (×1, ×0,75, ×0,5, ×0,25)
const base1 = scoreRecord(rec('x'), 1)
eq('essai 1 : ×1', [base1.attempt, base1.attemptMult], [1, 1])
eq('essai 2 : ×0,75', scoreRecord(rec('x', { attempts: 2 }), 1).points, Math.round((150 * (0.5 + 0.5 * 0.775) * 1.05 + 10) * 0.75))
eq('essai 3 : ×0,5', scoreRecord(rec('x', { attempts: 3 }), 1).attemptMult, 0.5)
eq('essai 4 : ×0,25', scoreRecord(rec('x', { attempts: 4 }), 1).attemptMult, 0.25)
eq('au-delà du tableau : dernier multiplicateur', scoreRecord(rec('x', { attempts: 9 }), 1).attemptMult, 0.25)
eq('malus croissant', scoreRecord(rec('x', { attempts: 2 }), 1).points < base1.points, true)
eq('défaite avec rejeux = 0', scoreRecord(rec('x', { result: 'loss', survivors: 0, attempts: 3 }), 0).points, 0)
process.exit(fail ? 1 : 0)
