// Profils compétitifs (Pokémon Showdown / Smogon, gens 4 et 5) : nature + EV, talent et objet les plus joués par espèce.
// Données générées par scripts/build_profiles_gen4.py et build_profiles_gen5.py (stats d'usage OU/Ubers/UU/(RU)/NU/PU, sets Smogon en complément).
import type { PokemonSet } from '@pkmn/sim'
import type { Dex as DexType } from '@pkmn/dex'
import PROFILES4 from '../data/profiles.gen4.json'
import PROFILES5 from '../data/profiles.gen5.json'

type Profile = { s: [string, number[]][]; a: string[]; i: string[] }
const DATA_BY_GEN: Record<number, Record<string, Profile>> = {
  4: PROFILES4 as unknown as Record<string, Profile>,
  5: PROFILES5 as unknown as Record<string, Profile>,
}
type Dx = ReturnType<typeof DexType.forGen>
type Orient = 'phys' | 'spec' | 'mixed' | 'status'
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const

/** Objets populaires qu'on n'attribue pas sans le contexte qui les justifie (talent, attaque précise…). */
const SKIP_ITEMS = new Set(['Toxic Orb', 'Flame Orb', 'Light Clay', 'Damp Rock', 'Heat Rock', 'Icy Rock', 'Smooth Rock', 'Iron Ball', 'Lagging Tail', 'Sticky Barb', 'Macho Brace', 'Mail'])
const CHOICE = new Set(['Choice Band', 'Choice Specs', 'Choice Scarf'])

function orientationOf(dex: Dx, moves: string[]): { orient: Orient; attacks: number; statuses: number } {
  let phys = 0, spec = 0, statuses = 0
  for (const m of moves) {
    const mv = dex.moves.get(m)
    if (mv.category === 'Physical') phys++
    else if (mv.category === 'Special') spec++
    else statuses++
  }
  return { orient: phys > spec ? 'phys' : spec > phys ? 'spec' : phys + spec > 0 ? 'mixed' : 'status', attacks: phys + spec, statuses }
}

const evObj = (e: number[]) => Object.fromEntries(STATS.map((k, i) => [k, e[i]])) as PokemonSet['evs']

/** Répartition de repli (espèce absente des données) : 252/252 sur l'attaque utile et la vitesse, ou sur les PV et la défense. */
function fallbackSpread(dex: Dx, species: string, orient: Orient): [string, number[]] {
  const b = dex.species.get(species).baseStats
  if (orient === 'phys' || orient === 'mixed') return b.spe >= 70 ? ['Jolly', [4, 252, 0, 0, 0, 252]] : ['Adamant', [252, 252, 4, 0, 0, 0]]
  if (orient === 'spec') return b.spe >= 70 ? ['Timid', [4, 0, 0, 252, 0, 252]] : ['Modest', [252, 0, 0, 252, 4, 0]]
  return b.def >= b.spd ? ['Bold', [252, 0, 252, 0, 4, 0]] : ['Calm', [252, 0, 4, 0, 252, 0]]
}

function pickSpread(dex: Dx, p: Profile | undefined, species: string, orient: Orient): [string, number[]] {
  const so = (e: number[]) => (e[1] >= 100 && e[1] >= e[3] ? 'phys' : e[3] >= 100 ? 'spec' : 'bulk')
  const minus = (nat: string) => dex.natures.get(nat).minus
  const list = p?.s ?? []
  // 1. profil le plus populaire qui correspond au jeu d'attaques ; 2. profil défensif qui ne rogne pas la stat offensive utilisée
  const strict = list.find(([n, e]) => (orient === 'phys' ? so(e) === 'phys' : orient === 'spec' ? so(e) === 'spec' : orient === 'mixed' ? so(e) !== 'bulk' : true) && minus(n) !== (orient === 'phys' ? 'atk' : orient === 'spec' ? 'spa' : undefined))
  if (strict) return strict
  const bulky = list.find(([n, e]) => so(e) === 'bulk' && minus(n) !== (orient === 'phys' ? 'atk' : orient === 'spec' ? 'spa' : undefined))
  return bulky ?? fallbackSpread(dex, species, orient)
}

/**
 * Applique le profil compétitif le plus populaire de l'espèce : nature et EV (toujours), puis talent et objet si demandé.
 * Les attaques ne changent pas : on choisit parmi les profils populaires celui qui convient au jeu d'attaques.
 * IV : ceux du set (31 partout, sauf besoins de Puissance Cachée).
 */
export function applyProfile(set: PokemonSet, dex: Dx, opts: { ability?: boolean; item?: boolean } = {}): PokemonSet {
  const sp = dex.species.get(set.species)
  const data = DATA_BY_GEN[dex.gen] ?? DATA_BY_GEN[5]
  const p = data[sp.name] ?? data[sp.baseSpecies]
  const { orient, attacks, statuses } = orientationOf(dex, set.moves)
  const [nature, evs] = pickSpread(dex, p, sp.name, orient)
  const out: PokemonSet = { ...set, nature, evs: evObj(evs) }
  if (opts.ability && p) {
    const valid = Object.values(sp.abilities).map((a) => dex.abilities.get(a).id)
    const a = p.a.find((x) => valid.includes(dex.abilities.get(x).id))
    if (a) out.ability = a
  }
  if (opts.item && !set.item && p) {
    const ok = (it: string) => {
      if (SKIP_ITEMS.has(it)) return false
      if (CHOICE.has(it)) return statuses === 0 && attacks > 0 && (it === 'Choice Scarf' || (it === 'Choice Band' ? orient === 'phys' : orient === 'spec'))
      return true
    }
    const it = p.i.find(ok)
    if (it) out.item = it
  }
  return out
}
