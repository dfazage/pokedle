// Traduit un message de combat (voir formatLog dans session.ts) en « cue » sonore.
// Pur et sans DOM : testable avec scripts/test_battle_cues.ts. Les phrases sont celles de formatLog.

export type SfxId = 'move' | 'super' | 'resist' | 'crit' | 'miss' | 'immune' | 'status' | 'win' | 'lose'
export type Side = 'player' | 'opponent'
export type Cue =
  | { kind: 'cry'; side: Side; name: string } // entrée en jeu : cri du Pokémon
  | { kind: 'faint'; side: Side; name: string } // K.O. : cri grave + effet
  | { kind: 'sfx'; id: SfxId }

const STATUS = '(?:brûlé|paralysé|empoisonné|gravement empoisonné|endormi|gelé)'
const RE_SEND_PLAYER = /^Vas-y, (.+) !$/
const RE_SEND_FOE = /^L'adversaire envoie (.+) !$/
const RE_FAINT = /^(.+?)( adverse)? est K\.O\. !$/
const RE_STATUS = new RegExp(`^.+ est ${STATUS} !$`)
const RE_MOVE = /^.+ utilise .+ !$/

export function cueFor(msg: string): Cue | null {
  let m: RegExpMatchArray | null
  if ((m = msg.match(RE_SEND_PLAYER))) return { kind: 'cry', side: 'player', name: m[1] }
  if ((m = msg.match(RE_SEND_FOE))) return { kind: 'cry', side: 'opponent', name: m[1] }
  if ((m = msg.match(RE_FAINT))) return { kind: 'faint', side: m[2] ? 'opponent' : 'player', name: m[1] }
  if (msg === "C'est super efficace !") return { kind: 'sfx', id: 'super' }
  if (msg === "Ce n'est pas très efficace…") return { kind: 'sfx', id: 'resist' }
  if (msg === 'Coup critique !') return { kind: 'sfx', id: 'crit' }
  if (msg === "L'attaque échoue !") return { kind: 'sfx', id: 'miss' }
  if (msg.startsWith("Ça n'affecte pas")) return { kind: 'sfx', id: 'immune' }
  if (RE_STATUS.test(msg)) return { kind: 'sfx', id: 'status' }
  if (msg === 'Victoire !') return { kind: 'sfx', id: 'win' }
  if (msg === 'Défaite…' || msg.startsWith('Tu as pris la fuite')) return { kind: 'sfx', id: 'lose' }
  if (RE_MOVE.test(msg)) return { kind: 'sfx', id: 'move' }
  return null
}

/**
 * Retrouve le Pokémon cité par un message. Le journal affiche l'espèce de base (« Arceus »), alors que l'équipe peut
 * contenir la forme (« Arceus-Ice ») : on accepte donc le nom exact puis le nom de base. `label` traduit les noms.
 */
export function findMon<T extends { name: string }>(team: T[], shown: string, label: (name: string) => string): T | undefined {
  return team.find((m) => label(m.name) === shown) ?? team.find((m) => label(m.name).startsWith(`${shown}-`))
}
