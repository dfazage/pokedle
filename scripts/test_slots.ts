// Deux combats par jour : série en jours, cœurs et points par combat, historique, rappels. npx tsx scripts/test_slots.ts
import { computeStats, dayResults, recId, type DayRecord } from '../src/game/history'
import { heartsInfo, heartsAfter } from '../src/game/hearts'
import { scoreHistory } from '../src/game/scoring'
import { weekCells } from '../src/game/week'
import { nextReminder } from '../src/game/reminder'

let bad = 0
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) { bad++; console.log('ÉCHEC', label, 'obtenu', JSON.stringify(got), 'attendu', JSON.stringify(want)) }
  else console.log('ok  ', label)
}
const rec = (dayKey: string, slot: number, result: 'win' | 'loss', extra: Partial<DayRecord> = {}): DayRecord => ({
  dayKey, ...(slot > 1 ? { slot } : {}), trainer: 'Brock', gen: 1, result, turns: 12, survivors: result === 'win' ? 3 : 0, kos: 6, hpLeft: 50, ...extra,
})

// Série : un jour est gagné dès qu'un de ses combats l'est
const D1 = '2026-10-18', D2 = '2026-10-19', D3 = '2026-10-20'
let h = [rec(D1, 1, 'loss'), rec(D1, 2, 'win'), rec(D2, 1, 'win'), rec(D2, 2, 'win')]
eq('série : défaite puis victoire le même jour = jour gagné', computeStats(h, D2, 2).currentStreak, 2)
eq('meilleure série en jours (2 jours, 3 victoires)', computeStats(h, D2, 2).bestStreak, 2)
eq('victoires et combats comptés par combat', [computeStats(h, D2, 2).totalWins, computeStats(h, D2, 2).played], [3, 4])
h = [rec(D1, 1, 'win'), rec(D2, 1, 'loss')]
eq('défaite au n°1, n°2 pas encore joué : la série tient', computeStats(h, D2, 2).currentStreak, 1)
eq('défaite au n°1 et n°2 : série brisée', computeStats([...h, rec(D2, 2, 'loss')], D2, 2).currentStreak, 0)
eq('un seul combat par jour (ancien régime) : défaite = série brisée', computeStats([rec('2026-10-16', 1, 'win'), rec('2026-10-17', 1, 'loss')], '2026-10-17', 1).currentStreak, 0)
eq('jour sans victoire coupe la série', computeStats([rec(D1, 1, 'win'), rec(D1, 2, 'win'), rec(D2, 1, 'loss'), rec(D2, 2, 'loss'), rec(D3, 1, 'win')], D3, 2).currentStreak, 1)

// dayResults / recId
eq('dayResults', [...dayResults([rec(D1, 1, 'loss'), rec(D1, 2, 'win'), rec(D2, 1, 'loss')])], [[D1, 'win'], [D2, 'loss']])
eq('recId n°1 = clé du jour', recId(rec(D1, 1, 'win')), D1)
eq('recId n°2', recId(rec(D1, 2, 'win')), `${D1}~2`)

// Cœurs : par combat, dans l'ordre (jour, n°)
eq('cœurs au 1er combat sans historique', heartsInfo([], D1, 0, 1).count, 3)
const afterWin1 = [rec(D1, 1, 'win', { attempts: 1 })]
eq('n°2 : base = cœurs après le n°1 (plafond 3)', heartsInfo(afterWin1, D1, 0, 2).count, 3)
const afterLoss1 = [rec(D1, 1, 'loss', { attempts: 1 })]
eq('défaite au n°1 : on peut rejouer le n°1', heartsInfo(afterLoss1, D1, 1, 1).canReplay, true)
eq('le n°2 ne regarde pas le rejeu du n°1 comme sien', heartsInfo(afterLoss1, D1, 0, 2).attempt, 0)
const replayed = [rec(D1, 1, 'loss', { attempts: 3 }), rec(D1, 2, 'win', { attempts: 1 })]
eq('cœurs : 2 rejeux au n°1 (−2) puis victoire au n°2 (+1)', heartsAfter(replayed), 2)
eq('hearts n°2 victoire', heartsInfo(replayed, D1, 1, 2).count, 2)
eq('rejeu en attente sur le n°1 uniquement', [heartsInfo([rec(D1, 1, 'loss', { attempts: 1 })], D1, 2, 1).replayPending, heartsInfo([rec(D1, 1, 'loss', { attempts: 1 })], D1, 2, 2).replayPending], [true, false])

// Points : par combat, la série ne gagne qu'un cran par jour
const sc = scoreHistory([rec(D1, 1, 'win'), rec(D1, 2, 'win'), rec(D2, 1, 'win')])
eq('points : clés par combat', [...sc.byDay.keys()], [D1, `${D1}~2`, D2])
eq('série de points : n°1 et n°2 du même jour = même cran', [sc.byDay.get(D1)!.streak, sc.byDay.get(`${D1}~2`)!.streak, sc.byDay.get(D2)!.streak], [1, 1, 2])
eq('total = somme des combats', sc.total, [...sc.byDay.values()].reduce((a, b) => a + b.points, 0))

// Semaine : l'état d'un jour = victoire si un combat gagné
const cells = weekCells([rec(D1, 1, 'loss'), rec(D1, 2, 'win')], D1)
eq('semaine : jour gagné au 2e combat', cells[5].state, 'win')

// Rappels : 04:00 UTC (dès la bascule) et 10:00 UTC
const nr = (iso: string) => nextReminder(new Date(iso)).toISOString()
eq('rappel avant la bascule : 10h UTC seulement', nr('2026-10-16T05:00:00Z'), '2026-10-16T10:00:00.000Z')
eq('rappel la veille de la bascule après 10h UTC : 04:00 UTC du 17/10 (bascule)', nr('2026-10-16T10:30:00Z'), '2026-10-17T04:00:00.000Z')
eq('rappel après la bascule', nr('2026-10-17T04:30:00Z'), '2026-10-17T10:00:00.000Z')
eq('rappel de 12h KL', nr('2026-10-17T10:30:00Z'), '2026-10-18T04:00:00.000Z')

console.log(bad ? `${bad} échec(s)` : 'tous les tests passent')
if (bad) process.exit(1)
