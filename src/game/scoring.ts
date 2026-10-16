// Système de points : mix pondéré de la performance (rapidité, PV restants, survivants), pondéré par la difficulté du
// dresseur, la série en cours et un bonus « sans K.O. ». Tout est dérivé du DayRecord : le même historique donne
// toujours les mêmes points, en local comme en ligne. Les poids vivent dans SCORING pour être ajustés sans toucher au code.
import tiers from '../data/tiers.json'
import { cmpRec, prevDay, recId, type DayRecord } from './history'

export const SCORING = {
  /** Points de base selon la classe du dresseur (`class` dans src/data/trainers*.json). */
  baseByClass: {
    'Gym Leader': 50,
    'Kanto Gym Leader': 50,
    Rival: 75,
    'Team Executive': 75,
    'Elite Four': 100,
    'Team Boss': 125,
    Champion: 150,
    'Former Champion': 150,
  } as Record<string, number>,
  defaultBase: 50,
  /** Poids de la performance P (somme = 1). L'originalité de l'équipe est exclue : l'équipe du joueur est imposée à tous. */
  weights: { speed: 0.45, hp: 0.35, survivors: 0.2 },
  /** Victoire en `turnsFast` tours ou moins = rapidité maximale ; `turnsSlow` tours ou plus = rapidité nulle. */
  turnsFast: 8,
  turnsSlow: 40,
  /** Part de la base garantie à toute victoire ; le reste dépend de P. */
  floor: 0.5,
  /** Multiplicateur de série : 1 + streakStep × min(jours consécutifs, streakCap). */
  streakStep: 0.05,
  streakCap: 10,
  /** Bonus fixe quand aucun Pokémon du joueur n'est K.O. */
  flawlessBonus: 10,
  /** Multiplicateur selon l'essai de la victoire (système de cœurs) : 1er essai ×1, chaque rejeu retire 25 %. Au-delà du tableau : dernière valeur. */
  attemptMult: [1, 0.75, 0.5, 0.25],
  teamSize: 6,
}

export interface ScoreBreakdown {
  points: number
  base: number
  /** Facteurs normalisés 0..1. */
  speed: number
  hp: number
  survivors: number
  /** Performance pondérée 0..1. */
  perf: number
  streak: number
  streakMult: number
  flawless: boolean
  /** Essai de la victoire (1 = premier essai) et multiplicateur de points associé. */
  attempt: number
  attemptMult: number
}

export interface ScoreSummary {
  total: number
  byDay: Map<string, ScoreBreakdown>
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Points de base d'un dresseur, d'après sa classe (table générée par scripts/build_tiers.ts). */
export function baseFor(gen: number, trainer: string): number {
  const cls = (tiers as Record<string, string>)[`${gen}|${trainer}`]
  return (cls && SCORING.baseByClass[cls]) || SCORING.defaultBase
}

/** Adversaire redoutable : une victoire contre lui rapporte nettement plus (affiché par une aura enflammée). */
export const isFormidable = (gen: number, trainer: string): boolean => baseFor(gen, trainer) >= 100

export function scoreRecord(r: DayRecord, streak: number): ScoreBreakdown {
  const S = SCORING
  const base = baseFor(r.gen, r.trainer)
  const survivors = clamp01((r.survivors ?? 0) / S.teamSize)
  // Anciennes parties sans PV enregistrés : on estime avec la part de survivants.
  const hp = r.hpLeft != null ? clamp01(r.hpLeft / 100) : survivors
  const speed = clamp01((S.turnsSlow - r.turns) / (S.turnsSlow - S.turnsFast))
  const perf = S.weights.speed * speed + S.weights.hp * hp + S.weights.survivors * survivors
  const streakMult = 1 + S.streakStep * Math.min(streak, S.streakCap)
  const flawless = r.result === 'win' && r.survivors === S.teamSize
  const attempt = Math.max(1, r.attempts ?? 1)
  const attemptMult = S.attemptMult[Math.min(attempt, S.attemptMult.length) - 1]
  const raw = base * (S.floor + (1 - S.floor) * perf) * streakMult + (flawless ? S.flawlessBonus : 0)
  const points = r.result === 'win' ? Math.round(raw * attemptMult) : 0
  return { points, base, speed, hp, survivors, perf, streak, streakMult, flawless, attempt, attemptMult }
}

/** `byDay` est indexé par recId (le combat n°1 garde la clé du jour, le n°2 ajoute « ~2 »). La série compte des JOURS gagnés. */
export function scoreHistory(history: DayRecord[]): ScoreSummary {
  const byDay = new Map<string, ScoreBreakdown>()
  let total = 0
  let run = 0
  let prevWin: string | null = null // dernier jour gagné
  for (const r of [...history].sort(cmpRec)) {
    if (r.result === 'win' && r.dayKey !== prevWin) {
      run = prevWin && prevDay(r.dayKey) === prevWin ? run + 1 : 1
      prevWin = r.dayKey
    }
    // Un jour entièrement perdu casse la série : la victoire suivante repart de 1 (jour non consécutif au dernier jour gagné).
    const s = scoreRecord(r, r.result === 'win' ? run : 0)
    byDay.set(recId(r), s)
    total += s.points
  }
  return { total, byDay }
}
