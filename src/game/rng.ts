// PRNG déterministe : la même clé de jour donne la même partie pour tout le monde.
export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export function pick<T>(rand: Rand, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

export function shuffle<T>(rand: Rand, arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function seedArray(seed: number): [number, number, number, number] {
  const r = mulberry32(seed)
  return [
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
  ]
}

/** Ancien jour de référence en UTC (YYYY-MM-DD), conservé pour les scripts. Le jeu n'en dépend plus : voir gameDayKey. */
export function dayKeyUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Heure de Paris (12h) à laquelle le défi change. Le jeu suit l'heure légale de Paris (heure d'été / d'hiver comprises). */
export const RESET_HOUR_PARIS = 12
/** Premier jour de jeu (n°1) : plancher de la clé du jour, voir gameDayKey et public.game_day(). */
const LAUNCH_DAY = '2026-10-12'
/** Premier reset exceptionnel (lancement) : le 12/10/2026 à 09h10 UTC (17h10 Kuala Lumpur), puis 12h Paris chaque jour. */
const FIRST_RESET_MS = Date.UTC(2026, 9, 12, 9, 10)
const PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})
/** Heure murale de Paris à l'instant `ms`, exprimée comme un « faux UTC » (comparable à ms pour obtenir le décalage). */
const parisWall = (ms: number): { wall: number; y: number; m: number; d: number; h: number } => {
  const p = Object.fromEntries(PARIS.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)])) as Record<string, number>
  return { wall: Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second), y: p.year, m: p.month, d: p.day, h: p.hour }
}

/**
 * Clé du jour de jeu (YYYY-MM-DD) : un jour va de 12h00 (heure de Paris) à 12h00 le lendemain et porte la date de Paris de sa
 * FIN (date de maintenant + 12h). Le 12/10 avant 12h Paris = jour n°1 (clé 12/10) ; dès 12h00 le 12/10 = jour n°2 (clé 13/10).
 * Identique côté serveur : fonction SQL `public.game_day()` (supabase/reset_noon_paris.sql). Les clés restent consécutives :
 * aucune statistique ni série n'est touchée.
 */
export function gameDayKey(d = new Date()): string {
  const { y, m, d: day, h } = parisWall(d.getTime())
  // Le jour de jeu N va de 12h Paris (N-1) à 12h Paris (N) : la clé est la date de Paris à (maintenant + 12h).
  // Jour n°1 (clé 12/10) = avant le premier reset, aujourd'hui 12/10 à 12h Paris le jeu passe au 13/10 (n°2).
  const key = new Date(Date.UTC(y, m - 1, day + (h >= RESET_HOUR_PARIS ? 1 : 0))).toISOString().slice(0, 10)
  if (d.getTime() >= FIRST_RESET_MS && key < '2026-10-13') return '2026-10-13'
  return key < LAUNCH_DAY ? LAUNCH_DAY : key
}

/** Millisecondes jusqu'au prochain reset (12h00 heure de Paris). */
export function msToNextReset(now = new Date()): number {
  const t = now.getTime()
  if (t < FIRST_RESET_MS) return FIRST_RESET_MS - t
  const { y, m, d, h } = parisWall(t)
  const noon = Date.UTC(y, m - 1, d + (h < RESET_HOUR_PARIS ? 0 : 1), RESET_HOUR_PARIS)
  // 12h est loin des changements d'heure (2h-3h du matin) : un seul réajustement du décalage suffit.
  let utc = noon - (parisWall(noon).wall - noon)
  utc = noon - (parisWall(utc).wall - utc)
  return utc - t
}
