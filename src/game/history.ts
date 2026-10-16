// Historique local (V1). Même interface qu'aura le stockage Supabase : on remplacera l'implémentation.
export interface DayRecord {
  dayKey: string
  /** N° du combat dans le jour (1 ou 2 à partir de DOUBLE_FROM_KEY ; absent = 1). */
  slot?: number
  trainer: string
  gen: number
  result: 'win' | 'loss'
  turns: number
  survivors?: number
  kos?: number
  /** PV restants de l'équipe du joueur en fin de combat, en % (0-100). */
  hpLeft?: number
  /** Nombre d'essais utilisés ce jour-là (1 = premier essai ; défaut 1). Sert au calcul des cœurs. */
  attempts?: number
}
export interface Stats {
  totalWins: number
  played: number
  currentStreak: number
  bestStreak: number
}

const KEY = 'pokedle:history:v1'

export function loadHistory(): DayRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DayRecord[]) : []
  } catch {
    return []
  }
}

export const slotOf = (r: { slot?: number }): number => r.slot ?? 1
/** Ordre chronologique : jour, puis n° du combat. */
export const cmpRec = (a: DayRecord, b: DayRecord): number => a.dayKey.localeCompare(b.dayKey) || slotOf(a) - slotOf(b)
/** Clé unique d'un combat de l'historique (le combat n°1 garde la clé du jour). */
export const recId = (r: { dayKey: string; slot?: number }): string => (slotOf(r) > 1 ? `${r.dayKey}~${slotOf(r)}` : r.dayKey)

export function saveRecord(rec: DayRecord): DayRecord[] {
  const all = loadHistory().filter((r) => !(r.dayKey === rec.dayKey && slotOf(r) === slotOf(rec))) // une seule entrée par combat
  all.push(rec)
  all.sort(cmpRec)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* stockage indisponible : on continue sans persister */
  }
  return all
}

/** Supprime le combat `slot` du jour, ou tous les combats du jour si `slot` est omis. */
export function removeRecord(dayKey: string, slot?: number): DayRecord[] {
  const all = loadHistory().filter((r) => !(r.dayKey === dayKey && (slot === undefined || slotOf(r) === slot)))
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return all
}

export function getRecord(dayKey: string, slot = 1): DayRecord | undefined {
  return loadHistory().find((r) => r.dayKey === dayKey && slotOf(r) === slot)
}

/** Résultat du combat `slot` du jour dans `history`. */
export const recordFor = (history: DayRecord[], dayKey: string, slot: number): DayRecord | undefined =>
  history.find((r) => r.dayKey === dayKey && slotOf(r) === slot)

/** Résultat d'un jour : « win » si au moins un combat gagné, « loss » si des combats joués et aucun gagné, sinon undefined. */
export function dayResults(history: DayRecord[]): Map<string, 'win' | 'loss'> {
  const m = new Map<string, 'win' | 'loss'>()
  for (const r of history) m.set(r.dayKey, r.result === 'win' || m.get(r.dayKey) === 'win' ? 'win' : 'loss')
  return m
}

export function prevDay(key: string): string {
  const d = new Date(key + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/** Nombre de combats joués ce jour-là dans `history`. */
const playedOn = (history: DayRecord[], day: string) => history.filter((r) => r.dayKey === day).length

/** `slots` = nombre de combats du jour `today` (voir slotsPerDay). La série compte des JOURS : un jour est gagné dès qu'un de ses combats l'est. */
export function computeStats(history: DayRecord[], today: string, slots = 1): Stats {
  const byDay = dayResults(history)
  const totalWins = history.filter((r) => r.result === 'win').length
  // meilleure série : jours consécutifs gagnés
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const day of [...byDay.keys()].sort()) {
    if (byDay.get(day) === 'win') {
      run = prev && prevDay(day) === prev ? run + 1 : 1
      prev = day
      best = Math.max(best, run)
    } else {
      run = 0
      prev = null
    }
  }
  // série en cours : on part d'aujourd'hui (ou d'hier si aujourd'hui n'est pas encore joué ou pas encore perdu : avec 2 combats,
  // une défaite au n°1 laisse le n°2 pour sauver le jour).
  const todayLost = byDay.get(today) === 'loss' && playedOn(history, today) >= slots
  let cursor = byDay.get(today) === 'win' || todayLost ? today : prevDay(today)
  let current = 0
  while (byDay.get(cursor) === 'win') {
    current++
    cursor = prevDay(cursor)
  }
  return { totalWins, played: history.length, currentStreak: current, bestStreak: best }
}
