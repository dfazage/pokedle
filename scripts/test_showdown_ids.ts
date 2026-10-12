// Vérifie la table numéro de Pokédex → id de fichier Showdown (gen5ani) : 649 espèces, noms à caractères spéciaux.
// Usage : npx tsx scripts/test_showdown_ids.ts
import { animatedSpriteUrl, showdownId } from '../src/game/officialSprites'

let bad = 0
const check = (ok: boolean, msg: string) => { if (!ok) { bad++; console.error('KO  ' + msg) } }

const ids = new Set<string>()
for (let n = 1; n <= 649; n++) {
  const id = showdownId(n)
  check(!!id && /^[a-z0-9]+$/.test(id), `#${n} id invalide : ${id}`)
  if (id) { check(!ids.has(id), `#${n} id en double : ${id}`); ids.add(id) }
}
const expect: Record<number, string> = { 1: 'bulbasaur', 29: 'nidoranf', 32: 'nidoranm', 83: 'farfetchd', 122: 'mrmime', 250: 'hooh', 474: 'porygonz', 386: 'deoxys', 413: 'wormadam', 487: 'giratina', 492: 'shaymin', 550: 'basculin', 649: 'genesect' }
for (const [n, id] of Object.entries(expect)) check(showdownId(+n) === id, `#${n} attendu ${id}, obtenu ${showdownId(+n)}`)
check(showdownId(650) === undefined, '#650 (gen 6) ne doit pas être résolu')
check(animatedSpriteUrl(122, true).endsWith('/gen5ani-back/mrmime.gif'), 'URL dos mrmime : ' + animatedSpriteUrl(122, true))
check(animatedSpriteUrl(1, false).endsWith('/gen5ani/bulbasaur.gif'), 'URL face bulbasaur : ' + animatedSpriteUrl(1, false))

console.log(bad ? `${bad} échec(s)` : `OK : ${ids.size} espèces, URLs conformes`)
process.exit(bad ? 1 : 0)
