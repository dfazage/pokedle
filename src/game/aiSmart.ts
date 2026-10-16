import { Dex } from '@pkmn/dex'
import type { Battle, Pokemon } from '@pkmn/sim'

/**
 * IA « niveau 2 » (à partir de HARD_FROM, voir ai.ts) : estime les dégâts réels (stats, boosts, STAB, talents d'immunité),
 * cherche le KO, change de Pokémon quand le duel est perdu, et sait utiliser les attaques de statut utiles
 * (statut majeur, boost, soin, pièges). Déterministe : aucune part de hasard hors du simulateur (le combat se rejoue à l'identique).
 * Sert aussi de « joueur de référence » pour équilibrer les équipes (daily.ts).
 */

const IMMUNE_ABILITY: Record<string, string> = {
  levitate: 'Ground', waterabsorb: 'Water', stormdrain: 'Water', dryskin: 'Water', voltabsorb: 'Electric',
  lightningrod: 'Electric', motordrive: 'Electric', flashfire: 'Fire', sapsipper: 'Grass',
}
const BOOST_MULT = (b: number) => (b >= 0 ? (2 + b) / 2 : 2 / (2 - b))

type Dx = ReturnType<typeof Dex.forGen>

function speedOf(p: Pokemon): number {
  let s = (p.storedStats?.spe ?? 100) * BOOST_MULT(p.boosts?.spe ?? 0)
  if (p.status === 'par') s *= 0.25
  return s
}

/** Part des PV actuels de `def` retirée en moyenne par `move` lancée par `atk` (1 = KO probable, plafonné à 1.5). */
function dmgFrac(atk: Pokemon, def: Pokemon, move: ReturnType<Dx['moves']['get']>, dex: Dx): number {
  if (move.category === 'Status') return 0
  const defTypes = def.getTypes ? def.getTypes() : [...def.species.types]
  let mult = 1
  for (const t of defTypes) {
    if (dex.getImmunity(move.type, t as any) === false) return 0
    mult *= Math.pow(2, dex.getEffectiveness(move.type, t as any))
  }
  if (IMMUNE_ABILITY[def.ability] === move.type && !move.ignoreAbility) return 0
  if (move.id === 'thousandarrows') mult = Math.max(mult, 1)
  let dmg: number
  if (move.damage === 'level') dmg = 100
  else if (typeof move.damage === 'number') dmg = move.damage
  else {
    const bp = move.basePower || 60
    const phys = move.category === 'Physical'
    const useDef = (move.overrideDefensiveStat ?? (phys ? 'def' : 'spd')) as 'def' | 'spd'
    let a = (atk.storedStats?.[phys ? 'atk' : 'spa'] ?? 200) * BOOST_MULT(atk.boosts?.[phys ? 'atk' : 'spa'] ?? 0)
    if (phys && atk.status === 'brn' && atk.ability !== 'guts') a *= 0.5
    const d = (def.storedStats?.[useDef] ?? 200) * BOOST_MULT(def.boosts?.[useDef] ?? 0)
    const stab = atk.getTypes ? atk.getTypes().includes(move.type) : atk.species.types.includes(move.type)
    dmg = ((42 * bp * a) / d / 50 + 2) * (stab ? 1.5 : 1) * mult * 0.925
    if (atk.item === 'lifeorb') dmg *= 1.3
    if (atk.item === 'choiceband' && phys) dmg *= 1.5
    if (atk.item === 'choicespecs' && !phys) dmg *= 1.5
    if (def.item === 'focussash' && def.hp === def.maxhp) dmg = Math.min(dmg, def.hp - 1)
  }
  const acc = move.accuracy === true ? 1 : (move.accuracy as number) / 100
  return Math.min(1.5, (dmg * acc) / Math.max(1, def.hp))
}

/** Meilleure attaque connue de `atk` contre `def` (moves connus : le simulateur les expose, on s'en sert comme un joueur qui a lu l'équipe). */
function bestFrac(atk: Pokemon, def: Pokemon, dex: Dx): number {
  let best = 0
  for (const slot of atk.moveSlots ?? []) {
    if (slot.pp <= 0 || slot.disabled) continue
    best = Math.max(best, dmgFrac(atk, def, dex.moves.get(slot.id), dex))
  }
  return best
}

/** Qui frappe en premier (priorité ignorée : approximation par la vitesse). */
const outspeeds = (a: Pokemon, b: Pokemon) => speedOf(a) > speedOf(b)

/** Valeur d'un duel actif a contre b : positif = a est en bonne posture. */
function duel(a: Pokemon, b: Pokemon, dex: Dx): number {
  const mine = bestFrac(a, b, dex)
  const theirs = bestFrac(b, a, dex)
  const aHits = a.hp * 1 // PV actuels
  void aHits
  // Tours pour mettre KO (plafonnés) ; le plus rapide gagne l'égalité.
  const tA = mine > 0 ? Math.ceil(1 / mine) : 9
  const tB = theirs > 0 ? Math.ceil(1 / theirs) : 9
  const fast = outspeeds(a, b)
  const aWins = tA < tB || (tA === tB && fast)
  return (aWins ? 1 : -1) * (1 + Math.abs(tB - tA) * 0.25) + (mine - theirs) * 0.5
}

export function aiChooseSmart(battle: Battle, sideIdx: 0 | 1, gen: number): string {
  const side = battle.sides[sideIdx]
  const foeSide = battle.sides[1 - sideIdx]
  const req = side.activeRequest as any
  if (!req) return 'default'
  const dex = Dex.forGen(gen)
  const foe = foeSide.active[0]
  const idxOf = (p: Pokemon) => side.pokemon.indexOf(p) + 1

  if (req.forceSwitch) {
    const alive = side.pokemon.filter((p) => !p.fainted && !p.isActive)
    if (!alive.length) return 'default'
    if (!foe || foe.fainted) return `switch ${idxOf(alive[0])}`
    const best = alive
      .map((p) => ({ p, s: duel(p, foe, dex) - (bestFrac(foe, p, dex) >= 1 ? 0.5 : 0) }))
      .sort((a, b) => b.s - a.s)[0]
    return `switch ${idxOf(best.p)}`
  }

  const active = req.active?.[0]
  const me = side.active[0]
  if (!active || !me || !foe) return 'default'

  const myBest = bestFrac(me, foe, dex)
  const foeBest = bestFrac(foe, me, dex)
  const faster = outspeeds(me, foe)

  // --- Changement de Pokémon : duel perdu et un coéquipier fait nettement mieux.
  const canSwitch = !active.trapped && !active.maybeTrapped
  if (canSwitch && me.activeTurns > 1) {
    const losing = foeBest >= 0.9 ? !(faster && myBest >= 0.9) : foeBest >= 0.45 && myBest < 0.3
    if (losing) {
      const bench = side.pokemon.filter((p) => !p.fainted && !p.isActive)
      const cur = duel(me, foe, dex)
      let pick: { p: Pokemon; s: number } | null = null
      for (const p of bench) {
        const taken = bestFrac(foe, p, dex) // le Pokémon entrant encaisse un coup
        if (taken >= 0.6) continue
        const s = duel(p, foe, dex) - taken
        if (s > cur + 0.8 && (!pick || s > pick.s)) pick = { p, s }
      }
      if (pick) return `switch ${idxOf(pick.p)}`
    }
  }

  // --- Choix de l'attaque.
  const hpFrac = me.hp / me.maxhp
  const foeHpFrac = foe.hp / foe.maxhp
  const aliveFoes = foeSide.pokemon.filter((p) => !p.fainted).length
  const foeStatusable = !foe.status && !foe.volatiles?.substitute
  let bestIdx = -1
  let bestScore = -1
  active.moves.forEach((m: any, i: number) => {
    if (m.disabled || (m.pp !== undefined && m.pp <= 0)) return
    const mv = dex.moves.get(m.id)
    let score = 0
    if (mv.category === 'Status') {
      if (mv.status && foeStatusable && foeHpFrac > 0.4 && !(mv.id === 'thunderwave' && dex.getImmunity('Electric', [...foe.species.types] as any) === false)) {
        const immune = (mv.status === 'brn' && foe.hasType('Fire')) || ((mv.status === 'psn' || mv.status === 'tox') && (foe.hasType('Poison') || foe.hasType('Steel')))
        if (!immune) score = mv.status === 'slp' ? 75 : mv.status === 'par' ? (faster ? 20 : 60) : mv.status === 'brn' ? 55 : mv.status === 'tox' ? 58 : 38
        if (IMMUNE_ABILITY[foe.ability] === mv.type) score = 0
      } else if (mv.id === 'leechseed' && !foe.volatiles?.leechseed && !foe.hasType('Grass') && hpFrac > 0.5) score = 40
      else if (mv.heal && hpFrac < 0.55 && foeBest < 0.5) score = 85 - hpFrac * 40
      else if (mv.boosts && mv.target === 'self' && foeBest < 0.45 && hpFrac > 0.6) {
        const gain = Object.entries(mv.boosts).reduce((s, [k, v]) => s + (me.boosts[k as keyof typeof me.boosts] < 2 ? (v as number) : 0), 0)
        score = gain > 0 ? 55 + gain * 6 : 0
      } else if (['stealthrock', 'spikes', 'toxicspikes'].includes(mv.id) && aliveFoes >= 3 && !foeSide.sideConditions[mv.id]) score = 45
      else score = 0
    } else {
      const f = dmgFrac(me, foe, mv, dex)
      score = Math.min(f, 1) * 100
      const kos = f >= 1
      if (kos) score += 40
      if (kos && mv.priority > 0) score += 25
      if (mv.priority > 0 && !faster && foeHpFrac < 0.3) score += 15
      if (mv.recoil || mv.mindBlownRecoil) score *= 0.9
      if (mv.flags?.recharge) score *= kos ? 0.9 : 0.6
      if (mv.flags?.charge && !me.volatiles?.twoturnmove) score *= 0.65
      if (mv.selfdestruct) score = hpFrac < 0.25 || kos ? score : score * 0.15
      if (mv.id === 'fakeout' && me.activeTurns > 1) score = 0
      if (mv.id === 'dreameater' && foe.status !== 'slp') score = 0
      if (mv.id === 'focuspunch') score *= 0.4
      if (mv.id === 'suckerpunch' && !kos) score *= 0.7
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  })
  return bestIdx >= 0 ? `move ${bestIdx + 1}` : 'move 1'
}
