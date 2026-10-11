// Vérifie formatSteps : l'état reconstruit en rejouant les étapes doit égaler l'état final du simulateur,
// et l'ordre doit être « utilise → geste → dégâts → efficacité » comme sur DS.
import { buildDaily } from '../src/game/daily'
import { BattleSession, formatSteps, type Step } from '../src/game/session'

let bad = 0, checked = 0, orderOk = 0
const fail = (m: string) => { bad++; console.log('✗', m) }
for (const day of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) {
  const s = new BattleSession(buildDaily(day, { candidates: 1, simsPerCandidate: 1 }))
  const hp = { player: [-1, -1], opponent: [-1, -1] } as Record<'player' | 'opponent', number[]>
  const replay = (steps: Step[]) => {
    for (const st of steps) {
      if (st.enter) hp[st.enter.side] = [st.enter.hp, st.enter.maxhp]
      if (st.hp) hp[st.hp.side] = [st.hp.hp, st.hp.maxhp]
    }
  }
  replay(formatSteps(s.drainLog()))
  let n = 0
  while (!s.view().ended && n++ < 300) {
    const v = s.view()
    const choice = v.request === 'move' ? 'move ' + (v.player.moves.find((m) => !m.disabled)?.slot ?? 1)
      : v.request === 'switch' ? 'switch ' + (v.player.team.find((t) => !t.fainted && !t.active)!.idx + 1) : ''
    if (!choice) break
    const steps = formatSteps(s.choose(choice), v)
    replay(steps)
    const f = s.view()
    for (const side of ['player', 'opponent'] as const) {
      const a = f[side].active
      if (!a) continue
      checked++
      if (hp[side][0] !== a.hp || hp[side][1] !== a.maxhp) fail(`${day} t${f.turn} ${side} ${a.name}: étapes ${hp[side]} ≠ sim ${a.hp}/${a.maxhp}`)
    }
    // Ordre : un message d'efficacité ne doit jamais précéder le premier dégât de son attaque.
    steps.forEach((st, i) => {
      if (st.text === "C'est super efficace !" || st.text === "Ce n'est pas très efficace…") {
        const prev = steps.slice(0, i).reverse().find((x) => x.hp || x.text?.includes('utilise'))
        if (prev?.hp) orderOk++
        else fail(`${day} efficacité sans dégât avant : ${JSON.stringify(steps.slice(Math.max(0, i - 3), i + 1))}`)
      }
    })
  }
}
console.log(`PV vérifiés: ${checked}, ordre OK: ${orderOk}, erreurs: ${bad}`)
process.exit(bad ? 1 : 0)
