// Bande « ta semaine » de l'écran Résultat : les 6 derniers jours jusqu'à aujourd'hui, puis demain (à jouer).
// Module pur (aucune dépendance React / DOM) pour rester testable avec scripts/test_week.ts.
import { prevDay, type DayRecord } from './history'

export type WeekState = 'win' | 'loss' | 'none' | 'tomorrow'
export interface WeekCell {
  dayKey: string
  state: WeekState
  isToday: boolean
}

export function nextDay(key: string): string {
  const d = new Date(key + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** 7 cases : J-5 … aujourd'hui, puis demain. Un jour sans combat (ou pas encore joué) est « none ». */
export function weekCells(history: DayRecord[], today: string): WeekCell[] {
  const byDay = new Map(history.map((r) => [r.dayKey, r.result]))
  const days: string[] = [today]
  for (let i = 0; i < 5; i++) days.unshift(prevDay(days[0]))
  const cells: WeekCell[] = days.map((dayKey) => ({ dayKey, state: byDay.get(dayKey) ?? 'none', isToday: dayKey === today }))
  cells.push({ dayKey: nextDay(today), state: 'tomorrow', isToday: false })
  return cells
}
