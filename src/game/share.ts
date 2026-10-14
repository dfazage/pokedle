// Partage du résultat du jour, façon Wordle : texte compact + grille d'émojis, sans aucun spoiler (ni nom de Pokémon ni d'attaque).
// Module pur (aucune dépendance React / DOM au chargement) pour rester testable avec scripts/test_share.ts.
//
// Grille : une ligne « toi » ➜ une ligne « adversaire », une case par Pokémon.
//   toi        🟩 en vie · 🟨 en vie mais sous 30 % de PV · 🟥 K.O.
//   adversaire ⬛ K.O. · 🟦 encore debout
// Le détail par Pokémon n'est connu qu'au moment du combat : on le garde en local (clé par jour). Pour un résultat venu du serveur
// (autre appareil), on retombe sur une grille déduite des compteurs `survivors` / `kos`, qui est juste en nombre mais pas en ordre.
import { GEN_INFO, trainerName } from './fr'
import type { DayRecord } from './history'
import { t, tn } from '../i18n'

export interface ShareGrid {
  /** Un caractère par Pokémon du joueur : g = en vie, y = en vie sous 30 % de PV, r = K.O. */
  you: string
  /** Un caractère par Pokémon adverse : x = K.O., o = debout. */
  foe: string
}

const LOW_HP = 0.3
const EMOJI: Record<string, string> = { g: '🟩', y: '🟨', r: '🟥', x: '⬛', o: '🟦' }
const YOU_RX = /^[gyr]{1,6}$/
const FOE_RX = /^[xo]{1,6}$/

interface TeamMon {
  hp: number
  maxhp: number
  fainted: boolean
}

/** Grille de fin de combat à partir des équipes (dans l'ordre d'équipe). */
export function gridFromTeams(player: TeamMon[], opponent: { fainted: boolean }[]): ShareGrid {
  return {
    you: player.map((m) => (m.fainted || m.hp <= 0 ? 'r' : m.hp / Math.max(1, m.maxhp) < LOW_HP ? 'y' : 'g')).join(''),
    foe: opponent.map((m) => (m.fainted ? 'x' : 'o')).join(''),
  }
}

const clampTeam = (n: number) => Math.min(6, Math.max(0, Math.round(n)))

/** Grille déduite des seuls compteurs de l'historique (survivants d'abord). */
export function fallbackGrid(rec: Pick<DayRecord, 'result' | 'survivors' | 'kos'>): ShareGrid {
  const win = rec.result === 'win'
  const alive = clampTeam(rec.survivors ?? (win ? 1 : 0))
  const kos = clampTeam(rec.kos ?? (win ? 6 : 0))
  return { you: 'g'.repeat(alive) + 'r'.repeat(6 - alive), foe: 'x'.repeat(kos) + 'o'.repeat(6 - kos) }
}

const gridKey = (day: string) => `pokedle:grid:${day}`

export function saveGrid(day: string, grid: ShareGrid) {
  try {
    localStorage.setItem(gridKey(day), JSON.stringify(grid))
  } catch {
    /* stockage indisponible : le partage retombera sur la grille déduite */
  }
}

function loadGrid(day: string): ShareGrid | null {
  try {
    const g = JSON.parse(localStorage.getItem(gridKey(day)) ?? 'null') as Partial<ShareGrid> | null
    return g && typeof g.you === 'string' && typeof g.foe === 'string' && YOU_RX.test(g.you) && FOE_RX.test(g.foe) ? (g as ShareGrid) : null
  } catch {
    return null
  }
}

const count = (s: string, c: string) => s.split(c).length - 1

/** Grille à partager pour `rec` : celle enregistrée en local si elle colle aux compteurs de l'historique, sinon une grille déduite. */
export function gridFor(day: string, rec: DayRecord, stored: ShareGrid | null = loadGrid(day)): ShareGrid {
  if (stored) {
    const youOk = rec.survivors == null || stored.you.length - count(stored.you, 'r') === rec.survivors
    const foeOk = rec.kos == null || count(stored.foe, 'x') === rec.kos
    if (youOk && foeOk) return stored
  }
  return fallbackGrid(rec)
}

const toEmoji = (s: string) => [...s].map((c) => EMOJI[c] ?? '⬛').join('')

export interface ShareInput {
  rec: DayRecord
  /** Numéro du défi (#142). */
  dayNo: number
  grid: ShareGrid
  /** Série de victoires en cours (affichée si ≥ 2). */
  streak: number
  /** Points du jour (victoire uniquement). */
  points?: number
  /** Adresse du jeu, déjà sans « / » final. */
  url: string
}

/** Texte complet à partager. Les lignes vides sont omises. */
export function buildShareText({ rec, dayNo, grid, streak, points, url }: ShareInput): string {
  const win = rec.result === 'win'
  const game = GEN_INFO[rec.gen]?.game
  const lines = [
    `Pokébadle Battle #${dayNo} ⚔️`,
    [trainerName(rec.trainer), game, `${win ? t('share.win') : t('share.loss')} ${win ? '🏆' : '💀'}`].filter(Boolean).join(' · '),
    `${toEmoji(grid.you)} ➜ ${toEmoji(grid.foe)}`,
    [
      `⏱ ${tn('share.turns', rec.turns)}`,
      rec.hpLeft != null ? `💚 ${t('share.hp', { n: rec.hpLeft })}` : '',
      win && streak >= 2 ? `🔥 ${t('share.streak', { n: streak })}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    [win && points ? `+${points} pts` : '', (rec.attempts ?? 1) > 1 ? `💔 ${t('share.attempt', { n: rec.attempts })}` : ''].filter(Boolean).join(' · '),
  ].filter(Boolean)
  return `${lines.join('\n')}\n\n${t('res.shareCta')} ${url}`
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** Vrai si le navigateur propose la feuille de partage native (mobile, Safari, Edge…). */
export const canNativeShare = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* page non sécurisée ou permission refusée : on essaie la méthode de secours */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/** Copie seulement. */
export async function copyShare(text: string): Promise<ShareOutcome> {
  return (await copyToClipboard(text)) ? 'copied' : 'failed'
}

/** Feuille de partage native si disponible ; copie dans le presse-papiers sinon, ou si le partage natif échoue autrement
 *  que par une annulation de l'utilisateur. */
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (canNativeShare()) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  return copyShare(text)
}
