// master_sprite_dataset.json (sortie de analyze_sprites.py, texte libre) → src/data/sprite-traits.json
// (traits compacts lus par src/game/sprites.ts : silhouette, couleurs, queue, oreilles, têtes, détails).
// Usage : node scripts/build_sprite_traits.mjs out/master_sprite_dataset.json [src/data/sprite-traits.json]
import { readFileSync, writeFileSync } from 'fs'

const [, , input, output = 'src/data/sprite-traits.json'] = process.argv
if (!input) {
  console.error('usage : node scripts/build_sprite_traits.mjs <master_sprite_dataset.json> [sortie.json]')
  process.exit(1)
}

// Version préférée quand un Pokémon a été analysé dans plusieurs jeux (sprite le plus détaillé d'abord).
const VERSION_ORDER = ['platinum', 'emerald', 'crystal', 'red-blue']

// Couleurs nommées → teintes lisibles en pixel art.
const COLORS = {
  red: '#e04040', crimson: '#c02838', maroon: '#803038', scarlet: '#d83030', orange: '#f08838', amber: '#e8a020',
  peach: '#f8b890', salmon: '#f09078', yellow: '#f0d048', gold: '#e0b030', golden: '#e0b030', lemon: '#f8e870',
  green: '#58b850', lime: '#a8d848', olive: '#8a9a40', mint: '#98e0b8', teal: '#38a0a0', turquoise: '#48c8c0',
  cyan: '#58d0e0', aqua: '#60d8e8', sky: '#80b8f0', blue: '#4878e0', navy: '#304080', indigo: '#5048a8',
  purple: '#9050c0', violet: '#9860d8', lavender: '#b8a0e0', lilac: '#c8a8e0', magenta: '#d048a8', pink: '#f088b8',
  rose: '#e87898', brown: '#a06838', tan: '#d0b080', beige: '#e0cca0', khaki: '#c8b878', cream: '#f4e8c8',
  ivory: '#f8f0dc', white: '#f4f4f0', silver: '#c0c4cc', gray: '#9898a0', grey: '#9898a0', black: '#403c48',
}

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t)

// « pale yellow », « orange-red », « dark blue » → hex (null si aucune couleur reconnue).
function colorHex(name) {
  const words = String(name).toLowerCase().split(/[\s\-/]+/)
  const found = words.filter((w) => COLORS[w]).map((w) => rgb(COLORS[w]))
  if (!found.length) return null
  let c = found.reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0]).map((v) => v / found.length)
  if (words.some((w) => ['light', 'pale', 'pastel'].includes(w))) c = mix(c, [255, 255, 250], 0.35)
  if (words.some((w) => ['dark', 'deep'].includes(w))) c = mix(c, [20, 16, 40], 0.3)
  return toHex(c)
}

const has = (text, re) => re.test(text)

function pickArch(shape, limbs, stance, all) {
  const noLegs = /\bnone\b|no (legs|limbs)/.test(limbs)
  if (has(shape, /serpent|snake|worm|eel|coil|caterpillar|larva/)) return 'serpent'
  if (has(shape, /fish|aquatic|tadpole/)) return 'fish'
  if (has(shape, /bird|avian/) || (has(all, /\bwings?\b/) && noLegs && !has(shape, /round|spher|ball/))) return 'bird'
  if (has(shape, /quadruped|four[- ]legged|on all fours/) || has(limbs, /four (thin |short |long |stubby |sturdy )?legs/)) return 'quad'
  if (has(shape, /biped|humanoid|upright|two[- ]legged/)) return 'biped'
  if (has(shape, /insect|beetle|bug|moth|butterfly|\bbee\b|spider|arthropod/)) return 'insect'
  if (has(shape, /float|ghost|levitat|hover|gas/) || has(stance, /float|hover|levitat/)) return 'floater'
  if (has(shape, /round|spher|ball|blob|oval|cylind|amorphous|egg|crab|rock|boulder|mound/)) return 'blob'
  return undefined
}

function pickTail(tail) {
  if (!tail || has(tail, /^none|no tail|absent|not visible/)) return 'none'
  if (has(tail, /flame|fire/)) return 'flame'
  if (has(tail, /nine|multiple|several|many|tails\b/)) return 'multi'
  if (has(tail, /fin/)) return 'fan'
  if (has(tail, /fluff|bushy|tuft|ball|bulb|tip|leaf/)) return 'tuft'
  return 'long'
}

function traitsOf(a) {
  const an = a.anatomy ?? {}
  const low = (x) => (Array.isArray(x) ? x.join(' ; ') : String(x ?? '')).toLowerCase()
  const shape = low(an.body_shape), head = low(an.head), limbs = low(an.limbs), tail = low(an.tail)
  const feats = low(a.distinct_features), other = low(an.other_parts), stance = low(a.pose?.stance)
  const all = [shape, head, limbs, feats, other].join(' ; ')

  const t = {}
  const arch = pickArch(shape, limbs, stance, all)
  if (arch) t.arch = arch
  const colors = (a.primary_colors ?? []).map(colorHex).filter(Boolean).slice(0, 3)
  if (colors.length) t.colors = colors
  t.tail = pickTail(tail)

  if (has(all, /pointed ears|pointy ears|long ears|tall ears/)) t.ears = 'pointed'
  else if (has(all, /round(ed)? ears/)) t.ears = 'round'
  else if (has(all, /\bhorn\b|single horn/) && !has(all, /horns/)) t.ears = 'horn'
  else if (has(head, /no (visible )?ears|no distinct head/)) t.ears = 'none'

  if (has(all, /three heads|three [a-z ]*heads|triple/)) t.heads = 3
  else if (has(all, /two heads|twin heads|two [a-z ]*heads/)) t.heads = 2
  if (has(all, /single (large |big |central )?eye|one (large |big |central )*eye|cyclop/)) t.eyes = 1

  const f = []
  const flag = (name, re) => has(all, re) && f.push(name)
  flag('wings', /\bwings?\b/)
  flag('shell', /shell|carapace/)
  flag('spikes', /spike|spiny|spines|quill/)
  flag('flame', /flame|fire/)
  flag('leaf', /leaf|leaves|bulb|flower|petal|plant|sprout/)
  flag('antennae', /antenna/)
  flag('fins', /\bfins?\b/)
  flag('spots', /spot/)
  flag('stripes', /stripe|\bbands?\b/)
  flag('pincers', /pincer|huge claw|giant claw|large claw|crab/)
  flag('horns', /horns/)
  flag('crest', /crest|tuft|mohawk|plume/)
  if (f.length) t.feats = f
  return t
}

const master = JSON.parse(readFileSync(input, 'utf8'))
const out = {}
for (const [id, byVersion] of Object.entries(master)) {
  if (!/^\d+$/.test(id)) continue // formes (201-a, 386-attack…) : on garde le sprite de base
  const version = VERSION_ORDER.find((v) => byVersion[v]) ?? Object.keys(byVersion)[0]
  if (version) out[id] = traitsOf(byVersion[version])
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => +a - +b))
writeFileSync(output, JSON.stringify(sorted, null, 0).replace(/\},"/g, '},\n"') + '\n')
console.log(`${Object.keys(sorted).length} Pokémon → ${output}`)
