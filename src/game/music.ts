// Musique de combat : boucles chiptune originales, composées et synthétisées par code (Web Audio). Aucun fichier,
// aucun air du jeu officiel : un thème par type de dresseur (arène, Conseil des 4, Maître, méchants, rival, ancien
// Maître), décliné selon la génération du dresseur (timbres, tempo, tonalité, effets).
// La boucle fait 16 mesures. Les mélodies sont tirées de gabarits rythmiques écrits à la main + un contour pseudo-aléatoire à graine fixe : le
// résultat est identique à chaque lancement, et les phrases reviennent (A A' B C | A A'' B D) comme dans un vrai thème.
import { musicOutput } from './audio'
import { noise, tone } from './sfx'

type Ctx = BaseAudioContext
export type ThemeKind = 'gym' | 'elite' | 'champion' | 'team' | 'rival' | 'special'
/** `boosted` : adversaire redoutable (aura enflammée), qui a son propre morceau de combat. */
export interface MusicChoice { kind: ThemeKind; gen: number; boosted?: boolean; /** id du dresseur (ex. « cynthia ») : permet un morceau dédié. */ trainerId?: string }

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
}
type Bass = 'eighths' | 'walk' | 'gallop' | 'sync' | 'bounce'
type Drums = 'rock' | 'half' | 'drive' | 'sync' | 'bounce'
type Arp = 'up' | 'broken' | 'stab'

interface Theme {
  bpm: number
  root: number // note MIDI de la tonique
  scale: number[]
  prog: number[] // degré de la fondamentale de l'accord, une mesure chacun (8 mesures, répétées dans la section B)
  rhy: number[][] // 4 gabarits de mesure (16 doubles-croches ; négatif = silence)
  bass: Bass
  drums: Drums
  arp: Arp
  seed: number
}

const THEMES: Record<ThemeKind, Theme> = {
  gym: { bpm: 150, root: 57, scale: SCALES.minor, prog: [0, 0, 5, 5, 3, 3, 4, 4], bass: 'eighths', drums: 'rock', arp: 'broken', seed: 11,
    rhy: [[3, 1, 2, 2, 2, 2, 2, 2], [3, 1, 4, -2, 2, 2, 2], [4, 2, 2, 4, 2, -2], [4, 2, 2, 2, 2, 2, 2]] },
  elite: { bpm: 138, root: 55, scale: SCALES.dorian, prog: [0, 3, 0, 3, 6, 3, 4, 4], bass: 'walk', drums: 'half', arp: 'up', seed: 23,
    rhy: [[6, 2, 4, 2, 2], [4, 4, 4, 2, 2], [2, 2, 4, -2, 2, 4], [8, 4, 4]] },
  champion: { bpm: 160, root: 52, scale: SCALES.harmonic, prog: [0, 5, 3, 4, 0, 5, 3, 4], bass: 'gallop', drums: 'drive', arp: 'up', seed: 37,
    rhy: [[2, 2, 2, 2, 2, 2, 2, 2], [3, 3, 2, 3, 3, 2], [4, 4, 2, 2, 4], [2, 2, 2, 2, 8]] },
  team: { bpm: 144, root: 50, scale: SCALES.phrygian, prog: [0, 1, 0, 1, 5, 6, 1, 0], bass: 'sync', drums: 'sync', arp: 'stab', seed: 41,
    rhy: [[3, 3, 2, -2, 3, 3], [2, -1, 3, 2, -1, 3, 4], [1, 1, 2, -2, 4, 2, 4], [6, -2, 4, 4]] },
  rival: { bpm: 168, root: 57, scale: SCALES.major, prog: [0, 4, 5, 3, 0, 4, 5, 3], bass: 'bounce', drums: 'bounce', arp: 'broken', seed: 53,
    rhy: [[1, 1, 2, 1, 1, 2, 2, 2, 2, 2], [2, 2, -2, 2, 2, 2, 4], [1, 1, 1, 1, 2, 2, 4, 4], [2, 2, 2, 2, 4, 4]] },
  special: { bpm: 152, root: 53, scale: SCALES.mixolydian, prog: [0, 6, 3, 0, 0, 6, 3, 4], bass: 'gallop', drums: 'drive', arp: 'up', seed: 67,
    rhy: [[4, 2, 2, 4, 2, 2], [6, 2, 2, 2, 4], [2, 2, 2, 2, 4, 4], [8, -2, 2, 4]] },
}

/** Timbres et effets selon la génération du dresseur. */
interface GenStyle { duty: number; chorus: number; vib: number; delay: number; tempo: number; shift: number; saw: number; kick: number }
const GEN: Record<number, GenStyle> = {
  1: { duty: 0.25, chorus: 0, vib: 0, delay: 0, tempo: 0.96, shift: 0, saw: 0, kick: 0.5 },
  2: { duty: 0.5, chorus: 0, vib: 0, delay: 0, tempo: 1, shift: 2, saw: 0, kick: 0.8 },
  3: { duty: 0.25, chorus: 0, vib: 7, delay: 0, tempo: 1.04, shift: -2, saw: 0.5, kick: 1 },
  4: { duty: 0.125, chorus: 8, vib: 9, delay: 0.22, tempo: 1.02, shift: 1, saw: 0, kick: 1 },
  5: { duty: 0.125, chorus: 10, vib: 9, delay: 0.26, tempo: 1.06, shift: 3, saw: 0.2, kick: 1 },
}

const CLASS_KIND: Record<string, ThemeKind> = {
  'Gym Leader': 'gym', 'Kanto Gym Leader': 'gym', 'Elite Four': 'elite', Champion: 'champion',
  'Team Boss': 'team', 'Team Executive': 'team', Rival: 'rival', 'Former Champion': 'special',
}
export const musicFor = (trainerClass: string, gen: number, boosted = false, trainerId?: string): MusicChoice => ({ kind: CLASS_KIND[trainerClass] ?? 'gym', gen, boosted, trainerId })

// ——— Composition ———
const BARS = 16 // 2 sections de 8 mesures : A (thème) puis B (variation)
const STEPS = BARS * 16
const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

interface Note { step: number; len: number; deg: number }
const midiOf = (th: Theme, shift: number, deg: number) => th.root + shift + th.scale[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

function composeLead(th: Theme, section: number): Note[] {
  const rnd = mulberry(th.seed + section * 101)
  // Un contour (suite de pas en degrés) par gabarit : les mesures qui partagent un gabarit partagent leur motif.
  const contours = th.rhy.map((r) => r.filter((l) => l > 0).map(() => [-2, -1, -1, 0, 1, 1, 2][Math.floor(rnd() * 7)]))
  const plan = section === 0 ? [0, 0, 1, 2, 0, 0, 1, 3] : [1, 1, 2, 0, 1, 1, 2, 3]
  const out: Note[] = []
  let prev = 7
  plan.forEach((ri, bar) => {
    const c = th.prog[bar]
    const tones = [c, c + 2, c + 4].flatMap((d) => [d, d + 7, d + 14])
    const nearest = (x: number) => tones.reduce((b, t) => (Math.abs(t - x) < Math.abs(b - x) ? t : b))
    let pos = 0
    let ni = 0
    let cur = nearest(prev)
    for (const l of th.rhy[ri]) {
      if (l < 0) { pos += -l; continue }
      if (ni > 0) cur += contours[ri][ni]
      if (cur > 14) cur -= 2
      if (cur < 6) cur += 2
      if (pos % 4 === 0 && (l >= 2 || ni === 0)) cur = nearest(cur) // temps forts : notes de l'accord
      if (bar === 7 && pos + l >= 16) cur = nearest(c + 7) // cadence : retour sur la tonique pour reboucler
      out.push({ step: section * 128 + bar * 16 + pos, len: l, deg: cur })
      pos += l
      ni++
    }
    prev = cur
  })
  return out
}

interface Hit { step: number; kind: 'k' | 's' | 'h' }
const DRUMS: Record<Drums, { k: string; s: string; h: string }> = {
  rock: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  half: { k: 'x.....x.x.......', s: '........x.......', h: 'x...x...x...x...' },
  drive: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  sync: { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  bounce: { k: 'x.....x.x.....x.', s: '....x.......x..x', h: 'x.xxx.xxx.xxx.xx' },
}

export interface Compiled {
  stepDur: number
  th: Theme
  st: GenStyle
  lead: Map<number, Note>
  bass: Map<number, { deg: number; len: number }>
  arp: Map<number, { degs: number[]; len: number; vol: number }>
  drums: Map<number, Hit['kind'][]>
}

export function compile(choice: MusicChoice): Compiled {
  const th = THEMES[choice.kind]
  const st = GEN[choice.gen] ?? GEN[2]
  const lead = new Map([...composeLead(th, 0), ...composeLead(th, 1)].map((n) => [n.step, n]))
  const bass = new Map<number, { deg: number; len: number }>()
  const arp = new Map<number, { degs: number[]; len: number; vol: number }>()
  const drums = new Map<number, Hit['kind'][]>()
  for (let bar = 0; bar < BARS; bar++) {
    const c = th.prog[bar % 8]
    const b0 = bar * 16
    const lowRoot = c - 14
    const put = (s: number, deg: number, len: number) => bass.set(b0 + s, { deg, len })
    if (th.bass === 'eighths') for (let i = 0; i < 8; i++) put(i * 2, lowRoot + (i % 4 === 3 ? 4 : 0), 2)
    if (th.bass === 'walk') [0, 2, 4, 2].forEach((o, i) => put(i * 4, lowRoot + o, 4))
    if (th.bass === 'gallop') for (let i = 0; i < 4; i++) { put(i * 4, lowRoot, 1); put(i * 4 + 2, lowRoot, 1); put(i * 4 + 3, lowRoot + (i % 2 ? 7 : 0), 1) }
    if (th.bass === 'sync') [0, 3, 6, 10, 12].forEach((s, i) => put(s, lowRoot + (i === 3 ? 4 : 0), 3))
    if (th.bass === 'bounce') for (let i = 0; i < 8; i++) put(i * 2, lowRoot + (i % 2 ? 7 : 0), 2)
    const ch = [c, c + 2, c + 4]
    if (th.arp === 'up') for (let i = 0; i < 16; i++) arp.set(b0 + i, { degs: [ch[[0, 1, 2, 1][i % 4]] + 7], len: 1, vol: 0.5 })
    if (th.arp === 'broken') for (let i = 0; i < 8; i++) arp.set(b0 + i * 2, { degs: [ch[[0, 2, 1, 2][i % 4]] + 7], len: 2, vol: 0.55 })
    if (th.arp === 'stab') [2, 6, 10, 14].forEach((s) => arp.set(b0 + s, { degs: ch.map((d) => d + 7), len: 2, vol: 0.4 }))
    const d = DRUMS[th.drums]
    for (let i = 0; i < 16; i++) {
      const kinds: Hit['kind'][] = []
      if (d.k[i] === 'x') kinds.push('k')
      if (d.s[i] === 'x') kinds.push('s')
      if (d.h[i] === 'x') kinds.push('h')
      if (kinds.length) drums.set(b0 + i, kinds)
    }
  }
  return { stepDur: 60 / (th.bpm * st.tempo) / 4, th, st, lead, bass, arp, drums }
}

// ——— Synthèse ———
const waves = new WeakMap<Ctx, Map<number, PeriodicWave>>()
function pulse(c: Ctx, duty: number): PeriodicWave {
  let m = waves.get(c)
  if (!m) waves.set(c, (m = new Map()))
  let w = m.get(duty)
  if (!w) {
    const N = 48
    const real = new Float32Array(N)
    const imag = new Float32Array(N)
    for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
    w = c.createPeriodicWave(real, imag)
    m.set(duty, w)
  }
  return w
}

interface Voice { wave: PeriodicWave | OscillatorType; f: number; t: number; dur: number; vol: number; vib?: number; detune?: number; attack?: number; sustain?: number }
function voice(c: Ctx, out: AudioNode, v: Voice) {
  const osc = c.createOscillator()
  if (typeof v.wave === 'string') osc.type = v.wave as OscillatorType
  else osc.setPeriodicWave(v.wave)
  osc.frequency.value = v.f
  osc.detune.value = v.detune ?? 0
  const g = c.createGain()
  const a = v.attack ?? 0.006
  const end = v.t + v.dur
  g.gain.setValueAtTime(0.0001, v.t)
  g.gain.linearRampToValueAtTime(v.vol, v.t + a)
  g.gain.setTargetAtTime(v.vol * (v.sustain ?? 0.7), v.t + a, 0.08)
  g.gain.setTargetAtTime(0.0001, end - 0.02, 0.025)
  if (v.vib) {
    const lfo = c.createOscillator()
    const lg = c.createGain()
    lfo.frequency.value = 5.5
    lg.gain.setValueAtTime(0, v.t)
    lg.gain.linearRampToValueAtTime(v.vib, v.t + 0.25) // vibrato qui s'installe après l'attaque, comme sur une vraie voix
    lfo.connect(lg).connect(osc.detune)
    lfo.start(v.t)
    lfo.stop(end + 0.1)
  }
  osc.connect(g).connect(out)
  osc.start(v.t)
  osc.stop(end + 0.1)
}

/** Programme tous les événements d'un pas de la boucle à l'instant t. */
export function playStep(c: Ctx, out: AudioNode, cp: Compiled, step: number, t: number) {
  const { th, st, stepDur: sd } = cp
  const m = (deg: number) => midiOf(th, st.shift, deg)
  const ld = cp.lead.get(step)
  if (ld) {
    const dur = Math.max(0.06, ld.len * sd * 0.92)
    const f = hz(m(ld.deg))
    voice(c, out, { wave: pulse(c, st.duty), f, t, dur, vol: 0.13, vib: st.vib });
    if (st.chorus) voice(c, out, { wave: pulse(c, st.duty), f, t, dur, vol: 0.07, vib: st.vib, detune: st.chorus })
    if (st.saw) voice(c, out, { wave: 'sawtooth', f: f / 2, t, dur, vol: 0.035 * st.saw })
  }
  const a = cp.arp.get(step)
  if (a) for (const d of a.degs) voice(c, out, { wave: pulse(c, 0.5), f: hz(m(d)), t, dur: Math.max(0.04, a.len * sd * 0.8), vol: 0.05 * a.vol, sustain: 0.3 })
  const b = cp.bass.get(step)
  if (b) voice(c, out, { wave: 'triangle', f: hz(m(b.deg)), t, dur: Math.max(0.05, b.len * sd * 0.9), vol: 0.2, sustain: 0.8, attack: 0.004 })
  const dr = cp.drums.get(step)
  if (dr) for (const k of dr) {
    if (k === 'k') tone(c, out, t, { f0: 150, f1: 45, dur: 0.12, type: 'sine', vol: 0.3 * st.kick })
    if (k === 's') { noise(c, out, t, { dur: 0.11, vol: 0.18, filter: 'bandpass', f0: 2400, q: 0.8 }); tone(c, out, t, { f0: 220, f1: 140, dur: 0.07, type: 'triangle', vol: 0.12 }) }
    if (k === 'h') noise(c, out, t, { dur: 0.03, vol: step % 4 === 0 ? 0.07 : 0.04, filter: 'highpass', f0: 7000 })
  }
}

/** Rend une boucle complète (utile pour mesurer le niveau hors-ligne). */
export function renderLoop(c: Ctx, out: AudioNode, choice: MusicChoice, t0 = 0) {
  const cp = compile(choice)
  for (let s = 0; s < STEPS; s++) playStep(c, out, cp, s, t0 + s * cp.stepDur)
  return cp.stepDur * STEPS
}

// ——— Lecture en boucle ———
let timer = 0
let stopCur: ((fade: number) => void) | null = null

/** Repli : thème chiptune synthétisé, quand les morceaux de src/assets/bgm sont absents ou illisibles. */
function startChip(choice: MusicChoice) {
  const a = musicOutput()
  if (!a) return
  const { ctx: c, out } = a
  const cp = compile(choice)
  const song = c.createGain()
  song.gain.setValueAtTime(0.0001, c.currentTime)
  song.gain.linearRampToValueAtTime(1, c.currentTime + 0.4)
  let dest: AudioNode = out
  const nodes: AudioNode[] = [song]
  if (cp.st.delay) {
    // Écho (gen 4) : un seul retard bouclé, mélangé à bas niveau.
    const d = c.createDelay(1)
    d.delayTime.value = cp.stepDur * 3
    const fb = c.createGain()
    fb.gain.value = 0.3
    const wet = c.createGain()
    wet.gain.value = cp.st.delay
    song.connect(d)
    d.connect(fb).connect(d)
    d.connect(wet).connect(out)
    nodes.push(d, fb, wet)
  }
  song.connect(dest)
  dest = song
  let step = 0
  let next = c.currentTime + 0.12
  const pump = () => {
    while (next < c.currentTime + 0.25) {
      playStep(c, dest, cp, step, next)
      next += cp.stepDur
      step = (step + 1) % STEPS
    }
  }
  pump()
  const id = window.setInterval(pump, 40)
  timer = id
  stopCur = (fade) => {
    window.clearInterval(id)
    if (timer === id) timer = 0
    const now = c.currentTime
    song.gain.cancelScheduledValues(now)
    song.gain.setValueAtTime(song.gain.value, now)
    song.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fade))
    window.setTimeout(() => nodes.forEach((n) => n.disconnect()), fade * 1000 + 300)
  }
}

/** Arrête la musique avec un fondu (secondes). */
export function stopMusic(fade = 0.8) {
  const s = stopCur
  stopCur = null
  s?.(fade)
}

// ——— Morceaux fournis (src/assets/bgm/*.mp3) ———
// Lus en flux (élément <audio> branché sur le bus musique) : pas de décodage complet en mémoire, et le bouton son /
// la suspension en arrière-plan s'appliquent comme pour le reste. Les fichiers sont repérés par leur numéro de piste.
const FILES = import.meta.glob('../assets/bgm/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const TRACKS = { team: { battle: '025', win: '026' }, other: { battle: '094', win: '097' } } as const
const BOOSTED_BATTLE = '3-105' // « Battle! (Champion) », pour les adversaires redoutables
const trackUrl = (kind: ThemeKind, part: 'battle' | 'win', boosted = false) => {
  const n = boosted && part === 'battle' ? BOOSTED_BATTLE : TRACKS[kind === 'team' ? 'team' : 'other'][part]
  return Object.entries(FILES).find(([path]) => (path.split('/').pop() ?? '').startsWith(n))?.[1]
}

// ——— Thèmes par dresseur (src/assets/bgm/themes/*.mp3) ———
// Nommage (voir themes/README.md) : « g{gen}-{id} » (un dresseur précis), « {type}-g{gen} » (type de dresseur d'une
// génération), « {type} » (type de dresseur) ; suffixe « .low » = version « K.O. imminent », « .win » = victoire.
// Ordre de repli : dresseur → type + génération → type → morceaux fournis ci-dessus → chiptune. Dossier vide = comportement historique.
const THEME_FILES = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/bgm/themes/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>)
    .map(([path, url]) => [(path.split('/').pop() ?? '').replace(/\.mp3$/i, ''), url]),
) as Record<string, string>

export function themeKeys(choice: MusicChoice): string[] {
  return [choice.trainerId ? `g${choice.gen}-${choice.trainerId}` : '', `${choice.kind}-g${choice.gen}`, choice.kind].filter(Boolean)
}
/** Morceau dédié (et sa variante « low ») pour ce dresseur, s'il existe. */
export function resolveTheme(choice: MusicChoice, part: 'battle' | 'win' = 'battle', files: Record<string, string> = THEME_FILES): { url: string; low?: string; key: string } | null {
  const sfx = part === 'win' ? '.win' : ''
  for (const k of themeKeys(choice)) {
    const url = files[k + sfx]
    if (url) return { url, low: part === 'battle' ? files[`${k}.low`] : undefined, key: k }
  }
  return null
}

let setIntensity: ((low: boolean) => void) | null = null
/** Bascule sur la variante « K.O. imminent » du thème (si elle existe) en fondu enchaîné, calée sur la même position. */
export function setMusicLowHp(low: boolean) { setIntensity?.(low) }

function startTrack(url: string, o: { loop: boolean; gain: number; lowUrl?: string; onError?: () => void }): boolean {
  const a = musicOutput()
  if (!a) return false
  const { ctx: c, out } = a
  const mk = (u: string) => {
    const el = new Audio(u)
    el.loop = o.loop
    el.preload = 'auto'
    const src = c.createMediaElementSource(el)
    const g = c.createGain()
    src.connect(g).connect(out)
    return { el, src, g }
  }
  const main = mk(url)
  const low = o.lowUrl ? mk(o.lowUrl) : null
  main.g.gain.setValueAtTime(0.0001, c.currentTime)
  main.g.gain.linearRampToValueAtTime(o.gain, c.currentTime + 0.5)
  low?.g.gain.setValueAtTime(0.0001, c.currentTime)
  let dead = false
  const failed = () => { if (!dead && o.onError) { dead = true; o.onError() } }
  main.el.addEventListener('error', failed)
  void main.el.play().catch(failed)
  if (low) void low.el.play().catch(() => { /* variante illisible : on garde le thème principal */ })
  let isLow = false
  setIntensity = (want) => {
    if (!low || dead || want === isLow) return
    isLow = want
    const [from, to] = want ? [main, low] : [low, main]
    // Même position dans le morceau (modulo la durée) pour que le fondu enchaîné reste dans le tempo.
    const d = to.el.duration
    if (Number.isFinite(d) && d > 0) { try { to.el.currentTime = from.el.currentTime % d } catch { /* pas encore prêt */ } }
    const now = c.currentTime
    for (const [n, v] of [[from, 0.0001], [to, o.gain]] as const) {
      n.g.gain.cancelScheduledValues(now)
      n.g.gain.setValueAtTime(Math.max(0.0001, n.g.gain.value), now)
      n.g.gain.linearRampToValueAtTime(v, now + 0.8)
    }
  }
  stopCur = (fade) => {
    dead = true
    setIntensity = null
    const now = c.currentTime
    for (const n of low ? [main, low] : [main]) {
      n.g.gain.cancelScheduledValues(now)
      n.g.gain.setValueAtTime(n.g.gain.value, now)
      n.g.gain.linearRampToValueAtTime(0.0001, now + Math.max(0.02, fade))
    }
    window.setTimeout(() => { for (const n of low ? [main, low] : [main]) { n.el.pause(); n.el.removeAttribute('src'); n.el.load(); n.src.disconnect(); n.g.disconnect() } }, fade * 1000 + 150)
  }
  return true
}

/** Lance la musique du combat : morceau fourni si présent (Champion pour les adversaires redoutables, sinon Team Magma/Aqua pour les méchants, Conseil des 4 pour le reste), sinon chiptune. À appeler depuis un geste utilisateur. */
export function startMusic(choice: MusicChoice) {
  stopMusic(0.05)
  const legacy = () => {
    const url = trackUrl(choice.kind, 'battle', choice.boosted)
    if (url && startTrack(url, { loop: true, gain: 0.5, onError: () => { stopMusic(0.05); startChip(choice) } })) return
    startChip(choice)
  }
  const th = resolveTheme(choice, 'battle')
  if (th && startTrack(th.url, { loop: true, gain: 0.5, lowUrl: th.low, onError: () => { stopMusic(0.05); legacy() } })) return
  legacy()
}

/** Musique de victoire (une fois) ; sans morceau fourni, on se contente du jingle de victoire des effets. */
export function playVictory(choice: MusicChoice) {
  stopMusic(0.6)
  const url = resolveTheme(choice, 'win')?.url ?? trackUrl(choice.kind, 'win')
  if (url) startTrack(url, { loop: false, gain: 0.6 })
}
