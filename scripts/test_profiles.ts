// Vérifie les profils Showdown appliqués aux équipes : EV valides, nature cohérente avec les attaques, talent légal, objets sensés.
import { Dex } from '@pkmn/dex'
import { buildDaily } from '../src/game/daily'

const dex = Dex.forGen(4)
let bad = 0, mons = 0, noItem = 0, flatEv = 0
const problems: string[] = []
const fail = (msg: string) => { bad++; if (problems.length < 15) problems.push(msg) }
const days = Array.from({ length: Number(process.argv[2] ?? 12) }, (_, i) => new Date(Date.UTC(2026, 9, 12 + i)).toISOString().slice(0, 10))
const t0 = Date.now()
for (const day of days) {
  const c = buildDaily(day)
  for (const [side, team] of [['joueur', c.playerTeam], ['adversaire', c.opponentTeam]] as const) {
    for (const s of team) {
      mons++
      const evs = Object.values(s.evs)
      const total = evs.reduce((a, b) => a + b, 0)
      const label = `${day} ${side} ${s.species}`
      if (evs.some((v) => v > 252) || total > 510) fail(`${label}: EV invalides ${JSON.stringify(s.evs)}`)
      if (evs.every((v) => v === 85)) flatEv++
      if (Object.values(s.ivs).some((v) => v > 31)) fail(`${label}: IV > 31`)
      const nat = dex.natures.get(s.nature)
      if (!nat.exists) fail(`${label}: nature inconnue ${s.nature}`)
      const cats = s.moves.map((m) => dex.moves.get(m).category)
      const phys = cats.filter((x) => x === 'Physical').length, spec = cats.filter((x) => x === 'Special').length
      if (phys > spec && nat.minus === 'atk') fail(`${label}: nature ${s.nature} (-Atq) avec attaques physiques ${s.moves}`)
      if (spec > phys && nat.minus === 'spa') fail(`${label}: nature ${s.nature} (-AtqSp) avec attaques spéciales ${s.moves}`)
      if (phys > spec && s.evs.atk < 100 && s.evs.hp < 200) fail(`${label}: attaquant physique sans EV Atq ${JSON.stringify(s.evs)}`)
      const sp = dex.species.get(s.species)
      if (!Object.values(sp.abilities).some((a) => dex.abilities.get(a).id === dex.abilities.get(s.ability).id)) fail(`${label}: talent illégal ${s.ability}`)
      if (!s.item) noItem++
      if (/^Choice /.test(s.item) && cats.includes('Status') && !s.moves.some((m) => /^trick|^switcheroo|^healingwish/.test(dex.moves.get(m).id))) fail(`${label}: objet Choice avec attaque de statut (${s.item})`)
    }
  }
}
console.log(`${days.length} jours, ${mons} Pokémon | EV plats 85 restants : ${flatEv} | sans objet : ${noItem} | problèmes : ${bad} | ${Math.round((Date.now() - t0) / 1000)} s`)
problems.forEach((p) => console.log('✗ ', p))
process.exit(bad ? 1 : 0)
