// Quand proposer les rappels push juste après une victoire : une seule fois, puis pas avant 7 jours si le joueur dit « Pas maintenant ».
// Module pur (le stockage est injecté) pour rester testable avec scripts/test_push_ask.ts.
const KEY = 'pokedle:pushAsk:v1'
export const SNOOZE_DAYS = 7
const DAY_MS = 24 * 3600 * 1000

export interface AskInput {
  /** Le combat du jour vient d'être gagné. */
  win: boolean
  /** Connecté (la souscription est rattachée au compte). */
  signedIn: boolean
  /** Push disponible dans ce build (clé VAPID + Supabase). */
  configured: boolean
  /** État du navigateur : seul « off » (jamais demandé / pas abonné) justifie de poser la question. */
  state: string
  /** Dernier « Pas maintenant » (ms), null si jamais. */
  snoozedAt: number | null
  now: number
}

export function shouldAskPush({ win, signedIn, configured, state, snoozedAt, now }: AskInput): boolean {
  if (!win || !signedIn || !configured || state !== 'off') return false
  return snoozedAt == null || now - snoozedAt >= SNOOZE_DAYS * DAY_MS
}

export function loadSnooze(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

export function saveSnooze(now = Date.now()) {
  try {
    localStorage.setItem(KEY, String(now))
  } catch {
    /* stockage indisponible : on redemandera au prochain succès */
  }
}
