// master_sprite_dataset.json (sortie de scripts/analyze_sprites.py) → src/data/sprite_meta.json
// Usage : npx tsx scripts/build_sprite_meta.ts <master_sprite_dataset.json> [out.json]
// Ne garde que ce qui pilote le générateur (archétype, 1 à 3 couleurs hex, oreilles/queue/pics) : ~60 octets/espèce.
import { readFileSync, writeFileSync } from 'fs'
import type { Arch, SpriteMeta } from '../src/game/spritemeta'

const BASE: Record<string, string> = {
  red: '#d8403c', crimson: '#c02838', scarlet: '#e04030', maroon: '#8a2a34', orange: '#f08c30', amber: '#e8a830',
  yellow: '#f8d030', gold: '#e0b030', tan: '#c8a878', beige: '#d8c8a0', cream: '#f0e4c0', brown: '#8a5a38',
  green: '#58b848', lime: '#a8d038', teal: '#38a898', turquoise: '#38b8c0', cyan: '#48c8e0', aqua: '#58c8e0',
  blue: '#4878d8', navy: '#2a3a88', indigo: '#4a48b0', purple: '#8a50b8', violet: '#9058c8', lavender: '#b8a0e0',
  magenta: '#c83890', pink: '#f090b0', rose: '#e87898', white: '#f4f4f0', gray: '#9a9aa4', grey: '#9a9aa4',
  silver: '#b8c0cc', black: '#30303c', charcoal: '#484850',
}
const LIGHT = new Set(['light', 'pale', 'pastel', 'bright'])
const DARK = new Set(['dark', 'deep', 'dull'])

const mixHex = (h: string, to: [number, number, number], t: number) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - t) + to[(i - 1) / 2] * t).toString(16).padStart(2, '0')).join('')

export function colorToHex(name: unknown): string | undefined {
  if (typeof name !== 'string') return undefined
  const s = name.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  const tokens = s.split(/[^a-z]+/).filter(Boolean)
  const base = [...tokens].reverse().find((t) => BASE[t])
  if (!base) return undefined
  let c = BASE[base]
  if (tokens.some((t) => LIGHT.has(t))) c = mixHex(c, [255, 255, 255], 0.35)
  if (tokens.some((t) => DARK.has(t))) c = mixHex(c, [10, 10, 30], 0.35)
  return c
}

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w))
const str = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(' ') : v && typeof v === 'object' ? Object.values(v).map(str).join(' ') : '').toLowerCase()

export function toArch(bodyShape: string, all: string): Arch | undefined {
  const b = bodyShape.toLowerCase()
  if (has(b, 'serpent', 'snake', 'worm', 'coil', 'eel', 'limbless')) return 'serpent'
  if (has(b, 'bird', 'avian')) return 'bird'
  if (has(b, 'fish', 'aquatic', 'whale', 'seal')) return 'fish'
  if (has(b, 'insect', 'arthropod', 'six-legged', 'beetle', 'butterfly', 'spider')) return 'insect'
  if (has(b, 'float', 'hover', 'ghost', 'wisp')) return 'floater'
  if (has(b, 'biped', 'humanoid', 'upright', 'two legs', 'two-legged')) return 'biped'
  if (has(b, 'quadruped', 'four-leg', 'four leg', 'feline', 'canine', 'on all fours')) return 'quad'
  if (has(b, 'round', 'sphere', 'spherical', 'blob', 'egg', 'ball', 'rock', 'boulder', 'oval')) return 'blob'
  if (has(all, 'wings') && has(b, 'wing')) return 'bird'
  return undefined
}

export function toMeta(a: any): SpriteMeta | undefined {
  if (!a || typeof a !== 'object') return undefined
  const m: SpriteMeta = {}
  const colors = (Array.isArray(a.primary_colors) ? a.primary_colors : []).map(colorToHex).filter(Boolean) as string[]
  const uniq = colors.filter((c, i) => colors.indexOf(c) === i).slice(0, 3)
  if (uniq.length) m.colors = uniq

  const an = a.anatomy ?? {}
  const feats = str(a.distinct_features) + ' ' + str(an.other_parts) + ' ' + str(an.head)
  const arch = toArch(str(an.body_shape), str(an))
  if (arch) m.arch = arch

  const tail = str(an.tail)
  if (tail) {
    if (/^(none|no tail|n\/a|absent|not visible)/.test(tail.trim())) m.noTail = true
    else if (has(tail, 'ball', 'bulb', 'club', 'round', 'tuft', 'puff')) m.tail = 1
    else if (has(tail, 'point', 'spade', 'arrow', 'triang', 'fin', 'paddle', 'flame', 'lightning')) m.tail = 2
    else m.tail = 0
  }
  if (has(feats, 'horn', 'antler', 'single spike on head', 'crest')) m.ear = 2
  else if (has(feats, 'round ear', 'rounded ear', 'small ear')) m.ear = 1
  else if (has(feats, 'pointed ear', 'pointy ear', 'long ear', 'large ear', 'ears')) m.ear = 0
  if (has(feats, 'spike', 'spine', 'quill', 'thorn', 'ridge')) m.spiky = true
  return Object.keys(m).length ? m : undefined
}

// Plusieurs versions par n° : on prend la plus récente (génération la plus haute).
export function pickEntry(versions: Record<string, any>): any {
  return Object.values(versions).sort((x: any, y: any) => (y.generation ?? 0) - (x.generation ?? 0))[0]
}

if (process.argv[1]?.endsWith('build_sprite_meta.ts')) {
  const [inp, out = 'src/data/sprite_meta.json'] = process.argv.slice(2)
  if (!inp) throw new Error('usage: npx tsx scripts/build_sprite_meta.ts <master_sprite_dataset.json> [out.json]')
  const master = JSON.parse(readFileSync(inp, 'utf-8')) as Record<string, Record<string, any>>
  const res: Record<string, SpriteMeta> = {}
  let skipped = 0
  for (const [id, versions] of Object.entries(master)) {
    if (!/^\d+$/.test(id)) { skipped++; continue } // formes alternatives (201-a, 386-normal…) : ignorées
    const m = toMeta(pickEntry(versions))
    if (m) res[id] = m
  }
  writeFileSync(out, JSON.stringify(res))
  console.log(`${Object.keys(res).length} espèces → ${out} (${skipped} formes alternatives ignorées)`)
}
