import { Dex } from '@pkmn/dex'
import type { Battle } from '@pkmn/sim'
import { aiChooseSmart } from './aiSmart'

/** Niveau 1 : IA simple (jours avant HARD_FROM, inchangée pour que les combats déjà joués se rejouent à l'identique). Niveau 2 : voir aiSmart.ts. */
export type AiLevel = 1 | 2

/** IA simple : choisit l'attaque au meilleur dégât estimé, change seulement si forcée. */
export function aiChoose(battle: Battle, sideIdx: 0 | 1, gen: number, level: AiLevel = 1): string {
  if (level === 2) return aiChooseSmart(battle, sideIdx, gen)
  const side = battle.sides[sideIdx]
  const req = side.activeRequest as any
  if (!req) return 'default'
  if (req.forceSwitch) {
    const alive = side.pokemon
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !p.fainted && !p.isActive)
    if (!alive.length) return 'default'
    const foe = battle.sides[1 - sideIdx].active[0]
    const best = alive
      .map(({ p, i }) => ({ i, score: matchup(p.species.types, foe?.species.types ?? [], gen) }))
      .sort((a, b) => b.score - a.score)[0]
    return `switch ${best.i + 1}`
  }
  const active = req.active?.[0]
  if (!active) return 'default'
  const me = side.active[0]
  const foe = battle.sides[1 - sideIdx].active[0]
  const dex = Dex.forGen(gen)
  let bestIdx = -1
  let bestScore = -1
  active.moves.forEach((m: any, i: number) => {
    if (m.disabled || (m.pp !== undefined && m.pp <= 0)) return
    const mv = dex.moves.get(m.id)
    let score = 0
    if (mv.category === 'Status') {
      score = 25
    } else {
      let mult = 1
      for (const t of foe?.species.types ?? []) {
        const eff = dex.getEffectiveness(mv.type, t as any)
        mult *= Math.pow(2, eff)
        if (dex.getImmunity(mv.type, t as any) === false) mult = 0
      }
      const stab = me?.species.types.includes(mv.type) ? 1.5 : 1
      const acc = mv.accuracy === true ? 1 : (mv.accuracy as number) / 100
      score = (mv.basePower || 40) * mult * stab * acc
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return bestIdx >= 0 ? `move ${bestIdx + 1}` : 'move 1'
}

function matchup(mine: readonly string[], theirs: readonly string[], gen: number): number {
  const dex = Dex.forGen(gen)
  let s = 0
  for (const a of mine) for (const d of theirs) s += Math.pow(2, dex.getEffectiveness(a as any, d as any))
  for (const a of theirs) for (const d of mine) s -= Math.pow(2, dex.getEffectiveness(a as any, d as any))
  return s
}
