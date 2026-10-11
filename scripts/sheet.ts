import { Dex } from '@pkmn/dex'
import { renderPixels } from '../src/game/sprites'
import { writeFileSync } from 'fs'
const dex = Dex.forGen(4)
const nums = process.argv.slice(3).map(Number)
const out: any[] = []
for (const n of nums) {
  const sp = dex.species.get(String(n)) as any
  const s = [...dex.species.all()].find((x) => x.num === n && !x.forme)!
  let root: any = s, stage = 0
  while (root.prevo) { root = dex.species.get(root.prevo); stage++ }
  const bs = s.baseStats
  const spec = { num: n, root: root.num, stage, heightm: 0.35 * Math.cbrt((s as any).weightkg || 10), bst: bs.hp+bs.atk+bs.def+bs.spa+bs.spd+bs.spe, types: [...s.types] }
  for (const back of [false, true]) { const r = renderPixels(spec, back); out.push({ n, name: s.name, back, px: Array.from(r.px), pal: r.pal }) }
}
writeFileSync(process.argv[2], JSON.stringify(out))
