// Table des types (génération 4 : le moteur de combat est toujours en gen 4, voir session.ts).
// Pour chaque type attaquant : ses cibles « super efficace » (×2), « peu efficace » (×½) et « immunisées » (×0).
const CHART: Record<string, { x2?: string[]; half?: string[]; zero?: string[] }> = {
  Normal: { half: ['Rock', 'Steel'], zero: ['Ghost'] },
  Fire: { x2: ['Grass', 'Ice', 'Bug', 'Steel'], half: ['Fire', 'Water', 'Rock', 'Dragon'] },
  Water: { x2: ['Fire', 'Ground', 'Rock'], half: ['Water', 'Grass', 'Dragon'] },
  Electric: { x2: ['Water', 'Flying'], half: ['Electric', 'Grass', 'Dragon'], zero: ['Ground'] },
  Grass: { x2: ['Water', 'Ground', 'Rock'], half: ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'] },
  Ice: { x2: ['Grass', 'Ground', 'Flying', 'Dragon'], half: ['Fire', 'Water', 'Ice', 'Steel'] },
  Fighting: { x2: ['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], half: ['Poison', 'Flying', 'Psychic', 'Bug'], zero: ['Ghost'] },
  Poison: { x2: ['Grass'], half: ['Poison', 'Ground', 'Rock', 'Ghost'], zero: ['Steel'] },
  Ground: { x2: ['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], half: ['Grass', 'Bug'], zero: ['Flying'] },
  Flying: { x2: ['Grass', 'Fighting', 'Bug'], half: ['Electric', 'Rock', 'Steel'] },
  Psychic: { x2: ['Fighting', 'Poison'], half: ['Psychic', 'Steel'], zero: ['Dark'] },
  Bug: { x2: ['Grass', 'Psychic', 'Dark'], half: ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel'] },
  Rock: { x2: ['Fire', 'Ice', 'Flying', 'Bug'], half: ['Fighting', 'Ground', 'Steel'] },
  Ghost: { x2: ['Psychic', 'Ghost'], half: ['Dark', 'Steel'], zero: ['Normal'] },
  Dragon: { x2: ['Dragon'], half: ['Steel'] },
  Dark: { x2: ['Psychic', 'Ghost'], half: ['Fighting', 'Dark', 'Steel'] },
  Steel: { x2: ['Ice', 'Rock'], half: ['Fire', 'Water', 'Electric', 'Steel'] },
}
export const ALL_TYPES = Object.keys(CHART)

/** Multiplicateur d'une attaque de type `atk` sur un Pokémon de types `def`. */
export function typeMultiplier(atk: string, def: string[]): number {
  const e = CHART[atk]
  if (!e) return 1
  let m = 1
  for (const d of def) m *= e.zero?.includes(d) ? 0 : e.x2?.includes(d) ? 2 : e.half?.includes(d) ? 0.5 : 1
  return m
}

export interface Matchup { type: string; mult: number }
/** Faiblesses (×2, ×4) et résistances/immunités (×½, ×¼, ×0) d'un Pokémon, les plus marquées d'abord. */
export function matchups(types: string[]): { weak: Matchup[]; resist: Matchup[] } {
  const all = ALL_TYPES.map((type) => ({ type, mult: typeMultiplier(type, types) }))
  return {
    weak: all.filter((a) => a.mult > 1).sort((a, b) => b.mult - a.mult),
    resist: all.filter((a) => a.mult < 1).sort((a, b) => a.mult - b.mult),
  }
}
