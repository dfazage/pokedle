import { t } from '../i18n'

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878', Fire: '#f0716b', Water: '#5ba8f0', Grass: '#4ec9a0', Electric: '#f7c948', Ice: '#7fd6e0',
  Fighting: '#d65a4a', Poison: '#a864c9', Ground: '#d9b26a', Flying: '#8fa8f0', Psychic: '#f06a9c', Bug: '#a3c13a',
  Rock: '#b8a24a', Ghost: '#8b6cd9', Dragon: '#6a5cf0', Dark: '#7a6456', Steel: '#9fb0c4',
}

const LAUNCH = Date.UTC(2026, 9, 12)
/** Numéro du défi (n°1 = 12 octobre 2026, jour du lancement). */
export function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number)
  return Math.max(1, Math.round((Date.UTC(y, m - 1, d) - LAUNCH) / 86400000) + 1)
}

/** Difficulté d'après le taux de victoire estimé de l'équipe imposée. */
export function difficulty(rate: number): { stars: number; label: string } {
  if (rate < 0.42) return { stars: 3, label: t('diff.hard') }
  if (rate < 0.58) return { stars: 2, label: t('diff.balanced') }
  return { stars: 1, label: t('diff.easy') }
}

/** Millisecondes jusqu'au prochain minuit UTC. */
export function msToNextDay(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return next - now.getTime()
}
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}
