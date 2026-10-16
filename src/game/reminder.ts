import { DOUBLE_FROM_MS } from './rng'

/** Heures UTC des rappels : 04:00 (12h Kuala Lumpur, combat n°1) et 10:00 (18h KL, combat n°2). Avant la bascule à deux combats
 *  (DOUBLE_FROM_MS), seul le rappel de 10:00 UTC part (= 12h à Paris à cette date), comme l'Edge Function send-daily-push. */
export const REMINDER_HOURS_UTC = [4, 10]

/** Prochain rappel, en heure locale de l'appareil. */
export function nextReminder(now = new Date()): Date {
  const t = now.getTime()
  const base = new Date(t)
  for (let day = 0; day < 3; day++) {
    for (const h of REMINDER_HOURS_UTC) {
      const at = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + day, h)
      if (at > t && (h !== 4 || at >= DOUBLE_FROM_MS)) return new Date(at)
    }
  }
  return new Date(t + 3600000)
}
