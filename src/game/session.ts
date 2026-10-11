import { lineInfo } from './lineinfo'
import { Battle, Teams } from '@pkmn/sim'
import { aiChoose } from './ai'
import { mvFr, spFr } from './fr'
import { BATTLE_GEN, type DailyChallenge } from './daily'
import type { Cue, Side, SfxId } from './battleCues'
import { HIT_MARK } from './battleCues'

export interface MonView {
  idx: number
  name: string
  hp: number
  maxhp: number
  fainted: boolean
  active: boolean
  status: string
  /** Statuts temporaires actifs (confusion, vampigraine…), ids du simulateur. */
  vol: string[]
  types: string[]
  /** Modificateurs de stats en cours (atk, def, spa, spd, spe, accuracy, evasion), non nuls uniquement ; vide hors du terrain. */
  boosts: Record<string, number>
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
  /** Physical / Special / Status. */
  category: string
  power: number
  pp: number
  maxpp: number
  /** Précision en % ; 0 = ne rate jamais. */
  acc: number
  priority: number
  target: string
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
        hp: p.hp,
        maxhp: p.maxhp,
        fainted: p.fainted,
        active: p.isActive,
        status: p.status || '',
        vol: p.isActive ? Object.keys(p.volatiles ?? {}).filter((k) => k in VOL_FR) : [],
        types: [...p.species.types],
        boosts: p.isActive ? Object.fromEntries(Object.entries(p.boosts ?? {}).filter(([, v]) => v)) : {},
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
            // Puissance Cachée : le type et la puissance viennent des IV, ils sont dans le nom (« Hidden Power Flying 70 »).
            const hp = /^Hidden Power (\w+)(?: (\d+))?/.exec(m.move)
            return {
              slot: i + 1,
              name: m.move,
              type: hp ? hp[1] : mv.type,
              category: mv.category,
              power: hp?.[2] ? Number(hp[2]) : mv.basePower,
              pp: m.pp ?? 0,
              maxpp: m.maxpp ?? 0,
              acc: mv.accuracy === true ? 0 : mv.accuracy,
              priority: mv.priority,
              target: mv.target,
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

/** Statuts temporaires affichés : id du simulateur → texte d'apparition. */
export const VOL_FR: Record<string, string> = {
  confusion: 'est confus',
  leechseed: 'est infecté par Vampigraine',
  attract: 'est amoureux',
  taunt: 'est provoqué',
  encore: 'est obligé de répéter son attaque',
  yawn: 'a sommeil',
}
const VOL_ALIAS: Record<string, string> = { 'move: Attract': 'attract', 'move: Taunt': 'taunt', 'move: Encore': 'encore', 'move: Leech Seed': 'leechseed', 'move: Yawn': 'yawn' }
const volId = (raw: string) => VOL_ALIAS[raw] ?? raw.toLowerCase().replace(/^move: /, '').replace(/[^a-z]/g, '')

const STATUS_FR: Record<string, string> = {
  brn: 'brûlé', par: 'paralysé', psn: 'empoisonné', tox: 'gravement empoisonné', slp: 'endormi', frz: 'gelé',
}

const STOP = new Set(['move', 'switch', 'drag', 'turn', 'cant', 'upkeep', 'win'])
const NOT_PLAIN = new Set(['-supereffective', '-resisted', '-crit', '-miss', '-immune', '-fail'])
/** Vrai si l'attaque de la ligne i inflige des dégâts d'efficacité normale (ni super/peu efficace, ni critique, ni ratée). */
function plainHit(lines: string[], i: number): boolean {
  const user = lines[i].split('|')[2] // les PV payés par le lanceur lui-même (Clonage…) ne sont pas un coup
  let damaged = false
  for (let j = i + 1; j < lines.length; j++) {
    const p = lines[j].split('|')
    if (STOP.has(p[1])) break
    if (NOT_PLAIN.has(p[1])) return false
    if (p[1] === '-damage' && p[2] !== user && !p.slice(4).some((x) => x.startsWith('[from]'))) damaged = true
  }
  return damaged
}

/** Traduit le protocole Showdown en lignes lisibles (noms de Pokémon/attaques en anglais pour la V1). */
export function formatLog(lines: string[]): string[] {
  const out: string[] = []
  const nm = (s: string) => spFr(s.replace(/^p\d[a-z]?: /, ''))
  const who = (s: string) => (s.startsWith('p1') ? nm(s) : `${nm(s)} adverse`)
  // Après "|split|pX", le simulateur émet la version privée puis la version publique : on garde la publique.
  const clean: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|split|')) {
      clean.push(lines[i + 2] ?? '')
      i += 2
    } else clean.push(lines[i])
  }
  for (let i = 0; i < clean.length; i++) {
    const p = clean[i].split('|')
    switch (p[1]) {
      case 'turn': out.push(`— Tour ${p[2]} —`); break
      case 'switch': case 'drag':
        out.push(p[2].startsWith('p1') ? `Vas-y, ${nm(p[2])} !` : `L'adversaire envoie ${nm(p[2].split(',')[0])} !`); break
      case 'move': out.push(`${who(p[2])} utilise ${mvFr(p[3])} !${plainHit(clean, i) ? HIT_MARK : ''}`); break
      case 'cant': out.push(`${who(p[2])} ne peut pas attaquer.`); break
      case '-supereffective': out.push("C'est super efficace !"); break
      case '-resisted': out.push("Ce n'est pas très efficace…"); break
      case '-immune': out.push(`Ça n'affecte pas ${who(p[2])}…`); break
      case '-crit': out.push('Coup critique !'); break
      case '-miss': out.push("L'attaque échoue !"); break
      case '-status': out.push(`${who(p[2])} est ${STATUS_FR[p[3]] ?? p[3]} !`); break
      case 'faint': out.push(`${who(p[2])} est K.O. !`); break
      case 'win': out.push(p[2] === 'Toi' ? 'Victoire !' : 'Défaite…'); break
      default: break
    }
  }
  return out
}

// ───────────────────────── Mise en scène du combat (façon moteur DS) ─────────────────────────
// Le log d'un tour est découpé en « étapes » jouées une à une : texte, animation, barre de PV qui descend, K.O., etc.
// Chaque étape porte le changement d'état qu'elle provoque ; l'écran applique ces changements au bon moment
// au lieu de sauter directement à l'état final du tour.

export type FxKind = 'attack' | 'buff' | 'hit' | 'recall' | 'enter' | 'faint'

export interface Step {
  /** Message affiché (absent : le message précédent reste à l'écran). */
  text?: string
  /** Son à jouer. Absent : déduit du texte ; null : aucun. */
  cue?: Cue | null
  /** Animation du sprite. */
  fx?: { side: Side; kind: FxKind }
  /** Nouveaux PV du Pokémon actif (la barre descend sur `ms`). */
  hp?: { side: Side; hp: number; maxhp: number; ms: number }
  status?: { side: Side; status: string }
  /** Modificateurs de stats du Pokémon actif (valeurs absolues après l'étape). */
  boost?: { side: Side; boosts: Record<string, number> }
  /** Statut temporaire qui apparaît (`on`) ou disparaît. */
  vol?: { side: Side; id: string; on: boolean }
  /** Un Pokémon entre en jeu. `name` = nom d'espèce du simulateur. */
  enter?: { side: Side; name: string; hp: number; maxhp: number; status: string }
  /** Appliqué à la fin de l'étape : le Pokémon quitte le terrain / est K.O. */
  leave?: Side
  faint?: Side
  /** Pause (ms) après la fin du texte et de l'animation, avant d'enchaîner automatiquement. */
  wait: number
}

/** Stats modifiables, avec l'article contracté pour les messages (« L'Attaque de … augmente ! »). */
const STAT_FR: Record<string, { art: string }> = {
  atk: { art: "l'Attaque" }, def: { art: 'la Défense' }, spa: { art: "l'Attaque Spéciale" }, spd: { art: 'la Défense Spéciale' },
  spe: { art: 'la Vitesse' }, accuracy: { art: 'la Précision' }, evasion: { art: "l'Esquive" },
}

const RESIDUAL_FR: Record<string, (who: string) => string> = {
  brn: (w) => `${w} souffre de sa brûlure !`,
  psn: (w) => `${w} souffre du poison !`,
  tox: (w) => `${w} souffre du poison !`,
  Recoil: (w) => `${w} subit le contrecoup !`,
  sandstorm: (w) => `${w} est frappé par la tempête de sable !`,
  hail: (w) => `${w} est frappé par la grêle !`,
  'Leech Seed': (w) => `${w} voit son énergie drainée !`,
  'item: Life Orb': (w) => `${w} perd des PV à cause de l'Orbe Vie !`,
  'item: Rocky Helmet': (w) => `${w} est blessé par le Casque Brutal !`,
  'Spikes': (w) => `${w} est blessé par les Picots !`,
  'Stealth Rock': (w) => `${w} est blessé par les Pierres Pointues !`,
}

const hpMs = (delta: number, max: number) => Math.round(Math.min(1500, Math.max(300, 350 + (delta / Math.max(1, max)) * 1300)))

/** `before` : état d'avant le tour, pour savoir qui est déjà sur le terrain (texte « Reviens, … ! », PV de départ). */
export function formatSteps(lines: string[], before?: BattleView): Step[] {
  const out: Step[] = []
  const nm = (s: string) => spFr(s.replace(/^p\d[a-z]?: /, ''))
  const sideOf = (s: string): Side => (s.startsWith('p1') ? 'player' : 'opponent')
  const who = (s: string) => (s.startsWith('p1') ? nm(s) : `${nm(s)} adverse`)

  // Version « privée » après |split| : PV exacts pour les deux camps (seuls ceux du joueur sont affichés en chiffres).
  const clean: string[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('|split|')) {
      clean.push(lines[i + 1] ?? '')
      i += 2
    } else clean.push(lines[i])
  }

  const cur: Record<Side, number> = { player: 0, opponent: 0 }
  const max: Record<Side, number> = { player: 1, opponent: 1 }
  const active: Record<Side, string | null> = { player: null, opponent: null }
  const out0: Record<Side, boolean> = { player: false, opponent: false } // actif déjà K.O. (pas de rappel)
  for (const side of ['player', 'opponent'] as const) {
    const a = before?.[side].active
    if (a) {
      active[side] = a.name
      out0[side] = a.fainted
      cur[side] = a.hp
      max[side] = a.maxhp
    }
  }
  const bst: Record<Side, Record<string, number>> = { player: { ...(before?.player.active?.boosts ?? {}) }, opponent: { ...(before?.opponent.active?.boosts ?? {}) } }
  const boostStep = (side: Side, nb: Record<string, number>, text?: string): Step => {
    bst[side] = nb
    return { text, boost: { side, boosts: nb }, cue: text ? { kind: 'sfx', id: 'status' } : null, wait: text ? 800 : 100 }
  }
  let pend: { text: string; kind: string }[] = []
  const flush = () => {
    for (const t of pend) out.push({ text: t.text, cue: null, wait: 750 })
    pend = []
  }
  const parseHp = (raw: string, side: Side) => {
    const [frac] = raw.split(' ')
    if (raw.includes('fnt')) return { hp: 0, maxhp: max[side] }
    const [c, m] = frac.split('/').map(Number)
    return { hp: c, maxhp: m || max[side] }
  }
  const BREAK = new Set(['move', 'switch', 'drag', 'faint', 'cant', '-miss', '-immune', '-status', '-boost', '-unboost', '-setboost', '-clearboost', '-clearallboost', '-clearnegativeboost', '-start', '-end', '-curestatus', 'win', 'turn', 'upkeep'])

  for (let i = 0; i < clean.length; i++) {
    const p = clean[i].split('|')
    const kind = p[1]
    if (BREAK.has(kind)) flush()
    switch (kind) {
      case 'switch': case 'drag': {
        const side = sideOf(p[2])
        const details = p[3].split(',')[0]
        const { hp, maxhp } = parseHp(p[4] ?? '1/1', side)
        const status = (p[4] ?? '').split(' ')[1] ?? ''
        if (kind === 'switch' && active[side] && !out0[side]) {
          out.push({
            text: side === 'player' ? `Reviens, ${spFr(active[side]!)} !` : `L'adversaire rappelle ${spFr(active[side]!)} !`,
            cue: null,
            fx: { side, kind: 'recall' },
            leave: side,
            wait: 450,
          })
        }
        cur[side] = hp
        max[side] = maxhp
        bst[side] = {} // les modificateurs de stats disparaissent au changement
        active[side] = details
        out0[side] = false
        out.push({
          text: side === 'player' ? `Vas-y, ${nm(p[2])} !` : `L'adversaire envoie ${nm(details)} !`,
          enter: { side, name: details, hp, maxhp, status },
          fx: { side, kind: 'enter' },
          wait: 800,
        })
        break
      }
      case 'move': {
        const side = sideOf(p[2])
        // Une attaque inflige-t-elle des dégâts à l'adversaire ? (décide entre « coup porté » et simple geste)
        let dmg = false
        for (let j = i + 1; j < clean.length; j++) {
          const q = clean[j].split('|')
          if (['move', 'turn', 'switch', 'drag', 'cant', 'upkeep'].includes(q[1])) break
          if (q[1] === '-damage' && sideOf(q[2]) !== side && !(q[4] ?? '').startsWith('[from]')) dmg = true
        }
        out.push({ text: `${who(p[2])} utilise ${mvFr(p[3])} !`, cue: null, wait: 250 })
        out.push({ fx: { side, kind: dmg ? 'attack' : 'buff' }, cue: dmg ? null : { kind: 'sfx', id: 'move' }, wait: dmg ? 380 : 420 })
        break
      }
      case '-supereffective': pend.push({ text: "C'est super efficace !", kind: 'super' }); break
      case '-resisted': pend.push({ text: "Ce n'est pas très efficace…", kind: 'resist' }); break
      case '-crit': pend.push({ text: 'Coup critique !', kind: 'crit' }); break
      case '-damage': {
        const side = sideOf(p[2])
        const from = (p[4] ?? '').startsWith('[from]') ? (p[4] ?? '').slice(7).split('|')[0].trim() : ''
        if (from) flush()
        const next = parseHp(p[3], side)
        const delta = Math.max(0, cur[side] - next.hp)
        cur[side] = next.hp
        max[side] = next.maxhp
        const fr = from ? RESIDUAL_FR[from] : undefined
        if (fr) out.push({ text: fr(who(p[2])), cue: null, wait: 300 })
        const k = pend.find((t) => t.kind === 'super') ? 'super' : pend.find((t) => t.kind === 'resist') ? 'resist' : pend.find((t) => t.kind === 'crit') ? 'crit' : 'hit'
        out.push({
          fx: { side, kind: 'hit' },
          hp: { side, hp: next.hp, maxhp: next.maxhp, ms: hpMs(delta, next.maxhp) },
          cue: from ? null : { kind: 'sfx', id: k as SfxId },
          wait: hpMs(delta, next.maxhp) + 350,
        })
        break
      }
      case '-heal': {
        const side = sideOf(p[2])
        const next = parseHp(p[3], side)
        const delta = Math.max(0, next.hp - cur[side])
        cur[side] = next.hp
        max[side] = next.maxhp
        out.push({ hp: { side, hp: next.hp, maxhp: next.maxhp, ms: hpMs(delta, next.maxhp) }, cue: null, wait: hpMs(delta, next.maxhp) + 250 })
        break
      }
      case 'cant': {
        const why = p[3]
        const text = why === 'slp' ? `${who(p[2])} dort profondément.` : why === 'frz' ? `${who(p[2])} est gelé !` : why === 'par' ? `${who(p[2])} est paralysé ! Il ne peut pas attaquer !` : why === 'flinch' ? `${who(p[2])} est apeuré !` : why === 'recharge' ? `${who(p[2])} doit se reposer.` : `${who(p[2])} ne peut pas attaquer.`
        out.push({ text, wait: 800 })
        break
      }
      case '-immune': out.push({ text: `Ça n'affecte pas ${who(p[2])}…`, wait: 800 }); break
      case '-miss': out.push({ text: "L'attaque échoue !", wait: 800 }); break
      case '-status':
        out.push({ text: `${who(p[2])} est ${STATUS_FR[p[3]] ?? p[3]} !`, status: { side: sideOf(p[2]), status: p[3] }, wait: 800 })
        break
      case '-curestatus': {
        const side = sideOf(p[2])
        out.push({ text: p[3] === 'slp' ? `${who(p[2])} se réveille !` : p[3] === 'frz' ? `${who(p[2])} n'est plus gelé !` : undefined, status: { side, status: '' }, cue: null, wait: p[3] === 'slp' || p[3] === 'frz' ? 800 : 150 })
        break
      }
      case '-start': {
        const id = volId(p[3] ?? '')
        if (id in VOL_FR) out.push({ text: `${who(p[2])} ${VOL_FR[id]} !`, vol: { side: sideOf(p[2]), id, on: true }, cue: { kind: 'sfx', id: 'status' }, wait: 800 })
        break
      }
      case '-end': {
        const id = volId(p[3] ?? '')
        if (id in VOL_FR) {
          const text = id === 'confusion' ? `${who(p[2])} n'est plus confus !` : id === 'attract' ? `${who(p[2])} n'est plus amoureux.` : id === 'taunt' ? `${who(p[2])} n'est plus provoqué.` : undefined
          out.push({ text, vol: { side: sideOf(p[2]), id, on: false }, cue: null, wait: text ? 700 : 100 })
        }
        break
      }
      case '-boost': case '-unboost': case '-setboost': {
        const side = sideOf(p[2])
        const stat = p[3]
        const n = Math.abs(Number(p[4])) || 1
        const nb = { ...bst[side] }
        const v = kind === '-setboost' ? Number(p[4]) : (nb[stat] ?? 0) + (kind === '-boost' ? n : -n)
        nb[stat] = Math.max(-6, Math.min(6, v))
        if (!nb[stat]) delete nb[stat]
        const up = kind === '-boost' || (kind === '-setboost' && Number(p[4]) > 0)
        const size = kind === '-setboost' ? 3 : n
        const verb = `${up ? 'augmente' : 'diminue'}${size >= 3 ? ' énormément' : size === 2 ? ' beaucoup' : ''}`
        const label = STAT_FR[stat]
        out.push(boostStep(side, nb, label ? `${label.art} de ${who(p[2])} ${verb} !`.replace(/^./, (c) => c.toUpperCase()) : undefined))
        break
      }
      case '-clearboost': case '-clearnegativeboost': {
        const side = sideOf(p[2])
        const nb = kind === '-clearboost' ? {} : Object.fromEntries(Object.entries(bst[side]).filter(([, x]) => x > 0))
        out.push(boostStep(side, nb, kind === '-clearboost' ? `Les stats de ${who(p[2])} sont réinitialisées !` : undefined))
        break
      }
      case '-clearallboost':
        out.push(boostStep('player', {}, 'Tous les changements de stats sont annulés !'), boostStep('opponent', {}))
        break
      case 'faint': {
        const side = sideOf(p[2])
        out0[side] = true
        out.push({ text: `${who(p[2])} est K.O. !`, fx: { side, kind: 'faint' }, faint: side, wait: 900 })
        break
      }
      case 'win': out.push({ text: p[2] === 'Toi' ? 'Victoire !' : 'Défaite…', wait: 900 }); break
      default: break
    }
  }
  flush()
  return out
}
