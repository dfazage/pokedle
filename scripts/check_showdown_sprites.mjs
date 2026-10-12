// Compare les 649 espèces gen 1-5 (ids Dex) aux fichiers réellement présents sur Showdown (gen5ani et gen5ani-back).
// Réseau requis. Usage : node scripts/check_showdown_sprites.mjs
import { Dex } from '@pkmn/dex'

const BASE = process.env.VITE_SHOWDOWN_SPRITES_URL ?? 'https://play.pokemonshowdown.com/sprites'
const ids = Dex.forGen(5).species.all().filter((s) => !s.forme && s.num > 0 && s.num <= 649).map((s) => s.id)

for (const dir of ['gen5ani', 'gen5ani-back']) {
  const html = await (await fetch(`${BASE}/${dir}/`)).text()
  const files = new Set([...html.matchAll(/href="([^"]+)\.gif"/g)].map((m) => decodeURIComponent(m[1])))
  const missing = ids.filter((id) => !files.has(id))
  console.log(`${dir} : ${files.size} GIF listés, ${ids.length - missing.length}/${ids.length} espèces couvertes${missing.length ? ' — manquantes : ' + missing.join(', ') : ''}`)
}
