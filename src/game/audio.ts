// Moteur audio du combat (Web Audio).
//  - cris : lus à la volée dans le dépôt PokéAPI/cries (aucun fichier hébergé chez nous). « legacy » (Vorbis, rendu
//    rétro) si le navigateur sait le lire, sinon « latest » (en réalité du MP3, lisible partout) ;
//  - effets (coups, K.O., statut, jingles) : synthétisés par code, donc originaux et sans poids.
// Le son est coupé quand l'app passe en arrière-plan ; le choix muet est mémorisé (localStorage).
// VITE_CRIES_URL permet de pointer vers un miroir de PokeAPI/cries (même arborescence : legacy/N.ogg, latest/N.ogg).
import type { Cue, Side, SfxId } from './battleCues'

type SfxName = SfxId | 'faint'

const KEY = 'pokedle.sound'
const CRIES = (((import.meta.env?.VITE_CRIES_URL as string | undefined) ?? 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon')).replace(/\/$/, '')

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readMuted()

function readMuted(): boolean {
  try { return localStorage.getItem(KEY) === 'off' } catch { return false }
}
export const isMuted = (): boolean => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(KEY, m ? 'off' : 'on') } catch { /* stockage indisponible */ }
  if (master) master.gain.value = m ? 0 : 1
}

/** Crée le contexte audio au premier appel (dans un geste utilisateur, sinon il resterait suspendu) et le relance si besoin. */
function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => {})
  return ctx
}

if (typeof document !== 'undefined') {
  // Les navigateurs n'autorisent le son qu'après un geste : n'importe quel tap débloque (ou relance) le contexte.
  document.addEventListener('pointerdown', () => { ensure() }, { capture: true, passive: true })
  // Pas de son en arrière-plan (écran verrouillé, autre onglet).
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend().catch(() => {})
    else void ctx.resume().catch(() => {})
  })
}

// ——— Cris ———
const CAN_VORBIS = (() => {
  try { return !!document.createElement('audio').canPlayType('audio/ogg; codecs="vorbis"') } catch { return false }
})()
const cryUrls = (num: number): string[] => [...(CAN_VORBIS ? [`${CRIES}/legacy/${num}.ogg`] : []), `${CRIES}/latest/${num}.ogg`]

const cries = new Map<number, Promise<AudioBuffer | null>>()
const decode = (c: AudioContext, data: ArrayBuffer) => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(data, res, rej))

function loadCry(num: number): Promise<AudioBuffer | null> {
  let p = cries.get(num)
  if (!p) {
    p = (async () => {
      const c = ensure()
      if (!c) return null
      for (const url of cryUrls(num)) {
        try {
          const r = await fetch(url)
          if (r.ok) return await decode(c, await r.arrayBuffer())
        } catch { /* hors-ligne, format illisible… : on essaie l'URL suivante */ }
      }
      return null
    })()
    cries.set(num, p)
    void p.then((b) => { if (!b) cries.delete(num) }) // échec : on pourra réessayer plus tard
  }
  return p
}

/** Précharge les cris (équipes des deux camps) pour qu'ils sortent sans latence. */
export function preloadCries(nums: number[]) {
  if (muted) return
  for (const n of new Set(nums)) if (n > 0) void loadCry(n)
}

export async function playCry(num: number, opts: { rate?: number; gain?: number } = {}) {
  if (muted) return
  const buf = await loadCry(num)
  const c = ctx
  if (!buf || !c || !master || muted || c.state !== 'running') return
  const src = c.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = opts.rate ?? 1
  const g = c.createGain()
  g.gain.value = opts.gain ?? 0.7
  src.connect(g).connect(master)
  src.start()
}

// ——— Effets synthétisés ———
type Tone = { f0: number; f1?: number; at?: number; dur: number; type?: OscillatorType; vol?: number }
type Noise = { at?: number; dur: number; vol?: number; filter?: BiquadFilterType; f0: number; f1?: number }

let noiseBuf: AudioBuffer | null = null

function tone(c: AudioContext, t: number, o: Tone) {
  const t0 = t + (o.at ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type ?? 'square'
  osc.frequency.setValueAtTime(o.f0, t0)
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(o.vol ?? 0.2, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g).connect(master!)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.02)
}

function noise(c: AudioContext, t: number, o: Noise) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const t0 = t + (o.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  const f = c.createBiquadFilter()
  f.type = o.filter ?? 'lowpass'
  f.frequency.setValueAtTime(o.f0, t0)
  if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(o.vol ?? 0.25, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(f).connect(g).connect(master!)
  src.start(t0, 0, o.dur + 0.02)
}

const SFX: Record<SfxName, (c: AudioContext, t: number) => void> = {
  move: (c, t) => {
    tone(c, t, { f0: 520, f1: 880, dur: 0.07, vol: 0.09 })
    noise(c, t, { at: 0.05, dur: 0.08, vol: 0.12, f0: 1800, f1: 500 })
  },
  super: (c, t) => {
    noise(c, t, { dur: 0.24, vol: 0.4, f0: 3200, f1: 300 })
    tone(c, t, { f0: 200, f1: 50, dur: 0.22, vol: 0.3 })
    tone(c, t, { f0: 1200, f1: 400, dur: 0.1, type: 'sawtooth', vol: 0.12 })
    noise(c, t, { at: 0.1, dur: 0.16, vol: 0.3, f0: 2400, f1: 250 })
  },
  resist: (c, t) => {
    noise(c, t, { dur: 0.12, vol: 0.12, f0: 700, f1: 250 })
    tone(c, t, { f0: 140, f1: 70, dur: 0.12, type: 'triangle', vol: 0.15 })
  },
  crit: (c, t) => {
    noise(c, t, { dur: 0.18, vol: 0.32, f0: 4000, f1: 500 })
    tone(c, t, { f0: 220, f1: 60, dur: 0.16, vol: 0.25 })
    tone(c, t, { at: 0.03, f0: 900, f1: 1800, dur: 0.09, vol: 0.12 })
  },
  miss: (c, t) => noise(c, t, { filter: 'bandpass', dur: 0.24, vol: 0.14, f0: 700, f1: 2600 }),
  immune: (c, t) => {
    tone(c, t, { f0: 180, dur: 0.12, type: 'triangle', vol: 0.15 })
    tone(c, t, { at: 0.12, f0: 140, dur: 0.16, type: 'triangle', vol: 0.15 })
  },
  status: (c, t) => {
    ;[700, 560, 420].forEach((f, i) => tone(c, t, { at: i * 0.09, f0: f, f1: f * 0.9, dur: 0.1, type: 'triangle', vol: 0.15 }))
  },
  faint: (c, t) => tone(c, t, { f0: 420, f1: 70, dur: 0.55, type: 'triangle', vol: 0.18 }),
  win: (c, t) => {
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const d = i === 3 ? 0.45 : 0.12
      tone(c, t, { at: i * 0.12, f0: f, dur: d, vol: 0.13 })
      tone(c, t, { at: i * 0.12, f0: f / 2, dur: d, type: 'triangle', vol: 0.12 })
    })
  },
  lose: (c, t) => {
    ;[392, 349, 311, 261].forEach((f, i) => tone(c, t, { at: i * 0.2, f0: f, dur: i === 3 ? 0.55 : 0.2, type: 'triangle', vol: 0.18 }))
  },
}

export function playSfx(id: SfxName) {
  if (muted) return
  const c = ensure()
  if (!c || !master || c.state !== 'running') return
  SFX[id](c, c.currentTime + 0.01)
}

/** Joue le son associé à un message de combat. `numOf` retrouve le n° de Pokédex à partir du camp et du nom affiché. */
export function playCue(cue: Cue, numOf: (side: Side, name: string) => number | undefined) {
  if (cue.kind === 'sfx') return playSfx(cue.id)
  const num = numOf(cue.side, cue.name)
  if (cue.kind === 'cry') {
    if (num) void playCry(num)
    return
  }
  if (num) void playCry(num, { rate: 0.75, gain: 0.55 }) // K.O. : cri ralenti + chute
  playSfx('faint')
}
