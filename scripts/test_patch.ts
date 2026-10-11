// Vérifie que rejouer les messages d'un tour (patchs `before` / `after`) reconstitue exactement l'état final du moteur.
// Usage : npx tsx scripts/test_patch.ts [jour…]   (par défaut : une série de jours couvrant les 4 générations)
import { buildDaily } from '../src/game/daily'
import { BattleSession, formatLog, type BattleView } from '../src/game/session'
import { applyPatch } from '../src/game/patch'

const args = process.argv.slice(2)
const days = args.length ? args : Array.from({ length: 12 }, (_, i) => `2026-10-${String(12 + i).padStart(2, '0')}`)

// Ce que l'écran affiche : PV, K.O., Pokémon en jeu, statut. Le moteur échange les places dans l'équipe à chaque
// changement (l'ordre du tableau n'a pas d'importance à l'écran) : on compare donc par Pokémon, sans l'ordre ;
// le statut et le drapeau « en jeu » d'un K.O. ne sont pas affichés.
const state = (v: BattleView) =>
  [v.player, v.opponent].map((s) =>
    s.team
      .map((m) => [m.nick, m.hp, m.fainted ? 1 : 0, m.fainted ? 0 : m.active ? 1 : 0, m.fainted ? '' : m.status].join('/'))
      .sort()
      .join(' '),
  )

let turns = 0, steps = 0, bad = 0, silentTurns = 0, abilityLines = 0
const sample: string[] = []
for (const day of days) {
  const s = new BattleSession(buildDaily(day, { candidates: 3, simsPerCandidate: 2 }))
  let shown = s.view()
  let guard = 0
  while (!s.view().ended && guard++ < 300) {
    const v = s.view()
    const choice =
      v.request === 'switch'
        ? 'switch ' + (v.player.team.find((t) => !t.fainted && !t.active)!.idx + 1)
        : 'move ' + (v.player.moves.find((m) => !m.disabled)?.slot ?? 1)
    const st = formatLog(s.choose(choice))
    for (const step of st) {
      if (!step.text) throw new Error('message vide')
      if (step.before) shown = applyPatch(shown, step.before)
      if (step.after) shown = applyPatch(shown, step.after)
      if (/ de .* !$/.test(step.text) && /^[A-ZÉ]/.test(step.text) && sample.length < 12 && v.player.active?.ability) sample.push(step.text)
      if (/Talent|talent|Intimidation|Lévitation|Pression|Statik/.test(step.text)) abilityLines++
    }
    const final = s.view()
    turns++
    steps += st.length
    if (!st.length) silentTurns++
    const a = state(shown), b = state(final)
    if (a.join('|') !== b.join('|')) {
      bad++
      if (bad <= 5) console.log('ÉCART', day, 'gen', s.challenge.gen, 'tour', final.turn, choice, '\n  affiché :', a, '\n  moteur  :', b, '\n ', st.map((x) => x.text).join(' / '))
    }
    shown = final
  }
}
console.log(`${days.length} jours, ${turns} tours, ${steps} messages, tours sans message : ${silentTurns}, messages de talent : ${abilityLines}, écarts : ${bad}`)
if (bad) process.exit(1)
