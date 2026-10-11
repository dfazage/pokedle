import type { BattleView } from './session'

/**
 * Modification d'affichage appliquée pendant la lecture d'un tour : PV, statut, K.O., entrée en jeu.
 * Elle rend le tour lisible message par message sans toucher au moteur (qui a déjà tout calculé).
 * Ce module est volontairement léger (types + une fonction pure) : le simulateur reste chargé à la demande.
 */
export interface MonPatch {
  side: 'p1' | 'p2'
  /** Surnom du Pokémon dans le log du simulateur (= espèce de base). */
  nick: string
  hp?: number
  maxhp?: number
  status?: string
  fainted?: boolean
  switchIn?: boolean
}

/** Un message du tour. `before` s'applique quand le texte apparaît, `after` quand il a fini de s'écrire. */
export interface Step {
  text: string
  before?: MonPatch[]
  after?: MonPatch[]
}

export function applyPatch(view: BattleView, patches: MonPatch[]): BattleView {
  let { player, opponent } = view
  for (const p of patches) {
    const team = (p.side === 'p1' ? player.team : opponent.team).map((m) => ({ ...m }))
    let i = -1
    if (p.switchIn) {
      i = team.findIndex((m) => m.nick === p.nick && !m.active && !m.fainted)
      if (i < 0) i = team.findIndex((m) => m.nick === p.nick && m.active)
      if (i >= 0) {
        for (const m of team) m.active = false
        team[i].active = true
      }
    } else {
      i = team.findIndex((m) => m.active && m.nick === p.nick)
      if (i < 0) i = team.findIndex((m) => m.nick === p.nick && !m.fainted)
    }
    if (i < 0) continue
    const m = team[i]
    if (p.maxhp !== undefined) m.maxhp = p.maxhp
    if (p.hp !== undefined) m.hp = p.hp
    if (p.status !== undefined) m.status = p.status
    if (p.fainted) {
      m.fainted = true
      m.hp = 0
    }
    const active = team.find((x) => x.active) ?? null
    if (p.side === 'p1') player = { ...player, team, active }
    else opponent = { ...opponent, team, active }
  }
  return { ...view, player, opponent }
}
