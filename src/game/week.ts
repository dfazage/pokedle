// Bande « ta semaine » de l'écran Résultat : les 6 derniers jours jusqu'à aujourd'hui, puis demain (à jouer).
// Module pur (aucune dépendance React / DOM) pour rester testable avec scripts/test_week.ts.
import { prevDay, type DayRecord } from './history'
import { addDays, displayDay, LAUNCH_DAY } from './rng'

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
// Un jour de jeu va de 12h Paris à 12h Paris et sa clé porte la date de sa FIN ; on AFFICHE la date de son début
// (displayDay, comme l'Historique). Les cases sont donc rangées par date affichée, les clés restent celles de l'historique.
export type CalState = 'win' | 'loss' | 'none' | 'today' | 'future'
export interface CalCell {
  /** Date affichée de la case (YYYY-MM-DD). */
  label: string
  /** Clé de jour de jeu la plus récente de la case (celle de l'historique). */
  dayKey: string
  state: CalState
  isToday: boolean
}
export interface CalWeek {
  cells: CalCell[]
  /** Numéro de semaine ISO (de la date affichée). */
  number: number
  /** Lundi et dimanche affichés. */
  from: string
  to: string
  /** Victoires de la semaine. */
  wins: number
  /** Victoires consécutives en cours dans la semaine (aujourd'hui compris, sinon à partir d'hier). */
  run: number
  /** Aujourd'hui est déjà gagné. */
  todayDone: boolean
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

/** Clés de jeu affichées à la date `label` : en général une seule ; le jour du lancement en abrite deux (jours n°1 et n°2). */
const keysFor = (label: string): string[] => (label === LAUNCH_DAY ? [LAUNCH_DAY, addDays(label, 1)] : [addDays(label, 1)])

export function calendarWeek(history: DayRecord[], today: string): CalWeek {
  const byDay = new Map(history.map((r) => [r.dayKey, r.result]))
  const todayLabel = displayDay(today)
  const from = mondayOf(todayLabel)
  const cells: CalCell[] = []
  for (let i = 0; i < 7; i++) {
    const label = addDays(from, i)
    const keys = keysFor(label).filter((k) => k <= today)
    const results = keys.map((k) => byDay.get(k)).filter((x) => x !== undefined)
    const state: CalState =
      label > todayLabel ? 'future' : results.includes('win') ? 'win' : results.includes('loss') ? 'loss' : label === todayLabel ? 'today' : 'none'
    cells.push({ label, dayKey: keys[keys.length - 1] ?? addDays(label, 1), state, isToday: label === todayLabel })
  }
  const inWeek = (key: string) => displayDay(key) >= from && displayDay(key) <= addDays(from, 6)
  const wins = history.filter((r) => r.result === 'win' && r.dayKey <= today && inWeek(r.dayKey)).length
  const todayDone = byDay.get(today) === 'win'
  let run = 0
  for (let k = todayDone ? today : prevDay(today); byDay.get(k) === 'win' && inWeek(k); k = prevDay(k)) run++
  return { cells, number: isoWeek(todayLabel), from, to: addDays(from, 6), wins, run, todayDone }
}
