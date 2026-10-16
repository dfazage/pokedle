// Système de cœurs : une réserve de rejeux pour le combat du jour (max 3).
//  - le 1er essai de chaque jour est offert ;
//  - chaque rejeu après une défaite coûte 1 cœur ;
//  - une victoire rapporte 1 cœur (plafonné à 3).
// Tout est dérivé de l'historique (`attempts` par jour) : le même historique donne toujours le même nombre de cœurs,
// en local comme en ligne. Seul le compteur d'essais du jour en cours vit à part (clé locale), pour qu'un rejeu
// commencé coûte son cœur tout de suite, même si la page est rechargée avant la fin du combat.
import { cmpRec, slotOf, type DayRecord } from './history'

export const MAX_HEARTS = 3

/** `day` = identifiant du combat (battleId : le n°1 garde la clé du jour). */
const attemptKey = (day: string) => `pokedle:attempt:${day}`

/** Nombre d'essais commencés aujourd'hui (0 = aucun combat lancé). */
export function loadAttempt(day: string): number {
  try {
    const n = Number(localStorage.getItem(attemptKey(day)) ?? 0)
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}
export function saveAttempt(day: string, n: number) {
  try {
    localStorage.setItem(attemptKey(day), String(n))
  } catch {
    /* ignore */
  }
}
export function clearAttempt(day: string) {
  try {
    localStorage.removeItem(attemptKey(day))
  } catch {
    /* ignore */
  }
}

const clampHearts = (n: number) => Math.min(MAX_HEARTS, Math.max(0, n))

/** Cœurs après avoir joué tous les jours de `history` (jours triés par date). */
export function heartsAfter(history: DayRecord[]): number {
  let h = MAX_HEARTS
  for (const r of [...history].sort(cmpRec)) {
    h = clampHearts(h - Math.max(0, (r.attempts ?? 1) - 1))
    if (r.result === 'win') h = clampHearts(h + 1)
  }
  return h
}

export interface HeartsInfo {
  count: number
  max: number
  /** Essai du jour en cours ou terminé (1 = essai offert). 0 si aucun combat lancé. */
  attempt: number
  /** Un rejeu a été payé mais le combat n'est pas terminé. */
  replayPending: boolean
  /** Défaite du jour avec au moins 1 cœur : on peut rejouer. */
  canReplay: boolean
  /** Victoire du jour qui a rapporté un cœur (pas de gain si la réserve était déjà pleine). */
  gained: boolean
}

/** État des cœurs pour le combat `slot` du jour. `attemptNo` = compteur local d'essais commencés pour ce combat. */
export function heartsInfo(history: DayRecord[], today: string, attemptNo: number, slot = 1): HeartsInfo {
  const base = heartsAfter(history.filter((r) => r.dayKey < today || (r.dayKey === today && slotOf(r) < slot)))
  const rec = history.find((r) => r.dayKey === today && slotOf(r) === slot)
  const recAttempts = rec ? rec.attempts ?? 1 : 0
  const attempt = Math.max(attemptNo, recAttempts)
  const afterReplays = clampHearts(base - Math.max(0, attempt - 1))
  const win = rec?.result === 'win'
  const count = win ? clampHearts(afterReplays + 1) : afterReplays
  const replayPending = rec?.result === 'loss' && attemptNo > recAttempts
  return {
    count,
    max: MAX_HEARTS,
    attempt,
    replayPending,
    canReplay: rec?.result === 'loss' && !replayPending && afterReplays >= 1,
    gained: win && afterReplays < MAX_HEARTS,
  }
}
