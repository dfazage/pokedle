// Traduit un message de combat (voir formatLog dans session.ts) en « cue » sonore.
// Pur et sans DOM : testable avec scripts/test_battle_cues.ts. Les phrases sont celles de formatLog (gabarits `b.*` de src/i18n).

import type { SfxId } from './sfx'
import { parse, type Key } from '../i18n'
export type { SfxId }

/**
 * Marqueur invisible ajouté en fin de message « X utilise Y ! » quand l'attaque inflige des dégâts d'efficacité normale
 * (le journal n'a aucune ligne pour ce cas, donc rien d'autre ne déclencherait le son d'impact). Retiré avant affichage.
 */
export const HIT_MARK = '\u200B'
export const stripMarks = (s: string): string => s.split(HIT_MARK).join('')
export type Side = 'player' | 'opponent'
export type Cue =
  | { kind: 'cry'; side: Side; name: string } // entrée en jeu : cri du Pokémon
  | { kind: 'faint'; side: Side; name: string } // K.O. : cri grave + effet
  | { kind: 'sfx'; id: SfxId }

/** Gabarits de statut (la phrase de gel de `cant` déclenche aussi le son de statut, comme avant). */
const STATUS_KEYS: Key[] = ['b.status.brn', 'b.status.par', 'b.status.psn', 'b.status.tox', 'b.status.slp', 'b.status.frz', 'b.cant.frz']

/** Les messages viennent des gabarits i18n (`b.*`) : on les reconnaît dans toutes les langues, donc le son suit le texte affiché. */
export function cueFor(raw: string): Cue | null {
  const hit = raw.endsWith(HIT_MARK)
  const msg = stripMarks(raw)
  let m: string[] | null
  if ((m = parse('b.go', msg))) return { kind: 'cry', side: 'player', name: m[0] }
  if ((m = parse('b.foeSend', msg))) return { kind: 'cry', side: 'opponent', name: m[0] }
  if ((m = parse('b.faint', msg))) {
    const foe = parse('b.foe', m[0]) // « Pikachu adverse » / « Foe Pikachu »
    return { kind: 'faint', side: foe ? 'opponent' : 'player', name: foe ? foe[0] : m[0] }
  }
  if (parse('b.super', msg)) return { kind: 'sfx', id: 'super' }
  if (parse('b.resist', msg)) return { kind: 'sfx', id: 'resist' }
  if (parse('b.crit', msg)) return { kind: 'sfx', id: 'crit' }
  if (parse('b.miss', msg)) return { kind: 'sfx', id: 'miss' }
  if (parse('b.immune', msg)) return { kind: 'sfx', id: 'immune' }
  if (STATUS_KEYS.some((k) => parse(k, msg))) return { kind: 'sfx', id: 'status' }
  if (parse('b.win', msg)) return { kind: 'sfx', id: 'win' }
  if (parse('b.lose', msg) || parse('b.fled', msg)) return { kind: 'sfx', id: 'lose' }
  if (parse('b.move', msg)) return { kind: 'sfx', id: hit ? 'hit' : 'move' }
  return null
}

/**
 * Retrouve le Pokémon cité par un message. Le journal affiche l'espèce de base (« Arceus »), alors que l'équipe peut
 * contenir la forme (« Arceus-Ice ») : on accepte donc le nom exact puis le nom de base. `label` traduit les noms.
 */
export function findMon<T extends { name: string }>(team: T[], shown: string, label: (name: string) => string): T | undefined {
  return team.find((m) => label(m.name) === shown) ?? team.find((m) => label(m.name).startsWith(`${shown}-`))
}
