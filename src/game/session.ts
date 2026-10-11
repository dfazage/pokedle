import { lineInfo } from './lineinfo'
import { Battle, Teams } from '@pkmn/sim'
import { aiChoose } from './ai'
import { mvFr, spFr } from './fr'
import { BATTLE_GEN, type DailyChallenge } from './daily'
import { HIT_MARK } from './battleCues'

export interface MonView {
  idx: number
  name: string
  hp: number
  maxhp: number
  fainted: boolean
  active: boolean
  status: string
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
        hp: p.hp,
        maxhp: p.maxhp,
        fainted: p.fainted,
        active: p.isActive,
        status: p.status || '',
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
