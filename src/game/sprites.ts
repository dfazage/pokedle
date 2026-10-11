// Sprites 100 % originaux, générés par code (aucun asset officiel).
// Chaque espèce → une grille 64×64 déterministe : la graine vient de la ligne évolutive (même famille =
// même silhouette), la couleur des types, la taille de la taille réelle, les détails du stade d'évolution.
import { mulberry32 } from './rng'
import { spriteMeta } from './spritemeta'
import type { Arch, SpriteMeta } from './spritemeta'

const N = 64
const GROUND = 59

const TYPE_HEX: Record<string, string> = {
  Normal: '#b5a98a', Fire: '#f08030', Water: '#5f8ff0', Grass: '#6cc850', Electric: '#f8d030', Ice: '#8fd8e0',
  Fighting: '#c8503c', Poison: '#a850b0', Ground: '#d8b868', Flying: '#a0a0f0', Psychic: '#f86898', Bug: '#a8c020',
  Rock: '#b8a050', Ghost: '#7860a8', Dragon: '#6a50f0', Dark: '#6e5a4c', Steel: '#b0b8c8',
}
// Couleur « déco » (flammes, feuilles, cristaux…) par type.
const DECO_HEX: Record<string, string> = {
  Normal: '#e8d8b0', Fire: '#f8e040', Water: '#a8e0f8', Grass: '#3a9a38', Electric: '#fff070', Ice: '#e0f8ff',
  Fighting: '#f0e0c0', Poison: '#e078d8', Ground: '#8a6a38', Flying: '#f8f0e0', Psychic: '#ffe070', Bug: '#e8f070',
  Rock: '#807048', Ghost: '#e04858', Dragon: '#f8c040', Dark: '#d84050', Steel: '#e8eef8',
}

export interface SpriteSpec {
  num: number
  root: number
  stage: number
  heightm: number
  bst: number
  types: string[]
}

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB
const dark = (c: RGB, t = 0.38) => mix(c, [20, 16, 40], t)
const light = (c: RGB, t = 0.38) => mix(c, [255, 250, 235], t)

function hueShift(c: RGB, deg: number): RGB {
  const [r, g, b] = c.map((v) => v / 255)
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + deg + 360) % 360
  const l = (mx + mn) / 2
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  const C = (1 - Math.abs(2 * l - 1)) * s, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - C / 2
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X]
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255].map(Math.round) as RGB
}

// Familles de couleurs : 0 corps, 1 accent (ventre / extrémités), 2 déco.
// Code pixel : 0 vide ; 1+3f base, 2+3f ombre, 3+3f lumière ; 10 contour ; 11 blanc d'œil ; 12 pupille.
class Canvas64 {
  px = new Uint8Array(N * N)
  set(x: number, y: number, v: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < N && y < N) this.px[y * N + x] = v
  }
  get(x: number, y: number) {
    return x < 0 || y < 0 || x >= N || y >= N ? 0 : this.px[y * N + x]
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, fam = 0) {
    rx = Math.max(rx, 0.6)
    ry = Math.max(ry, 0.6)
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry
        if (nx * nx + ny * ny > 1) continue
        const v = -0.55 * nx - 0.8 * ny
        this.set(x, y, 1 + 3 * fam + (v > 0.62 ? 2 : v < -0.5 ? 1 : 0))
      }
  }
  tri(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, fam = 0, shade = 0) {
    const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx))
    const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy))
    const sgn = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2)
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const d1 = sgn(x, y, ax, ay, bx, by), d2 = sgn(x, y, bx, by, cx, cy), d3 = sgn(x, y, cx, cy, ax, ay)
        if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) this.set(x, y, 1 + 3 * fam + shade)
      }
  }
  line(x1: number, y1: number, x2: number, y2: number, w: number, fam = 0, shade = 0) {
    const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1)
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n
      for (let dy = -w / 2; dy <= w / 2; dy += 0.5) for (let dx = -w / 2; dx <= w / 2; dx += 0.5) this.set(x + dx, y + dy, 1 + 3 * fam + shade)
    }
  }
  outline() {
    const src = this.px.slice()
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (src[y * N + x]) continue
        if (src[y * N + x - 1] && x > 0 || (x < N - 1 && src[y * N + x + 1]) || (y > 0 && src[(y - 1) * N + x]) || (y < N - 1 && src[(y + 1) * N + x]))
          this.px[y * N + x] = 10
      }
  }
}

function pickArch(types: string[], bst: number, r: () => number): Arch {
  const t = types.join(' ')
  const w: Partial<Record<Arch, number>> = { biped: 2, quad: 2, blob: 1 }
  const add = (a: Arch, n: number) => (w[a] = (w[a] ?? 0) + n)
  if (t.includes('Water')) { add('fish', 3); add('blob', 1) }
  if (t.includes('Flying')) add('bird', 4)
  if (t.includes('Bug')) add('insect', 5)
  if (t.includes('Ghost')) add('floater', 5)
  if (t.includes('Psychic')) { add('floater', 1); add('biped', 1) }
  if (t.includes('Dragon')) { add('serpent', 3); add('biped', 1) }
  if (t.includes('Poison')) { add('serpent', 1); add('blob', 1) }
  if (t.includes('Rock') || t.includes('Ground') || t.includes('Steel')) { add('blob', 3); add('quad', 1) }
  if (t.includes('Fighting')) add('biped', 4)
  if (t.includes('Fire') || t.includes('Normal') || t.includes('Electric') || t.includes('Ice')) add('quad', 2)
  if (t.includes('Grass')) { add('quad', 1); add('blob', 1) }
  if (bst < 300) add('blob', 1)
  const entries = Object.entries(w) as [Arch, number][]
  let tot = entries.reduce((a, [, n]) => a + n, 0)
  let x = r() * tot
  for (const [a, n] of entries) if ((x -= n) < 0) return a
  tot = 0
  return 'biped'
}

export function renderPixels(spec: SpriteSpec, back: boolean, meta: SpriteMeta | undefined = spriteMeta(spec.num)): { px: Uint8Array; pal: Record<number, RGB> } {
  const r = mulberry32(spec.root * 7919 + 13) // même ligne → mêmes choix de forme
  const g = new Canvas64()
  const t1 = spec.types[0], t2 = spec.types[1]
  // Les tirages `r()` gardent le même ordre avec ou sans métadonnées : une espèce sans entrée rend comme avant.
  const archRoll = pickArch(spec.types, spec.bst, r)
  const arch: Arch = meta?.arch ?? archRoll
  const hs = (r() - 0.5) * 26
  const mc = meta?.colors?.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) ?? []
  const bodyC = mc[0] ? hex(mc[0]) : hueShift(hex(TYPE_HEX[t1] ?? '#999999'), hs)
  const accDefault = t2 ? hueShift(hex(TYPE_HEX[t2]), hs * 0.5) : mix(bodyC, [248, 236, 205], 0.62)
  const accC = mc[1] ? hex(mc[1]) : mc[0] ? mix(bodyC, [248, 236, 205], 0.62) : accDefault
  const decoType = t2 && r() > 0.5 ? t2 : t1 // tirage conditionnel, comme avant
  const decoC = mc[2] ? hex(mc[2]) : hex(DECO_HEX[decoType] ?? '#ffffff')

  const sNorm = Math.min(1, Math.max(0, (0.5 + 0.25 * Math.log2(1 + spec.heightm) - 0.5) / 0.5))
  const S = 13 + 15 * sNorm + Math.min(3, spec.stage * 1.2)
  const st = spec.stage
  const spikyRoll = r() < 0.5
  const earRoll = Math.floor(r() * 3) // 0 triangle pointues 1 rondes 2 cornes
  const tailRoll = Math.floor(r() * 3)
  const spiky = meta?.spiky ?? spikyRoll
  const earKind = meta?.ear ?? earRoll
  const tailKind = meta?.tail ?? tailRoll
  const eyeKind = Math.floor(r() * 3)
  const decoSide = r()
  const face = !back
  const cx = 32
  const gy = GROUND

  // --- Décors selon le type, dessinés selon un point d'ancrage (tête / dos / queue) ---
  type Pt = { x: number; y: number }
  const decorate = (head: Pt, hr: number, tail: Pt, backPt: Pt) => {
    const types = spec.types
    for (const t of types) {
      if (t === 'Fire') {
        g.tri(tail.x - 3, tail.y, tail.x + 3, tail.y, tail.x, tail.y - 9 - st * 2, 2, 0)
        g.tri(tail.x - 1.5, tail.y, tail.x + 1.5, tail.y, tail.x, tail.y - 5 - st, 1, 1)
      } else if (t === 'Grass') {
        g.ellipse(head.x - hr * 0.6, head.y - hr - 2, 4, 2.4, 2)
        g.ellipse(head.x + hr * 0.6, head.y - hr - 2, 4, 2.4, 2)
        if (st > 0) g.ellipse(backPt.x, backPt.y - 2, 4 + st, 4 + st, 2)
      } else if (t === 'Electric') {
        const x0 = tail.x, y0 = tail.y
        g.line(x0, y0, x0 + 4, y0 - 4, 2, 2)
        g.line(x0 + 4, y0 - 4, x0 + 1, y0 - 6, 2, 2)
        g.line(x0 + 1, y0 - 6, x0 + 6, y0 - 12, 2, 2)
      } else if (t === 'Ice') {
        for (let i = -1; i <= 1; i++) g.tri(head.x + i * 4 - 1.5, head.y - hr + 1, head.x + i * 4 + 1.5, head.y - hr + 1, head.x + i * 4, head.y - hr - 6 + Math.abs(i) * 2, 2, 2)
      } else if (t === 'Water') {
        g.tri(head.x, head.y - hr, head.x - 5, head.y - hr - 4, head.x + 1, head.y - hr + 3, 2, 0)
      } else if (t === 'Rock' || t === 'Ground') {
        for (let i = 0; i < 3 + st; i++) {
          const x = backPt.x - 8 + i * (16 / (2 + st))
          g.tri(x - 2, backPt.y + 2, x + 2, backPt.y + 2, x, backPt.y - 5, 2, 0)
        }
      } else if (t === 'Steel') {
        g.ellipse(head.x, head.y - hr * 0.5, 3, 3, 2)
      } else if (t === 'Psychic') {
        g.ellipse(head.x, head.y - hr * 0.55, 1.8, 2.4, 2)
      } else if (t === 'Dragon') {
        g.tri(head.x - hr * 0.7, head.y - hr * 0.6, head.x - hr * 0.2, head.y - hr * 0.6, head.x - hr * 0.9, head.y - hr - 6, 2, 0)
        g.tri(head.x + hr * 0.7, head.y - hr * 0.6, head.x + hr * 0.2, head.y - hr * 0.6, head.x + hr * 0.9, head.y - hr - 6, 2, 0)
      } else if (t === 'Dark') {
        g.tri(head.x - hr, head.y - 2, head.x - hr + 4, head.y - hr, head.x - hr - 4, head.y - hr - 5, 2, 0)
      } else if (t === 'Poison') {
        for (let i = 0; i < 3; i++) g.ellipse(backPt.x - 5 + i * 5, backPt.y + 4 + (i % 2) * 3, 1.8, 1.8, 2)
      } else if (t === 'Bug') {
        g.line(head.x - 3, head.y - hr + 1, head.x - 8, head.y - hr - 8, 1, 2)
        g.line(head.x + 3, head.y - hr + 1, head.x + 8, head.y - hr - 8, 1, 2)
      } else if (t === 'Fighting') {
        g.line(head.x - hr, head.y - hr * 0.4, head.x + hr, head.y - hr * 0.4, 2, 2)
      }
    }
    // Oreilles/cornes communes (si pas déjà couvertes par un type)
    if (!types.some((x) => ['Dragon', 'Bug', 'Grass', 'Ice'].includes(x))) {
      if (earKind === 0) {
        g.tri(head.x - hr, head.y - hr * 0.3, head.x - hr * 0.3, head.y - hr * 0.9, head.x - hr * 0.9, head.y - hr - 7 - st, 0)
        g.tri(head.x + hr, head.y - hr * 0.3, head.x + hr * 0.3, head.y - hr * 0.9, head.x + hr * 0.9, head.y - hr - 7 - st, 0)
      } else if (earKind === 1) {
        g.ellipse(head.x - hr * 0.8, head.y - hr * 0.8, 3.5, 3.5, 1)
        g.ellipse(head.x + hr * 0.8, head.y - hr * 0.8, 3.5, 3.5, 1)
      } else {
        g.tri(head.x - 2, head.y - hr + 1, head.x + 2, head.y - hr + 1, head.x, head.y - hr - 6 - st, 1)
      }
    }
  }

  const eyes = (hx: number, hy: number, hr: number, spread = 0.45) => {
    if (!face) return
    for (const sx of [-1, 1]) {
      const ex = hx + sx * hr * spread, ey = hy - hr * 0.05
      if (eyeKind === 0) {
        g.set(ex, ey, 11); g.set(ex + 1, ey, 11); g.set(ex, ey + 1, 12); g.set(ex + 1, ey + 1, 12); g.set(ex, ey - 1, 12); g.set(ex + 1, ey - 1, 12)
      } else if (eyeKind === 1) {
        g.set(ex, ey, 11); g.set(ex + 1, ey, 12); g.set(ex - 1, ey - 1, 12); g.set(ex + 2, ey - 1, 12)
      } else {
        g.set(ex, ey, 12); g.set(ex + 1, ey, 12); g.set(ex, ey + 1, 12); g.set(ex + 1, ey + 1, 11)
      }
    }
    for (let i = -1; i <= 1; i++) g.set(hx + i, hy + hr * 0.5, 12)
    if (spec.bst > 450) { g.set(hx - 1, hy + hr * 0.5 + 1, 11); g.set(hx + 1, hy + hr * 0.5 + 1, 11) }
  }

  const tailDraw = (x: number, y: number, dir: number, len: number) => {
    if (meta?.noTail) return
    if (tailKind === 0) g.line(x, y, x + dir * len, y - len * 0.6, 3, 0)
    else if (tailKind === 1) {
      g.line(x, y, x + dir * len * 0.7, y + 1, 3, 0)
      g.ellipse(x + dir * len, y - 2, 4, 4, 1)
    } else g.tri(x, y - 3, x, y + 3, x + dir * len, y - len * 0.9, 0)
  }

  let head: Pt = { x: cx, y: gy - 40 }, hr = 8, tail: Pt = { x: cx + 14, y: gy - 20 }, backPt: Pt = { x: cx, y: gy - 30 }

  if (arch === 'biped') {
    const legY = gy - 0.28 * S
    tailDraw(cx + 0.4 * S, gy - 0.8 * S, 1, 0.7 * S)
    g.ellipse(cx - 0.34 * S, legY, 0.24 * S, 0.28 * S, 1)
    g.ellipse(cx + 0.34 * S, legY, 0.24 * S, 0.28 * S, 1)
    g.ellipse(cx, gy - 0.85 * S, 0.5 * S, 0.58 * S, 0)
    if (face) g.ellipse(cx, gy - 0.78 * S, 0.3 * S, 0.4 * S, 1)
    g.ellipse(cx - 0.58 * S, gy - 0.85 * S, 0.17 * S, 0.34 * S, 0)
    g.ellipse(cx + 0.58 * S, gy - 0.85 * S, 0.17 * S, 0.34 * S, 0)
    hr = 0.4 * S
    head = { x: cx, y: gy - 1.5 * S }
    g.ellipse(head.x, head.y, hr * 1.05, hr, 0)
    if (face) g.ellipse(head.x, head.y + hr * 0.35, hr * 0.5, hr * 0.38, 1)
    tail = { x: cx + 0.4 * S + 0.7 * S, y: gy - 0.8 * S - 0.4 * S }
    backPt = { x: cx, y: gy - 1.2 * S }
  } else if (arch === 'quad') {
    const by = gy - 0.62 * S
    tail = { x: cx + 0.95 * S, y: by - 0.5 * S }
    tailDraw(cx + 0.7 * S, by - 0.1 * S, 1, 0.7 * S)
    for (const lx of [-0.55, -0.25, 0.35, 0.65]) g.ellipse(cx + lx * S, gy - 0.22 * S, 0.14 * S, 0.24 * S, lx < 0 ? 1 : 0)
    g.ellipse(cx + 0.05 * S, by, 0.82 * S, 0.45 * S, 0)
    if (face) g.ellipse(cx - 0.1 * S, by + 0.2 * S, 0.5 * S, 0.22 * S, 1)
    hr = 0.38 * S
    head = face ? { x: cx - 0.68 * S, y: gy - 1.15 * S } : { x: cx - 0.1 * S, y: gy - 1.15 * S }
    g.ellipse(head.x, head.y, hr * 1.05, hr, 0)
    if (face) g.ellipse(head.x - hr * 0.3, head.y + hr * 0.45, hr * 0.55, hr * 0.4, 1)
    backPt = { x: cx + 0.05 * S, y: by - 0.45 * S }
  } else if (arch === 'blob') {
    const ry = 0.72 * S
    g.ellipse(cx - 0.4 * S, gy - 0.12 * S, 0.22 * S, 0.14 * S, 1)
    g.ellipse(cx + 0.4 * S, gy - 0.12 * S, 0.22 * S, 0.14 * S, 1)
    g.ellipse(cx, gy - ry - 0.1 * S, 0.88 * S, ry, 0)
    if (face) g.ellipse(cx, gy - 0.5 * S, 0.5 * S, 0.34 * S, 1)
    if (spec.stage > 0) { g.ellipse(cx - 0.95 * S, gy - 0.8 * S, 0.2 * S, 0.34 * S, 1); g.ellipse(cx + 0.95 * S, gy - 0.8 * S, 0.2 * S, 0.34 * S, 1) }
    hr = 0.6 * S
    head = { x: cx, y: gy - 1.1 * S }
    tail = { x: cx + 0.85 * S, y: gy - 0.5 * S }
    backPt = { x: cx, y: gy - 1.7 * S }
  } else if (arch === 'serpent') {
    const n = 8 + st * 2
    const amp = 0.55 * S
    let lastX = cx, lastY = gy
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1)
      const x = cx + Math.sin(t * Math.PI * 2.2) * amp * (1 - t * 0.2)
      const y = gy - 0.2 * S - t * 1.2 * S
      const rr = (0.28 - 0.1 * t) * S + 1.5
      g.ellipse(x, y, rr, rr, i % 3 === 1 && face ? 1 : 0)
      lastX = x; lastY = y
    }
    tail = { x: cx + 6, y: gy - 3 }
    hr = 0.4 * S
    head = { x: lastX, y: lastY - 0.3 * S }
    g.ellipse(head.x, head.y, hr * 1.1, hr, 0)
    if (face) g.ellipse(head.x, head.y + hr * 0.45, hr * 0.6, hr * 0.4, 1)
    backPt = { x: cx, y: gy - 0.7 * S }
  } else if (arch === 'bird') {
    const by = gy - 0.95 * S
    g.line(cx - 0.18 * S, gy - 0.4 * S, cx - 0.18 * S, gy, 2, 2)
    g.line(cx + 0.18 * S, gy - 0.4 * S, cx + 0.18 * S, gy, 2, 2)
    tailDraw(cx, by + 0.5 * S, 1, 0.5 * S)
    g.ellipse(cx, by, 0.5 * S, 0.58 * S, 0)
    if (face) g.ellipse(cx, by + 0.1 * S, 0.3 * S, 0.4 * S, 1)
    g.ellipse(cx - 0.75 * S, by - 0.1 * S, 0.34 * S, 0.5 * S, 1)
    g.ellipse(cx + 0.75 * S, by - 0.1 * S, 0.34 * S, 0.5 * S, 1)
    hr = 0.34 * S
    head = { x: cx, y: by - 0.78 * S }
    g.ellipse(head.x, head.y, hr, hr, 0)
    if (face) g.tri(head.x - 2, head.y + 1, head.x + 2, head.y + 1, head.x, head.y + hr * 0.9 + 3, 2, 0)
    tail = { x: cx + 0.5 * S, y: by + 0.6 * S }
    backPt = { x: cx, y: by - 0.2 * S }
  } else if (arch === 'fish') {
    const by = gy - 0.62 * S
    g.tri(cx + 0.65 * S, by, cx + 1.1 * S, by - 0.5 * S, cx + 1.1 * S, by + 0.5 * S, 1)
    g.tri(cx - 0.2 * S, by - 0.45 * S, cx + 0.4 * S, by - 0.45 * S, cx + 0.1 * S, by - 0.95 * S, 1)
    g.ellipse(cx, by, 0.82 * S, 0.5 * S, 0)
    if (face) g.ellipse(cx - 0.05 * S, by + 0.22 * S, 0.6 * S, 0.22 * S, 1)
    g.ellipse(cx + 0.05 * S, by + 0.3 * S, 0.22 * S, 0.14 * S, 1)
    hr = 0.4 * S
    head = { x: cx - 0.45 * S, y: by - 0.05 * S }
    tail = { x: cx + 1.0 * S, y: by - 0.3 * S }
    backPt = { x: cx, y: by - 0.45 * S }
  } else if (arch === 'insect') {
    const bs = 0.34 * S
    for (const sx of [-1, 1]) {
      g.line(cx + sx * 0.3 * S, gy - 0.9 * S, cx + sx * 0.85 * S, gy - 0.1, 1, 1)
      g.line(cx + sx * 0.3 * S, gy - 0.6 * S, cx + sx * 0.9 * S, gy - 0.3 * S, 1, 1)
      g.ellipse(cx + sx * 0.75 * S, gy - 1.35 * S, 0.3 * S, 0.5 * S, 2)
    }
    g.ellipse(cx, gy - 0.5 * S, bs * 1.3, bs * 1.1, 0)
    g.ellipse(cx, gy - 1.05 * S, bs * 1.1, bs * 0.95, 0)
    hr = 0.38 * S
    head = { x: cx, y: gy - 1.6 * S }
    g.ellipse(head.x, head.y, hr * 1.1, hr, 0)
    tail = { x: cx + 4, y: gy - 0.4 * S }
    backPt = { x: cx, y: gy - 1.35 * S }
  } else {
    // floater : tête ronde + traîne ondulante
    hr = 0.55 * S
    head = { x: cx, y: gy - 1.35 * S }
    for (let y = 0; y < 0.9 * S; y++) {
      const t = y / (0.9 * S)
      const w = hr * (1 - t * 0.85) + Math.sin(y * 0.7) * 1.2
      const yy = head.y + y
      for (let x = cx - w; x <= cx + w; x++) g.set(x, yy, 1 + (x < cx - w * 0.5 ? 1 : x > cx + w * 0.6 ? 0 : 0))
    }
    g.ellipse(head.x, head.y, hr, hr * 0.95, 0)
    g.ellipse(cx - hr - 2, head.y + 0.5 * S, 0.2 * S, 0.18 * S, 1)
    g.ellipse(cx + hr + 2, head.y + 0.5 * S, 0.2 * S, 0.18 * S, 1)
    tail = { x: cx + 6, y: gy - 3 }
    backPt = { x: cx, y: gy - 1.9 * S }
  }

  // Les décors passent derrière/au-dessus selon le type ; ordre simple : par-dessus.
  decorate(head, hr, tail, backPt)
  eyes(head.x, head.y, hr, arch === 'bird' ? 0.5 : 0.45)
  if (spiky && decoSide > 0.6 && arch !== 'floater') for (let i = 0; i < 3; i++) g.tri(cx - 6 + i * 6, backPt.y + 2, cx - 3 + i * 6, backPt.y + 2, cx - 4.5 + i * 6, backPt.y - 5 - st, 2)

  g.outline()
  const pal: Record<number, RGB> = { 10: [32, 24, 40], 11: [255, 255, 255], 12: [24, 16, 32] }
  const fams: RGB[] = [bodyC, accC, decoC]
  fams.forEach((c, f) => {
    pal[1 + 3 * f] = c
    pal[2 + 3 * f] = dark(c)
    pal[3 + 3 * f] = light(c)
  })
  if (back) for (const k of Object.keys(pal)) if (+k < 10) pal[+k] = dark(pal[+k], 0.12)
  return { px: g.px, pal }
}

const cache = new Map<string, string>()
export function spriteUrl(spec: SpriteSpec, back = false): string {
  const key = `${spec.num}:${spec.types.join('/')}:${back ? 'b' : 'f'}`
  const hit = cache.get(key)
  if (hit) return hit
  const { px, pal } = renderPixels(spec, back)
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(N, N)
  for (let i = 0; i < N * N; i++) {
    const c = pal[px[i]]
    if (!c) continue
    img.data.set([c[0], c[1], c[2], 255], i * 4)
  }
  ctx.putImageData(img, 0, 0)
  const url = cv.toDataURL('image/png')
  cache.set(key, url)
  return url
}
