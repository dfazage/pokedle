// Génère src/data/tiers.json : « <gen>|<nom du dresseur> » → classe (la plus rémunératrice si le nom apparaît plusieurs fois).
// Usage : npx tsx scripts/build_tiers.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SCORING } from '../src/game/scoring'

const dir = new URL('../src/data/', import.meta.url)
const out: Record<string, string> = {}
const base = (c: string) => SCORING.baseByClass[c] ?? SCORING.defaultBase
for (const f of readdirSync(dir).filter((n) => /^trainers.*\.json$/.test(n))) {
  for (const t of JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { gen: number; name: string; class: string }[]) {
    const k = `${t.gen}|${t.name}`
    if (!out[k] || base(t.class) > base(out[k])) out[k] = t.class
  }
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(new URL('tiers.json', dir), JSON.stringify(sorted, null, 1) + '\n')
console.log(Object.keys(sorted).length, 'dresseurs')
