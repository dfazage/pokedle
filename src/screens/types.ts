import type { DailyChallenge } from '../game/daily'
import type { DayRecord, Stats } from '../game/history'
import type { HeartsInfo } from '../game/hearts'
import type { RenameResult } from '../game/cloud'
import type { ScoreSummary } from '../game/scoring'
import type { Screen } from '../ui/kit'

export interface Ctx {
  today: string
  challenge: DailyChallenge
  history: DayRecord[]
  stats: Stats
  score: ScoreSummary
  username: string | null
  /** Icône de profil choisie (id de src/game/avatars.ts), null = initiale du pseudo. */
  avatar: string | null
  /** Change l'icône de profil. */
  onAvatar: (id: string) => void
  /** Change le pseudo du compte connecté. */
  onRename: (name: string) => Promise<RenameResult>
  email: string | null
  world: { players: number; wins: number } | null
  inProgress: boolean
  /** Le combat du jour est terminé (aucun rejeu en cours). */
  done: boolean
  hearts: HeartsInfo
  /** Dépense 1 cœur et relance le combat du jour après une défaite. */
  onReplay: () => void
  go: (s: Screen) => void
  onPlay: () => void
  /** Ordre de l'équipe du joueur (modifiable tant que le combat n'a pas commencé). */
  moveMon: (from: number, to: number) => void
  orderLocked: boolean
  isAdmin: boolean
  /** Admin : efface le combat du jour (serveur + local) pour le rejouer. */
  onAdminReset: () => void
  onAdminReroll: () => void
  /** Admin : efface le combat du jour de tous les joueurs. */
  onAdminResetAll: () => void
}
