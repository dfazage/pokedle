import { lineInfo } from './lineinfo'
import { Dex } from '@pkmn/dex'
import { Battle, Teams, type PokemonSet } from '@pkmn/sim'
import { TeamGenerators } from '@pkmn/randoms'
import trainersGen1 from '../data/trainers.gen1.json'
import trainersGen2 from '../data/trainers.gen2.json'
import trainersGen3 from '../data/trainers.gen3.json'
import trainersGen4 from '../data/trainers.gen4.json'
import trainersGen5 from '../data/trainers.gen5.json'
import extraGen1 from '../data/trainers.extra.gen1.json'
import extraGen2 from '../data/trainers.extra.gen2.json'
import extraGen3 from '../data/trainers.extra.gen3.json'
import extraGen4 from '../data/trainers.extra.gen4.json'
import extraGen5 from '../data/trainers.extra.gen5.json'
import { aiChoose, type AiLevel } from './ai'
import { applyProfile } from './profiles'
import { addDays, DOUBLE_FROM_KEY, gameDayKey, hashString, mulberry32, pick, seedArray, slotsPerDay } from './rng'

Teams.setGeneratorFactory(TeamGenerators)

export interface TrainerData {
  id: string
  name: string
  class: string
  gen: number
  game: string
  /** Id du sprite Showdown si différent de `id` (ex. `giovanni` pour `giovanni-rocket`). */
  sprite?: string
  /** Lieu du combat, quand le même dresseur apparaît plusieurs fois (ex. Giovanni : Repaire Rocket / Sylphe SARL). */
  stage?: string | null
  team: { species: string; item: string | null; moves: string[] }[]
}

/**
 * Génération du moteur de combat : 5 à partir de GEN5_FROM (649 espèces, mécaniques Noir/Blanc), 4 avant (493 espèces,
 * Diamant/Perle/Platine). Quel que soit le dresseur tiré, tous s'affrontent dans le moteur du jour : les équipes d'origine
 * des gens 1 à 4 sont converties (niveau 100, nature/EV/talent/objet d'après les profils Pokémon Showdown les plus joués,
 * voir profiles.ts), contre une équipe de joueur tirée dans tout le pool de la génération du moteur.
 * `DailyChallenge.gen` reste la génération d'origine du dresseur (ligue, jeu, historique, classement) et
 * `DailyChallenge.battleGen` celle du moteur utilisée pour ce défi (stockée dans le défi : le combat se rejoue à l'identique).
 */
export const BATTLE_GEN = 5
/** Moteur utilisé avant GEN5_FROM. */
export const LEGACY_BATTLE_GEN = 4
/**
 * Première clé de jour (UTC) jouée avec le moteur gen 5 et le pool de dresseurs de la gen 5. Les jours précédents (et celui en
 * cours au moment du déploiement) gardent exactement le même défi, puisque le tirage dépend du pool et de la génération du moteur.
 */
export const GEN5_FROM = '2026-10-15'
/**
 * Premier jour où les dresseurs de gen 5 (Noir 2/Blanc 2) entrent dans le tirage. Le moteur gen 5 démarre dès GEN5_FROM, mais le
 * dresseur du 15/10 (Steven) reste celui du tirage d'origine à 4 générations : ajouter la gen 5 au pool aurait changé ce tirage.
 */
export const GEN5_TRAINERS_FROM = '2026-10-16'
/**
 * Première clé de jour jouée avec l'adversaire « niveau 2 » (aiSmart.ts : change de Pokémon, cherche le KO, utilise statuts et boosts)
 * et l'équilibrage recalibré dessus. Les jours précédents gardent l'IA d'origine : leurs combats doivent se rejouer à l'identique.
 * Même instant que le passage à 2 combats par jour (DOUBLE_FROM_KEY).
 */
export const HARD_FROM = DOUBLE_FROM_KEY
export const aiLevelFor = (dayKey: string): AiLevel => (dayKey >= HARD_FROM ? 2 : 1)
/**
 * Format Showdown du combat. Les gens 4 et 5 partagent les mêmes règles : « Custom Game » en 6v6, sans aperçu des équipes
 * (la gen 5 l'active par défaut ; l'ordre des Pokémon est choisi avant le combat dans l'app, le premier mène).
 */
export const battleFormat = (gen: number): string => `gen${gen}customgame${gen >= 5 ? '@@@!Team Preview' : ''}`
/** Génération du moteur pour une clé de jour donnée. */
export const battleGenFor = (dayKey: string): number => (dayKey >= GEN5_FROM ? BATTLE_GEN : LEGACY_BATTLE_GEN)

/** Générations pour lesquelles les données de dresseurs sont disponibles. */
const TRAINERS_BY_GEN: Record<number, TrainerData[]> = {
  1: trainersGen1 as TrainerData[],
  2: trainersGen2 as TrainerData[],
  3: trainersGen3 as TrainerData[],
  4: trainersGen4 as TrainerData[],
  5: trainersGen5 as TrainerData[],
}
/**
 * Dresseurs « hors ligue » (boss et admins d'équipe, rivaux, Pierre Rochard…), voir scripts/extract_extra.py.
 * Ils n'entrent dans le tirage qu'à partir de EXTRA_FROM : les jours déjà passés (et celui en cours au moment du
 * déploiement) gardent exactement le même dresseur, puisque le tirage dépend de la taille du pool.
 */
export const EXTRA_FROM = '2026-10-13'
const EXTRA_BY_GEN: Record<number, TrainerData[]> = {
  1: extraGen1 as TrainerData[],
  2: extraGen2 as TrainerData[],
  3: extraGen3 as TrainerData[],
  4: extraGen4 as TrainerData[],
  5: extraGen5 as TrainerData[],
}
/** Un re-tirage admin (salt > 0) remplace de toute façon le défi du jour : il peut donc piocher dans tout le pool, extras compris. */
const poolFor = (gen: number, dayKey: string, salt = 0) => (salt > 0 || dayKey >= EXTRA_FROM ? [...TRAINERS_BY_GEN[gen], ...EXTRA_BY_GEN[gen]] : TRAINERS_BY_GEN[gen])
export { GAME_NAMES } from './names'
export const TRAINER_COUNTS: Record<number, number> = Object.fromEntries(Object.entries(TRAINERS_BY_GEN).map(([g, t]) => [g, t.length + EXTRA_BY_GEN[Number(g)].length]))
export const AVAILABLE_GENS = Object.keys(TRAINERS_BY_GEN).map(Number)
/** Générations d'origine tirables pour une clé de jour : la gen 5 n'entre dans le tirage qu'à partir de GEN5_FROM. */
const gensFor = (dayKey: string): number[] => (dayKey >= GEN5_TRAINERS_FROM ? AVAILABLE_GENS : AVAILABLE_GENS.filter((g) => g <= LEGACY_BATTLE_GEN))

export interface PreviewMon {
  species: string
  types: string[]
  stats: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number }
  moves: { name: string; type: string; power: number; category: string; acc: number; pp: number; priority: number; target: string }[]
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
      return { name: mv.name, type: mv.type, power: mv.basePower, category: mv.category, acc: mv.accuracy === true ? 0 : mv.accuracy, pp: mv.pp, priority: mv.priority, target: mv.target }
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
  /** Génération du moteur de combat de ce défi (4 avant GEN5_FROM, 5 ensuite). */
  battleGen: number
  trainer: TrainerData
  playerTeam: PokemonSet[]
  opponentTeam: PokemonSet[]
  /** N° du combat dans le jour (1 ou 2). */
  slot: number
  battleSeed: [number, number, number, number]
  estimatedWinRate: number
  playerPreview: PreviewMon[]
  opponentPreview: PreviewMon[]
}

function normalize(set: Partial<PokemonSet> & { species: string }, gen: number, profile?: { ability?: boolean; item?: boolean }): PokemonSet {
  const sp = Dex.forGen(gen).species.get(set.species)
  // Gens 1-2 : points d'effort maximaux (255) et DV 15 (= IV 30) ; gen 3+ : 85 PE répartis, IV 31.
  const old = gen <= 2
  const stat = (v: number) => ({ hp: v, atk: v, def: v, spa: v, spd: v, spe: v })
  const base = {
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
  // Gens 4 et 5 : nature / EV (et talent / objet des dresseurs) d'après les profils les plus joués sur Pokémon Showdown, IV à 31.
  return gen >= 4 && profile ? applyProfile(base, Dex.forGen(gen), profile) : base
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
        out.push(normalize({ ...s, level: 100 }, gen, {}))
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
    return normalize({ species: sp.name, item: m.item ?? '', moves: m.moves }, gen, { ability: true, item: true })
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

function simulateOnce(gen: number, a: PokemonSet[], b: PokemonSet[], seed: number, level: AiLevel = 1): 0 | 1 | null {
  const battle = new Battle({
    formatid: battleFormat(gen) as any,
    seed: seedArray(seed) as any,
    p1: { name: 'A', team: Teams.pack(a) as any },
    p2: { name: 'B', team: Teams.pack(b) as any },
  } as any)
  let guard = 0
  while (!battle.ended && guard++ < 400) {
    battle.makeChoices(aiChoose(battle, 0, gen, level), aiChoose(battle, 1, gen, level))
  }
  if (battle.winner === 'A') return 0
  if (battle.winner === 'B') return 1
  return null
}

/** Taux de victoire simulé de `player` contre `opp` ; les deux camps jouent avec l'IA `level` (le joueur de référence a le niveau de l'adversaire). */
export function winRate(gen: number, player: PokemonSet[], opp: PokemonSet[], n: number, seed: number, level: AiLevel = 1) {
  let wins = 0
  for (let i = 0; i < n; i++) if (simulateOnce(gen, player, opp, seed + i * 7919, level) === 0) wins++
  return wins / n
}

export interface BalanceOptions {
  candidates?: number
  simsPerCandidate?: number
  /** Sel de re-roll (admin) : 0 = tirage d'origine, n > 0 = n-ième re-tirage du jour. */
  salt?: number
  /** N° du combat dans le jour (1 par défaut ; 2 à partir de DOUBLE_FROM_KEY). */
  slot?: number
  /** Parties de confirmation supplémentaires pour une équipe qui passe la première mesure (0 = aucune). */
  confirmSims?: number
  /** Taux de victoire visé par la simulation (l'équipe candidate la plus proche est retenue). */
  target?: number
  min?: number
  max?: number
}

/** Premier jour où la règle « jamais deux fois le même dresseur à la suite » s'applique (les jours avant gardent leur tirage). */
export const NO_REPEAT_FROM = '2026-10-16'

/** Graine de texte d'un combat : le n°1 garde celle d'avant les 2 combats par jour (mêmes tirages pour les jours passés). */
const seedText = (dayKey: string, slot: number, salt = 0) => `pokedle:${dayKey}${slot > 1 ? `:s${slot}` : ''}${salt ? `:${salt}` : ''}`

/** Dresseur du combat précédent : le n°1 du jour dépend du dernier combat de la veille, le n°2 du n°1 du même jour. */
const previousTrainer = (dayKey: string, slot: number): string | null =>
  slot > 1 ? dailyTrainerName(dayKey, slot - 1) : dayKey >= NO_REPEAT_FROM ? dailyTrainerName(addDays(dayKey, -1), slotsPerDay(addDays(dayKey, -1))) : null

/** Nom du dresseur tiré pour le combat `slot` de `dayKey` (sans équipes ni simulations : léger). Mémoïsé, la règle de non-répétition dépend du combat précédent. */
const nameMemo = new Map<string, string>()
export function dailyTrainerName(dayKey: string, slot = 1): string {
  const memoKey = `${dayKey}~${slot}`
  const hit = nameMemo.get(memoKey)
  if (hit) return hit
  const rand = mulberry32(hashString(seedText(dayKey, slot)))
  const prev = previousTrainer(dayKey, slot)
  let name: string
  let guard = 0
  do {
    const gen = pick(rand, gensFor(dayKey))
    name = pick(rand, poolFor(gen, dayKey)).name
  } while (prev !== null && name === prev && guard++ < 50)
  nameMemo.set(memoKey, name)
  return name
}

/**
 * Cibles d'équilibrage. Jusqu'à HARD_FROM : deux IA simples, équipes retenues à 35-65 % (centre 50 %) ; en pratique les joueurs, qui
 * jouent bien mieux que cette IA (changements, choix des attaques), gagnaient près de 90 % du temps. Ensuite : les deux camps jouent
 * avec l'IA de niveau 2, qui sert de joueur de référence, et on vise ~65 % en simulation (≈ 70-75 % réels, voir scripts/calib_ai.ts).
 */
const BALANCE = {
  legacy: { candidates: 14, simsPerCandidate: 8, confirmSims: 0, min: 0.35, max: 0.65, target: 0.5 },
  hard: { candidates: 10, simsPerCandidate: 6, confirmSims: 14, min: 0.55, max: 0.8, target: 0.67 },
}

/** Construit le défi du combat `opts.slot` de la journée : même résultat pour tout le monde pour une clé de jour donnée. */
export function buildDaily(dayKey = gameDayKey(), opts: BalanceOptions = {}): DailyChallenge {
  const level = aiLevelFor(dayKey)
  const bal = level === 2 ? BALANCE.hard : BALANCE.legacy
  const { candidates = bal.candidates, simsPerCandidate = bal.simsPerCandidate, confirmSims = bal.confirmSims, min = bal.min, max = bal.max, target = bal.target, salt = 0, slot = 1 } = opts
  const baseSeed = hashString(seedText(dayKey, slot, salt))
  const rand = mulberry32(baseSeed)
  const battleGen = battleGenFor(dayKey)
  // Génération d'origine + dresseur. À partir de NO_REPEAT_FROM, jamais deux fois le même dresseur (même nom, toutes versions
  // confondues) deux jours de suite : on re-tire (suite du même PRNG) tant que c'est celui de la veille. Un jour sans doublon garde
  // donc exactement son tirage d'origine ; un re-tirage admin (salt > 0) remplace le défi et ignore la règle.
  const prev = salt === 0 && dayKey >= NO_REPEAT_FROM ? previousTrainer(dayKey, slot) : null
  let gen: number
  let trainer: TrainerData
  let guard = 0
  do {
    gen = pick(rand, gensFor(dayKey)) // génération d'origine du dresseur
    trainer = pick(rand, poolFor(gen, dayKey, salt))
  } while (prev !== null && trainer.name === prev && guard++ < 50)
  const opponentTeam = buildOpponent(trainer, battleGen, seedArray(baseSeed ^ 0xa5a5))

  const taken = new Set(opponentTeam.map((s) => Dex.forGen(battleGen).species.get(s.species).baseSpecies))
  let best: { team: PokemonSet[]; rate: number } | null = null
  for (let c = 0; c < candidates; c++) {
    const team = randomTeam(battleGen, seedArray(baseSeed + 1000 * (c + 1)), new Set(), 6)
    // une équipe candidate peut partager des espèces avec l'adversaire, c'est autorisé
    void taken
    let rate = winRate(battleGen, team, opponentTeam, simsPerCandidate, baseSeed + c, level)
    // Équilibrage recalibré : une équipe qui passe la 1re mesure est confirmée sur plus de parties (une mesure à 6 parties laissait passer
    // des défis simulés à 12 % ou 100 % réels) ; la mesure combinée remplace la première.
    if (confirmSims && rate >= min && rate <= max) {
      const more = winRate(battleGen, team, opponentTeam, confirmSims, baseSeed + c + 500, level)
      rate = (rate * simsPerCandidate + more * confirmSims) / (simsPerCandidate + confirmSims)
    }
    if (rate >= min && rate <= max) {
      best = { team, rate }
      break
    }
    if (!best || Math.abs(rate - target) < Math.abs(best.rate - target)) best = { team, rate }
  }
  return {
    dayKey,
    gen,
    battleGen,
    slot,
    trainer,
    playerTeam: best!.team,
    opponentTeam,
    battleSeed: seedArray(baseSeed ^ 0x5eed),
    estimatedWinRate: best!.rate,
    playerPreview: best!.team.map((m) => previewOf(m, battleGen)),
    opponentPreview: opponentTeam.map((m) => previewOf(m, battleGen)),
  }
}
