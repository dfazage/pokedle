// Historique local (V1). Même interface qu'aura le stockage Supabase : on remplacera l'implémentation.
export interface DayRecord {
  dayKey: string
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

export function saveRecord(rec: DayRecord): DayRecord[] {
  const all = loadHistory().filter((r) => r.dayKey !== rec.dayKey) // une seule entrée par jour
  all.push(rec)
  all.sort((a, b) => a.dayKey.localeCompare(b.dayKey))
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* stockage indisponible : on continue sans persister */
  }
  return all
}

export function removeRecord(dayKey: string): DayRecord[] {
  const all = loadHistory().filter((r) => r.dayKey !== dayKey)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
  return all
}

export function getRecord(dayKey: string): DayRecord | undefined {
  return loadHistory().find((r) => r.dayKey === dayKey)
}

export function prevDay(key: string): string {
  const d = new Date(key + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function computeStats(history: DayRecord[], today: string): Stats {
  const byDay = new Map(history.map((r) => [r.dayKey, r]))
  const totalWins = history.filter((r) => r.result === 'win').length
  // meilleure série : jours consécutifs gagnés
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const r of [...history].sort((a, b) => a.dayKey.localeCompare(b.dayKey))) {
    if (r.result === 'win') {
      run = prev && prevDay(r.dayKey) === prev ? run + 1 : 1
      prev = r.dayKey
      best = Math.max(best, run)
    } else {
      run = 0
      prev = null
    }
  }
  // série en cours : on part d'aujourd'hui (ou d'hier si aujourd'hui n'est pas encore joué)
  let cursor = byDay.get(today) ? today : prevDay(today)
  let current = 0
  while (byDay.get(cursor)?.result === 'win') {
    current++
    cursor = prevDay(cursor)
  }
  return { totalWins, played: history.length, currentStreak: current, bestStreak: best }
}
