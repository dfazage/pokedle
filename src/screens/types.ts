import type { DailyChallenge } from '../game/daily'
import type { DayRecord, Stats } from '../game/history'
import type { Screen } from '../ui/kit'

export interface Ctx {
  today: string
  challenge: DailyChallenge
  history: DayRecord[]
  stats: Stats
  username: string | null
  email: string | null
  world: { players: number; wins: number } | null
  inProgress: boolean
  go: (s: Screen) => void
  onPlay: () => void
  /** Ordre de l'équipe du joueur (modifiable tant que le combat n'a pas commencé). */
  moveMon: (from: number, to: number) => void
  orderLocked: boolean
  isAdmin: boolean
  /** Admin : efface le combat du jour (serveur + local) pour le rejouer. */
  onAdminReset: () => void
  onAdminReroll: () => void
}
