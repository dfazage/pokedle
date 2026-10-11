import { lineInfo } from './lineinfo'
import { Battle, Teams } from '@pkmn/sim'
import { aiChoose } from './ai'
import { abFr, mvFr, spFr, STAT_FR } from './fr'
import type { MonPatch, Step } from './patch'
import { BATTLE_GEN, type DailyChallenge } from './daily'

export type { MonPatch, Step } from './patch'

export interface MonView {
  idx: number
  name: string
  /** Surnom dans le log du simulateur (= espèce de base) : sert à rattacher les messages au bon Pokémon. */
  nick: string
  hp: number
  maxhp: number
  fainted: boolean
  active: boolean
  status: string
  /** Talent (gens 3-4, nom anglais) ; chaîne vide en gens 1-2 où les talents n'existent pas. */
  ability: string
  types: string[]
  // Données pour les sprites originaux générés (voir sprites.ts)
  num: number
  root: number
  stage: number
  heightm: number
  bst: number
}
export interface MoveView {
  slot: number
  name: string
  type: string
  pp: number
  maxpp: number
  disabled: boolean
}
export interface BattleView {
  turn: number
  ended: boolean
  result: 'win' | 'loss' | null
  request: 'move' | 'switch' | 'none'
  player: { active: MonView | null; team: MonView[]; moves: MoveView[]; trapped: boolean }
  opponent: { active: MonView | null; team: MonView[] }
}

export class BattleSession {
  battle: Battle
  challenge: DailyChallenge
  private logIdx = 0
  constructor(challenge: DailyChallenge) {
    this.challenge = challenge
    const gen = BATTLE_GEN // moteur toujours en gen 4, quel que soit le dresseur (voir daily.ts)
    this.battle = new Battle({
      formatid: `gen${gen}customgame` as any,
      seed: challenge.battleSeed as any,
      p1: { name: 'Toi', team: Teams.pack(challenge.playerTeam) as any },
      p2: { name: challenge.trainer.name, team: Teams.pack(challenge.opponentTeam) as any },
    } as any)
    this.settle()
  }

  private needsAction(idx: 0 | 1) {
    const r = this.battle.sides[idx].activeRequest as any
    return !!r && !r.wait && !r.teamPreview
  }

  /** Fait jouer l'adversaire tant que le joueur n'a rien à décider. */
  private settle() {
    let guard = 0
    while (!this.battle.ended && !this.needsAction(0) && guard++ < 50) {
      const c1 = this.needsAction(1) ? aiChoose(this.battle, 1, BATTLE_GEN) : ''
      this.battle.makeChoices('', c1)
    }
  }

  /** choice : "move N" ou "switch N" (N démarre à 1). Retourne les nouvelles lignes brutes du log. */
  choose(choice: string): string[] {
    if (this.battle.ended || !this.needsAction(0)) return []
    const c1 = this.needsAction(1) ? aiChoose(this.battle, 1, BATTLE_GEN) : ''
    const before = this.battle.log.length
    this.battle.makeChoices(choice, c1)
    this.settle()
    this.logIdx = this.battle.log.length
    return this.battle.log.slice(before)
  }

  drainLog(): string[] {
    const lines = this.battle.log.slice(this.logIdx)
    this.logIdx = this.battle.log.length
    return lines
  }

  /** Abandon = défaite. */
  forfeit() {
    this.battle.win('p2')
  }

  view(): BattleView {
    const b = this.battle
    const toView = (side: 0 | 1): MonView[] =>
      b.sides[side].pokemon.map((p, i) => ({
        idx: i,
        name: p.species.name,
        nick: p.name,
        hp: p.hp,
        maxhp: p.maxhp,
        fainted: p.fainted,
        active: p.isActive,
        status: p.status || '',
        ability: p.ability ? b.dex.abilities.get(p.ability).name : '',
        types: [...p.species.types],
        ...lineInfo(b.dex, p.species),
      }))
    const pTeam = toView(0)
    const oTeam = toView(1)
    const req = b.sides[0].activeRequest as any
    const request: BattleView['request'] =
      b.ended || !this.needsAction(0) ? 'none' : req.forceSwitch ? 'switch' : 'move'
    const activeMoves = req?.active?.[0]
    const moves: MoveView[] =
      request === 'move' && activeMoves
        ? activeMoves.moves.map((m: any, i: number) => {
            const mv = b.dex.moves.get(m.id)
            return {
              slot: i + 1,
              name: m.move,
              type: mv.type,
              pp: m.pp ?? 0,
              maxpp: m.maxpp ?? 0,
              disabled: !!m.disabled || (m.pp !== undefined && m.pp <= 0),
            }
          })
        : []
    return {
      turn: b.turn,
      ended: b.ended,
      result: b.ended ? (b.winner === 'Toi' ? 'win' : 'loss') : null,
      request,
      player: {
        active: pTeam.find((p) => p.active) ?? null,
        team: pTeam,
        moves,
        trapped: !!activeMoves?.trapped,
      },
      opponent: { active: oTeam.find((p) => p.active) ?? null, team: oTeam },
    }
  }
}

const STATUS_FR: Record<string, string> = {
  brn: 'brûlé', par: 'paralysé', psn: 'empoisonné', tox: 'gravement empoisonné', slp: 'endormi', frz: 'gelé',
}
const CURE_FR: Record<string, (w: string) => string> = {
  slp: (w) => `${w} se réveille !`,
  frz: (w) => `${w} n'est plus gelé !`,
  brn: (w) => `${w} n'est plus brûlé !`,
  par: (w) => `${w} n'est plus paralysé !`,
  psn: (w) => `${w} n'est plus empoisonné !`,
  tox: (w) => `${w} n'est plus empoisonné !`,
}
const WEATHER_FR: Record<string, string> = {
  RainDance: 'Il commence à pleuvoir !', SunnyDay: 'Le soleil brille !', Sandstorm: 'Une tempête de sable se lève !',
  Hail: 'Il commence à grêler !', none: 'Le temps redevient clair.',
}
const WEATHER_UPKEEP_FR: Record<string, string> = {
  RainDance: 'La pluie continue de tomber.', SunnyDay: 'Le soleil brille.', Sandstorm: 'La tempête de sable fait rage.',
  Hail: 'La grêle continue de tomber.',
}
/** Dégâts résiduels (« [from] … » dans le protocole) → message. */
const DAMAGE_FROM_FR: Record<string, (w: string) => string> = {
  psn: (w) => `${w} souffre du poison !`,
  tox: (w) => `${w} souffre du poison !`,
  brn: (w) => `${w} souffre de sa brûlure !`,
  sandstorm: (w) => `${w} est frappé par la tempête de sable !`,
  hail: (w) => `${w} est frappé par la grêle !`,
  leechseed: (w) => `La Vampigraine draine les PV de ${w} !`,
  recoil: (w) => `${w} est blessé par le contrecoup !`,
  confusion: (w) => `${w} se blesse dans sa confusion !`,
  curse: (w) => `${w} est maudit : il perd des PV !`,
  nightmare: (w) => `${w} fait un cauchemar !`,
  spikes: (w) => `${w} est blessé par les Picots !`,
  stealthrock: (w) => `Des pierres pointues blessent ${w} !`,
}

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const nickOf = (s: string) => s.replace(/^p\d[a-z]?: /, '')
const sideOf = (s: string): 'p1' | 'p2' => (s.startsWith('p1') ? 'p1' : 'p2')
const flag = (p: string[], key: string) => p.find((x) => x.startsWith(`[${key}] `))?.slice(key.length + 3)
const strip = (s: string) => s.replace(/^(move|item|ability): /, '')

/** « 214/297 par », « 0 fnt » → PV (exacts : le log du simulateur est omniscient) et statut. */
function hpPatch(target: string, token?: string): MonPatch[] {
  const m = token?.match(/^(\d+)(?:\/(\d+))?(?: (\w+))?$/)
  if (!m) return []
  const out: MonPatch = { side: sideOf(target), nick: nickOf(target), hp: +m[1], status: m[3] && m[3] !== 'fnt' ? m[3] : '' }
  if (m[2]) out.maxhp = +m[2]
  return [out]
}

/**
 * Traduit le protocole du simulateur en messages (noms de Pokémon, attaques et talents en français).
 * Chaque message porte les changements d'affichage associés (PV, statut, K.O., entrée en jeu) :
 * les barres de PV bougent au moment du coup, pas à la fin du tour.
 */
export function formatLog(lines: string[]): Step[] {
  const steps: Step[] = []
  let pre: MonPatch[] = [] // changements survenus avant tout message du lot
  let hitStep: Step | null = null // dernier message « X utilise … » : les dégâts directs s'y rattachent

  const say = (text: string, silent = false) => {
    if (silent || !text) return
    const s: Step = { text }
    if (pre.length) {
      s.before = pre
      pre = []
    }
    steps.push(s)
  }
  const attach = (ps: MonPatch[], anchor?: Step | null) => {
    if (!ps.length) return
    const target = anchor ?? steps[steps.length - 1]
    if (target) (target.after ??= []).push(...ps)
    else pre.push(...ps)
  }

  const nm = (s: string) => spFr(nickOf(s))
  const who = (s: string) => (s.startsWith('p1') ? nm(s) : `${nm(s)} adverse`)
  const sideWord = (s: string) => (s.startsWith('p1') ? 'alliée' : 'adverse')

  // Après "|split|pX", le simulateur émet la version privée (PV exacts) puis la publique (en %) : on garde la privée.
  const clean: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|split|')) {
      clean.push(lines[i + 1] ?? '')
      i += 2
    } else clean.push(lines[i])
  }

  for (const line of clean) {
    const p = line.split('|')
    const silent = p.includes('[silent]')
    const from = flag(p, 'from')
    const of = flag(p, 'of')
    switch (p[1]) {
      case 'switch': case 'drag': {
        say(p[2].startsWith('p1') ? `Vas-y, ${nm(p[2])} !` : `L'adversaire envoie ${nm(p[2])} !`)
        attach([{ side: sideOf(p[2]), nick: nickOf(p[2]), switchIn: true }, ...hpPatch(p[2], p[4])])
        break
      }
      case 'move':
        say(`${who(p[2])} utilise ${mvFr(p[3])} !`)
        hitStep = steps[steps.length - 1] ?? null
        break
      case 'cant': {
        const w = who(p[2])
        const reason = p[3]
        if (reason === 'par') say(`${w} est paralysé ! Il ne peut pas attaquer !`)
        else if (reason === 'slp') say(`${w} est endormi.`)
        else if (reason === 'frz') say(`${w} est gelé !`)
        else if (reason === 'flinch') say(`${w} a la trouille !`)
        else if (reason === 'recharge') say(`${w} doit se reposer.`)
        else if (reason === 'Disable' && p[4]) say(`${w} ne peut plus utiliser ${mvFr(p[4])} !`)
        else if ((reason === 'move: Taunt' || reason === 'Taunt') && p[4]) say(`${w} est provoqué et ne peut pas utiliser ${mvFr(p[4])} !`)
        else say(`${w} ne peut pas attaquer.`)
        break
      }
      case '-damage': {
        const hp = hpPatch(p[2], p[3])
        if (!from) {
          attach(hp, hitStep) // coup direct : la barre baisse juste après « X utilise … »
          break
        }
        const w = who(p[2])
        const id = toId(strip(from))
        if (from.startsWith('item: ')) say(`${w} est blessé par son objet !`, silent)
        else if (from.startsWith('ability: ')) say(`Le talent ${abFr(strip(from))} blesse ${w} !`, silent)
        else if (DAMAGE_FROM_FR[id]) say(DAMAGE_FROM_FR[id](w), silent)
        attach(hp)
        break
      }
      case '-heal': {
        const w = who(p[2])
        if (!from) say(`${w} récupère des PV !`, silent)
        else if (from === 'drain') say(of ? `L'énergie de ${who(of)} est drainée !` : `${w} draine de l'énergie !`, silent)
        else if (from.startsWith('item: ')) say(`${w} récupère des PV grâce à son objet !`, silent)
        else if (from.startsWith('ability: ')) say(`${abFr(strip(from))} de ${w} restaure ses PV !`, silent)
        else say(`${w} récupère des PV !`, silent)
        attach(hpPatch(p[2], p[3]))
        break
      }
      case '-sethp':
        attach(hpPatch(p[2], p[3]))
        break
      case '-supereffective': say("C'est super efficace !"); break
      case '-resisted': say("Ce n'est pas très efficace…"); break
      case '-immune': {
        const w = who(p[2])
        if (from?.startsWith('ability: ')) say(`Ça n'affecte pas ${w}… (${abFr(strip(from))})`)
        else say(`Ça n'affecte pas ${w}…`)
        break
      }
      case '-crit': say('Coup critique !'); break
      case '-miss': say(`L'attaque de ${who(p[2])} a raté !`); break
      case '-fail':
        if (from?.startsWith('ability: ')) say(`${abFr(strip(from))} de ${who(of ?? p[2])} protège ses stats !`, silent)
        else say('Mais ça échoue !', silent)
        break
      case '-notarget': say("Mais il n'y a pas de cible…"); break
      case '-hitcount': say(`Touché ${p[3]} fois !`); break
      case '-ohko': say('K.O. en un coup !'); break
      case '-status': {
        const w = who(p[2])
        if (from?.startsWith('ability: ') && of) say(`${abFr(strip(from))} de ${who(of)} agit !`, silent)
        say(`${w} est ${STATUS_FR[p[3]] ?? p[3]} !`, silent)
        attach([{ side: sideOf(p[2]), nick: nickOf(p[2]), status: p[3] }])
        break
      }
      case '-curestatus': {
        const w = who(p[2])
        if (from?.startsWith('ability: ')) say(`${abFr(strip(from))} de ${w} agit !`, silent)
        say(CURE_FR[p[3]]?.(w) ?? `${w} est guéri !`, silent)
        attach([{ side: sideOf(p[2]), nick: nickOf(p[2]), status: '' }])
        break
      }
      case '-boost': case '-unboost': {
        const n = Number(p[4]) || 1
        const verb = (p[1] === '-boost' ? 'monte' : 'baisse') + (n >= 3 ? ' énormément' : n === 2 ? ' beaucoup' : '')
        say(`${STAT_FR[p[3]] ?? p[3]} de ${who(p[2])} ${verb} !`, silent)
        break
      }
      case '-ability':
        // Annonces d'entrée en jeu (Intimidation, Pression…) et talents copiés.
        say(`${abFr(p[3] ?? '')} de ${who(p[2])} !`, silent || !p[3])
        break
      case '-weather':
        if (p.includes('[upkeep]')) say(WEATHER_UPKEEP_FR[p[2]] ?? '')
        else {
          if (from?.startsWith('ability: ') && of) say(`${abFr(strip(from))} de ${who(of)} agit !`)
          say(WEATHER_FR[p[2]] ?? '')
        }
        break
      case '-start': {
        const w = who(p[2])
        const what = p[3] ?? ''
        const id = toId(strip(what))
        if (what.startsWith('ability: ')) say(`${abFr(strip(what))} de ${w} s'active !`, silent)
        else if (id === 'confusion') say(`${w} est confus !`, silent)
        else if (id === 'substitute') say(`${w} crée un clone !`, silent)
        else if (id === 'leechseed') say(`${w} est infecté par Vampigraine !`, silent)
        else if (id === 'yawn') say(`${w} commence à bâiller !`, silent)
        else if (id === 'taunt') say(`${w} est provoqué !`, silent)
        else if (id === 'disable') say(`${w} ne peut plus utiliser son attaque !`, silent)
        else if (id === 'focusenergy') say(`${w} se concentre !`, silent)
        else if (id === 'attract') say(`${w} est amoureux !`, silent)
        else if (id === 'ingrain') say(`${w} plante ses racines !`, silent)
        else if (id === 'aquaring') say(`${w} s'entoure d'un voile d'eau !`, silent)
        break
      }
      case '-end': {
        const w = who(p[2])
        const id = toId(strip(p[3] ?? ''))
        if (id === 'confusion') say(`${w} n'est plus confus !`, silent)
        else if (id === 'substitute') say(`Le clone de ${w} disparaît !`, silent)
        else if (id === 'taunt') say(`La provocation de ${w} prend fin !`, silent)
        break
      }
      case '-activate': {
        const w = who(p[2])
        const what = p[3] ?? ''
        const id = toId(strip(what))
        if (what.startsWith('ability: ')) say(`${abFr(strip(what))} de ${w} s'active !`, silent)
        else if (id === 'confusion') say(`${w} est confus !`, silent)
        else if (id === 'substitute' && p.includes('[damage]')) say(`Le clone subit les dégâts à la place de ${w} !`, silent)
        else if (id === 'protect' || id === 'detect') say(`${w} se protège !`, silent)
        else if (id === 'endure') say(`${w} tient bon !`, silent)
        break
      }
      case '-prepare': say(`${who(p[2])} se prépare !`); break
      case '-sidestart': case '-sideend': {
        const id = toId(strip(p[3] ?? ''))
        const mv = mvFr(strip(p[3] ?? ''))
        if (p[1] === '-sideend') say(`L'effet de ${mv} se dissipe ${p[2].startsWith('p1') ? 'de ton côté' : 'du côté adverse'}.`)
        else if (id === 'spikes') say(`Des Picots se dispersent autour de l'équipe ${sideWord(p[2])} !`)
        else if (id === 'toxicspikes') say(`Des Pics Toxik se dispersent autour de l'équipe ${sideWord(p[2])} !`)
        else if (id === 'stealthrock') say(`Des pierres pointues flottent autour de l'équipe ${sideWord(p[2])} !`)
        else if (id === 'tailwind') say(`Un vent arrière souffle sur l'équipe ${sideWord(p[2])} !`)
        else if (['reflect', 'lightscreen', 'safeguard', 'mist', 'luckychant'].includes(id)) say(`${mv} protège l'équipe ${sideWord(p[2])} !`)
        else say(`${mv} prend effet pour l'équipe ${sideWord(p[2])} !`)
        break
      }
      case '-fieldstart': say(`L'effet de ${mvFr(strip(p[2] ?? ''))} commence !`); break
      case '-fieldend': say(`L'effet de ${mvFr(strip(p[2] ?? ''))} prend fin.`); break
      case 'faint':
        say(`${who(p[2])} est K.O. !`)
        attach([{ side: sideOf(p[2]), nick: nickOf(p[2]), fainted: true }])
        break
      case 'win': say(p[2] === 'Toi' ? 'Victoire !' : 'Défaite…'); break
      default: break
    }
  }
  return steps
}
