import { lineInfo } from './lineinfo'
import { Dex } from '@pkmn/dex'
import { Battle, Teams, type PokemonSet } from '@pkmn/sim'
import { TeamGenerators } from '@pkmn/randoms'
import trainersGen1 from '../data/trainers.gen1.json'
import trainersGen2 from '../data/trainers.gen2.json'
import trainersGen3 from '../data/trainers.gen3.json'
import trainersGen4 from '../data/trainers.gen4.json'
import { aiChoose } from './ai'
import { dayKeyUTC, hashString, mulberry32, pick, seedArray } from './rng'

Teams.setGeneratorFactory(TeamGenerators)

export interface TrainerData {
  id: string
  name: string
  class: string
  gen: number
  game: string
  team: { species: string; item: string | null; moves: string[] }[]
}

/**
 * Génération du moteur de combat : toujours la 4 (493 espèces, mécaniques Diamant/Perle/Platine), quel que soit le
 * dresseur tiré. Les dresseurs des gens 1 à 4 s'affrontent donc avec leurs équipes d'origine converties en gen 4
 * (niveau 100, talents/natures par défaut), contre une équipe de joueur tirée dans tout le pool gen 4.
 * `DailyChallenge.gen` reste la génération d'origine du dresseur (ligue, jeu, historique, classement).
 */
export const BATTLE_GEN = 4

/** Générations pour lesquelles les données de dresseurs sont disponibles. */
const TRAINERS_BY_GEN: Record<number, TrainerData[]> = {
  1: trainersGen1 as TrainerData[],
  2: trainersGen2 as TrainerData[],
  3: trainersGen3 as TrainerData[],
  4: trainersGen4 as TrainerData[],
}
export { GAME_NAMES } from './names'
export const TRAINER_COUNTS: Record<number, number> = Object.fromEntries(Object.entries(TRAINERS_BY_GEN).map(([g, t]) => [g, t.length]))
export const AVAILABLE_GENS = Object.keys(TRAINERS_BY_GEN).map(Number)

export interface PreviewMon {
  species: string
  types: string[]
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  moves: { name: string; type: string; power: number; category: string }[]
  item: string
  ability: string
  nature: string
  // Données du sprite généré (voir sprites.ts)
  num: number
  root: number
  stage: number
  heightm: number
  bst: number
}

function previewOf(set: PokemonSet, gen: number): PreviewMon {
  const dex = Dex.forGen(gen)
  const sp = dex.species.get(set.species)
  const nature = set.nature ? dex.natures.get(set.nature) : undefined
  // Même formule que le moteur (niveau 100) ; en gens 1-2 il n'y a qu'une stat Spécial.
  const calc = (k: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe') => {
    const base = gen <= 2 && k === 'spd' ? sp.baseStats.spa : sp.baseStats[k]
    const core = Math.floor(((2 * base + set.ivs[k] + Math.floor(set.evs[k] / 4)) * 100) / 100)
    if (k === 'hp') return core + 110
    const raw = core + 5
    return nature?.plus === k ? Math.floor(raw * 1.1) : nature?.minus === k ? Math.floor(raw * 0.9) : raw
  }
  return {
    species: sp.name,
    types: [...sp.types],
    stats: { hp: calc('hp'), atk: calc('atk'), def: calc('def'), spa: calc('spa'), spd: calc('spd'), spe: calc('spe') },
    moves: set.moves.map((m) => {
      const mv = dex.moves.get(m)
      return { name: mv.name, type: mv.type, power: mv.basePower, category: mv.category }
    }),
    item: set.item,
    ability: set.ability,
    nature: set.nature,
    ...lineInfo(dex, sp),
  }
}

export interface DailyChallenge {
  dayKey: string
  gen: number
  trainer: TrainerData
  playerTeam: PokemonSet[]
  opponentTeam: PokemonSet[]
  battleSeed: [number, number, number, number]
  estimatedWinRate: number
  playerPreview: PreviewMon[]
  opponentPreview: PreviewMon[]
}

function normalize(set: Partial<PokemonSet> & { species: string }, gen: number): PokemonSet {
  const sp = Dex.forGen(gen).species.get(set.species)
  // Gens 1-2 : points d'effort maximaux (255) et DV 15 (= IV 30) ; gen 3+ : 85 PE répartis, IV 31.
  const old = gen <= 2
  const stat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
  return {
    name: sp.baseSpecies,
    species: sp.name,
    item: gen >= 2 ? set.item ?? '' : '',
    ability: gen >= 3 ? set.ability || sp.abilities['0'] : '',
    moves: set.moves ?? [],
    nature: gen >= 3 ? set.nature ?? 'Serious' : '',
    gender: set.gender ?? '',
    evs: set.evs ?? stat(old ? 255 : 85),
    ivs: set.ivs ?? stat(old ? 30 : 31),
    level: 100,
  } as PokemonSet
}

function randomTeam(
  gen: number,
  seed: [number, number, number, number],
  exclude: Set<string>,
  count: number,
  themeTypes?: Set<string>,
) {
  const g = Teams.getGenerator(`gen${gen}randombattle`, seed as any)
  const dex = Dex.forGen(gen)
  const out: PokemonSet[] = []
  // 1re passe : seulement les espèces qui partagent un type avec le dresseur ; 2e passe : sans contrainte.
  for (const strict of themeTypes ? [true, false] : [false]) {
    let guard = 0
    while (out.length < count && guard++ < (strict ? 40 : 10)) {
      for (const s of g.getTeam()) {
        const sp = dex.species.get(s.species)
        if (exclude.has(sp.baseSpecies)) continue
        if (strict && !sp.types.some((t) => themeTypes!.has(t))) continue
        exclude.add(sp.baseSpecies)
        out.push(normalize({ ...s, level: 100 }, gen))
        if (out.length === count) break
      }
    }
  }
  return out
}

function buildOpponent(trainer: TrainerData, gen: number, seed: [number, number, number, number]) {
  const used = new Set<string>()
  const team: PokemonSet[] = trainer.team.map((m) => {
    const sp = Dex.forGen(gen).species.get(m.species)
    used.add(sp.baseSpecies)
    return normalize({ species: sp.name, item: m.item ?? '', moves: m.moves }, gen)
  })
  if (team.length < 6) {
    // Thème : les types les plus fréquents de l'équipe d'origine du dresseur.
    const count = new Map<string, number>()
    for (const m of trainer.team) for (const t of Dex.forGen(gen).species.get(m.species).types) count.set(t, (count.get(t) ?? 0) + 1)
    const top = Math.max(...count.values())
    const theme = new Set([...count].filter(([, n]) => n >= Math.max(1, top - 1)).map(([t]) => t as string))
    team.push(...randomTeam(gen, seed, used, 6 - team.length, theme))
  }
  return team
}

function simulateOnce(gen: number, a: PokemonSet[], b: PokemonSet[], seed: number): 0 | 1 | null {
  const battle = new Battle({
    formatid: `gen${gen}customgame` as any,
    seed: seedArray(seed) as any,
    p1: { name: 'A', team: Teams.pack(a) as any },
    p2: { name: 'B', team: Teams.pack(b) as any },
  } as any)
  let guard = 0
  while (!battle.ended && guard++ < 400) {
    battle.makeChoices(aiChoose(battle, 0, gen), aiChoose(battle, 1, gen))
  }
  if (battle.winner === 'A') return 0
  if (battle.winner === 'B') return 1
  return null
}

export function winRate(gen: number, player: PokemonSet[], opp: PokemonSet[], n: number, seed: number) {
  let wins = 0
  for (let i = 0; i < n; i++) if (simulateOnce(gen, player, opp, seed + i * 7919) === 0) wins++
  return wins / n
}

export interface BalanceOptions {
  candidates?: number
  simsPerCandidate?: number
  min?: number
  max?: number
}

/** Construit le défi du jour : même résultat pour tout le monde pour une clé de jour donnée. */
export function buildDaily(dayKey = dayKeyUTC(), opts: BalanceOptions = {}): DailyChallenge {
  const { candidates = 14, simsPerCandidate = 8, min = 0.35, max = 0.65 } = opts
  const baseSeed = hashString(`pokedle:${dayKey}`)
  const rand = mulberry32(baseSeed)
  const gen = pick(rand, AVAILABLE_GENS) // génération d'origine du dresseur
  const trainer = pick(rand, TRAINERS_BY_GEN[gen])
  const opponentTeam = buildOpponent(trainer, BATTLE_GEN, seedArray(baseSeed ^ 0xa5a5))

  const taken = new Set(opponentTeam.map((s) => Dex.forGen(BATTLE_GEN).species.get(s.species).baseSpecies))
  let best: { team: PokemonSet[]; rate: number } | null = null
  for (let c = 0; c < candidates; c++) {
    const team = randomTeam(BATTLE_GEN, seedArray(baseSeed + 1000 * (c + 1)), new Set(), 6)
    // une équipe candidate peut partager des espèces avec l'adversaire, c'est autorisé
    void taken
    const rate = winRate(BATTLE_GEN, team, opponentTeam, simsPerCandidate, baseSeed + c)
    if (rate >= min && rate <= max) {
      best = { team, rate }
      break
    }
    if (!best || Math.abs(rate - 0.5) < Math.abs(best.rate - 0.5)) best = { team, rate }
  }
  return {
    dayKey,
    gen,
    trainer,
    playerTeam: best!.team,
    opponentTeam,
    battleSeed: seedArray(baseSeed ^ 0x5eed),
    estimatedWinRate: best!.rate,
    playerPreview: best!.team.map((m) => previewOf(m, BATTLE_GEN)),
    opponentPreview: opponentTeam.map((m) => previewOf(m, BATTLE_GEN)),
  }
}
