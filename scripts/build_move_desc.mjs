// Génère src/data/moves.desc.fr.json : description française de chaque attaque (texte officiel « Pokédex » repris de PokéAPI,
// dépôt PokeAPI/api-data sur GitHub). Usage : node scripts/build_move_desc.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { Dex } from '@pkmn/dex'

const names = JSON.parse(readFileSync(new URL('../src/data/names.fr.json', import.meta.url), 'utf8')).moves
const ids = Object.keys(names)
const out = {}
const miss = []
const clean = (s) => s.replace(/[\n\f­]+/g, ' ').replace(/\s+/g, ' ').trim()

async function one(id) {
  const num = Dex.moves.get(id).num
  if (!num || num < 1) return miss.push(`${id} (pas de numéro)`)
  const url = `https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2/move/${num}/index.json`
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(url)
      if (!r.ok) throw new Error(String(r.status))
      const j = await r.json()
      const fr = j.flavor_text_entries.filter((e) => e.language.name === 'fr')
      if (!fr.length) return miss.push(`${id} (pas de texte fr)`)
      out[id] = clean(fr[fr.length - 1].flavor_text)
      return
    } catch (e) {
      if (t === 2) miss.push(`${id} (${e.message})`)
    }
  }
}
const queue = [...ids]
await Promise.all(Array.from({ length: 12 }, async () => { while (queue.length) await one(queue.shift()) }))
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(new URL('../src/data/moves.desc.fr.json', import.meta.url), JSON.stringify(sorted, null, 1) + '\n')
console.log(Object.keys(sorted).length, 'descriptions /', ids.length, 'attaques ; manquantes :', miss.length)
if (miss.length) console.log(miss.join('\n'))
