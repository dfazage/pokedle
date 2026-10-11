// Vérifie que les messages de formatLog produisent les bons sons et que chaque nom se résout en n° de Pokédex.
import { buildDaily } from '../src/game/daily'
import { BattleSession, formatLog } from '../src/game/session'
import { HIT_MARK, cueFor, findMon, stripMarks } from '../src/game/battleCues'
import { spFr } from '../src/game/fr'

const counts: Record<string, number> = {}
const hitMoves = new Set<string>(), plainMoves = new Set<string>()
let badMark = 0, leak = 0
let unresolved = 0, unknown = new Set<string>(), total = 0
for (const day of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) {
  const s = new BattleSession(buildDaily(day, { candidates: 1, simsPerCandidate: 1 }))
  const lines: string[] = formatLog(s.drainLog())
  let steps = 0
  while (!s.view().ended && steps++ < 300) {
    const v = s.view()
    if (v.request === 'move') lines.push(...formatLog(s.choose('move ' + (v.player.moves.find((m) => !m.disabled)?.slot ?? 1))))
    else if (v.request === 'switch') lines.push(...formatLog(s.choose('switch ' + (v.player.team.find((t) => !t.fainted && !t.active)!.idx + 1))))
    else break
  }
  const v = s.view()
  const shown = lines.filter((l) => !l.startsWith('—'))
  shown.forEach((msg, k) => {
    if (stripMarks(msg).includes(HIT_MARK)) leak++
    if (!/ utilise .+ !/.test(stripMarks(msg))) return
    const name = stripMarks(msg).replace(/^.* utilise /, '').replace(/ !$/, '')
    if (msg.endsWith(HIT_MARK)) {
      hitMoves.add(name)
      const next = shown[k + 1] ?? ''
      if (/super efficace|pas très efficace|Coup critique|échoue|n'affecte pas/.test(next)) { badMark++; console.log('MARQUE INCORRECTE:', msg, '→', next) }
    } else plainMoves.add(name)
  })
  for (const msg of shown) {
    total++
    const cue = cueFor(msg)
    if (!cue) { unknown.add(msg.replace(/^.* (utilise|est) /, '… $1 ').slice(0, 50)); continue }
    const key = cue.kind === 'sfx' ? `sfx:${cue.id}` : cue.kind
    counts[key] = (counts[key] ?? 0) + 1
    if (cue.kind !== 'sfx') {
      const team = (cue.side === 'player' ? v.player : v.opponent).team
      if (!findMon(team, cue.name, spFr)?.num) { unresolved++; console.log('NON RÉSOLU:', cue.side, cue.name, '←', msg) }
    }
  }
}
console.log('messages:', total, counts)
console.log('sans son:', [...unknown])
console.log('noms non résolus:', unresolved)
console.log('attaques avec impact normal (marquées):', [...hitMoves].sort().join(', '))
console.log('attaques sans impact normal (non marquées):', [...plainMoves].sort().join(', '))
console.log('marques incorrectes:', badMark, '| marqueurs visibles après strip:', leak)
// Cas de bord fixés à la main
const cases: [string, string][] = [
  ['Pikachu adverse est K.O. !', 'faint'], ['Pikachu est K.O. !', 'faint'], ['Vas-y, Pikachu !', 'cry'],
  ["L'adversaire envoie Onix !", 'cry'], ['Tu as pris la fuite… (défaite)', 'sfx:lose'], ['Dracaufeu adverse est gravement empoisonné !', 'sfx:status'],
]
for (const [m, k] of cases) { const c = cueFor(m); const got = !c ? 'null' : c.kind === 'sfx' ? `sfx:${c.id}` : c.kind; console.log(got === k ? 'OK ' : 'KO ', m, '→', got) }
