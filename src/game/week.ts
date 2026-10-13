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

// ── Semaine calendaire (lundi → dimanche), pour la carte « Ta semaine » de l'accueil ──
export type CalState = 'win' | 'loss' | 'none' | 'today' | 'future'
export interface CalCell {
  dayKey: string
  state: CalState
  isToday: boolean
}
export interface CalWeek {
  cells: CalCell[]
  /** Numéro de semaine ISO. */
  number: number
  from: string
  to: string
  /** Victoires de la semaine. */
  wins: number
  /** Victoires consécutives en cours dans la semaine (aujourd'hui compris, sinon à partir d'hier). */
  run: number
  /** Aujourd'hui est déjà gagné. */
  todayDone: boolean
}

const addDays = (key: string, n: number): string => {
  const d = new Date(key + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 0 = lundi … 6 = dimanche. */
const mondayIndex = (key: string): number => (new Date(key + 'T00:00:00Z').getUTCDay() + 6) % 7

export function mondayOf(key: string): string {
  return addDays(key, -mondayIndex(key))
}

/** Numéro de semaine ISO 8601 (la semaine 1 contient le premier jeudi de l'année). */
export function isoWeek(key: string): number {
  const thursday = new Date(addDays(key, 3 - mondayIndex(key)) + 'T00:00:00Z')
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.floor((thursday.getTime() - jan1) / 86400000 / 7) + 1
}

export function calendarWeek(history: DayRecord[], today: string): CalWeek {
  const byDay = new Map(history.map((r) => [r.dayKey, r.result]))
  const from = mondayOf(today)
  const cells: CalCell[] = []
  for (let i = 0; i < 7; i++) {
    const dayKey = addDays(from, i)
    const played = byDay.get(dayKey)
    const state: CalState = dayKey > today ? 'future' : (played ?? (dayKey === today ? 'today' : 'none'))
    cells.push({ dayKey, state, isToday: dayKey === today })
  }
  const todayIdx = mondayIndex(today)
  let run = 0
  for (let i = cells[todayIdx].state === 'win' ? todayIdx : todayIdx - 1; i >= 0 && cells[i].state === 'win'; i--) run++
  return {
    cells,
    number: isoWeek(today),
    from,
    to: cells[6].dayKey,
    wins: cells.filter((c) => c.state === 'win').length,
    run,
    todayDone: cells[todayIdx].state === 'win',
  }
}
