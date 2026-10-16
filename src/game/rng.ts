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
export const LAUNCH_DAY = '2026-10-12'
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
 * Deux combats par jour, à partir du 17/10/2026 à 12h Kuala Lumpur (04:00 UTC) : le combat n°1 est publié à 12h KL, le n°2 à 18h KL
 * (10:00 UTC), et le jour de jeu suivant commence à 12h KL le lendemain. Heure fixe UTC+8 (plus de suivi de l'heure de Paris).
 * Avant cet instant : un seul combat par jour, reset à 12h Paris (inchangé). Miroir SQL : `public.game_day()` et `public.game_slots_open()`
 * (supabase/double_battles.sql). Un jour de jeu = deux combats (« slots ») ; la série se compte en jours, les points et les cœurs par combat.
 */
export const DOUBLE_FROM_MS = Date.UTC(2026, 9, 17, 4, 0)
/** Première clé de jour à deux combats (celle qui commence à DOUBLE_FROM_MS). */
export const DOUBLE_FROM_KEY = '2026-10-18'
/** Heure UTC de début du jour de jeu (12h KL) et délai du combat n°2 après le début (18h KL). */
const DAY_START_UTC_H = 4
const SLOT2_DELAY_H = 6
const HOUR_MS = 3600_000

/** Nombre de combats d'un jour de jeu. */
export const slotsPerDay = (dayKey: string): number => (dayKey >= DOUBLE_FROM_KEY ? 2 : 1)

/** Combats déjà publiés à l'instant `now` pour le jour de jeu en cours (1 ou 2). */
export function openSlots(now = new Date()): number {
  const t = now.getTime()
  if (t < DOUBLE_FROM_MS) return 1
  const since = (((t - DAY_START_UTC_H * HOUR_MS) % (24 * HOUR_MS)) + 24 * HOUR_MS) % (24 * HOUR_MS)
  return since >= SLOT2_DELAY_H * HOUR_MS ? 2 : 1
}

/** Identifiant d'un combat (jour + n°) : sert de suffixe aux clés de stockage local. Le combat n°1 garde la clé du jour (compatibilité). */
export const battleId = (dayKey: string, slot: number): string => (slot > 1 ? `${dayKey}~${slot}` : dayKey)

/**
 * Clé du jour de jeu (YYYY-MM-DD, non affichée telle quelle : voir displayDay) : un jour va de 12h00 (heure de Paris) à 12h00 le lendemain et porte la date de Paris de sa
 * FIN (date de maintenant + 12h). Le 12/10 avant 12h Paris = jour n°1 (clé 12/10) ; dès 12h00 le 12/10 = jour n°2 (clé 13/10).
 * Identique côté serveur : fonction SQL `public.game_day()` (supabase/reset_noon_paris.sql). Les clés restent consécutives :
 * aucune statistique ni série n'est touchée.
 */
export function gameDayKey(d = new Date()): string {
  // Depuis DOUBLE_FROM_MS : le jour de jeu commence à 12h Kuala Lumpur (04:00 UTC, heure fixe) et sa clé porte toujours la date de sa FIN.
  if (d.getTime() >= DOUBLE_FROM_MS) return new Date(d.getTime() + (24 - DAY_START_UTC_H) * HOUR_MS).toISOString().slice(0, 10)
  const { y, m, d: day, h } = parisWall(d.getTime())
  // Le jour de jeu N va de 12h Paris (N-1) à 12h Paris (N) : la clé est la date de Paris à (maintenant + 12h).
  // Jour n°1 (clé 12/10) = avant le premier reset, aujourd'hui 12/10 à 12h Paris le jeu passe au 13/10 (n°2).
  const key = new Date(Date.UTC(y, m - 1, day + (h >= RESET_HOUR_PARIS ? 1 : 0))).toISOString().slice(0, 10)
  if (d.getTime() >= FIRST_RESET_MS && key < '2026-10-13') return '2026-10-13'
  return key < LAUNCH_DAY ? LAUNCH_DAY : key
}

/** Ajoute `n` jours à une clé YYYY-MM-DD. */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/**
 * Date AFFICHÉE d'un jour de jeu : celle du jour où il commence (la clé, elle, porte la date de sa fin, voir gameDayKey).
 * Affichage seulement : les clés stockées (historique, séries, serveur) ne changent pas. Plancher = jour du lancement.
 */
export function displayDay(key: string): string {
  const d = addDays(key, -1)
  return d < LAUNCH_DAY ? LAUNCH_DAY : d
}

/** Clé du jour de jeu à afficher à la date `date` du calendrier (inverse de displayDay ; le 12/10 abrite les jours 1 et 2 : on prend le plus récent présent). */
export function keyForDisplayDay(date: string, has: (k: string) => boolean): string {
  const next = addDays(date, 1)
  return date === LAUNCH_DAY && !has(next) ? LAUNCH_DAY : next
}

/** Ancien régime (un combat par jour, reset à 12h heure de Paris) : millisecondes jusqu'au prochain 12h Paris à partir de `t`. */
function msToNextParisNoon(t: number): number {
  if (t < FIRST_RESET_MS) return FIRST_RESET_MS - t
  const { y, m, d, h } = parisWall(t)
  const noon = Date.UTC(y, m - 1, d + (h < RESET_HOUR_PARIS ? 0 : 1), RESET_HOUR_PARIS)
  // 12h est loin des changements d'heure (2h-3h du matin) : un seul réajustement du décalage suffit.
  let utc = noon - (parisWall(noon).wall - noon)
  utc = noon - (parisWall(utc).wall - utc)
  return utc - t
}

/** Millisecondes jusqu'à la prochaine publication d'un combat (n°1 à 12h KL, n°2 à 18h KL) ; avant la bascule : jusqu'à la bascule. */
export function msToNextReset(now = new Date()): number {
  const t = now.getTime()
  if (t < DOUBLE_FROM_MS) return Math.min(DOUBLE_FROM_MS - t, msToNextParisNoon(t)) // ancien régime : prochain 12h Paris, au plus tard la bascule
  const since = (((t - DAY_START_UTC_H * HOUR_MS) % (24 * HOUR_MS)) + 24 * HOUR_MS) % (24 * HOUR_MS)
  return (since < SLOT2_DELAY_H * HOUR_MS ? SLOT2_DELAY_H * HOUR_MS : 24 * HOUR_MS) - since
}
