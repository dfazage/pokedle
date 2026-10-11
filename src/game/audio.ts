// Moteur audio du combat (Web Audio).
//  - cris : lus à la volée dans le dépôt PokéAPI/cries (aucun fichier hébergé chez nous). « legacy » (Vorbis, rendu
//    rétro) si le navigateur sait le lire, sinon « latest » (en réalité du MP3, lisible partout) ;
//  - effets (coups, K.O., statut, jingles) : synthétisés par code, donc originaux et sans poids.
// Le son est coupé quand l'app passe en arrière-plan ; le choix muet est mémorisé (localStorage).
// VITE_CRIES_URL permet de pointer vers un miroir de PokeAPI/cries (même arborescence : legacy/N.ogg, latest/N.ogg).
import type { Cue, Side } from './battleCues'
import { SFX, makeBus, type SfxId } from './sfx'

const KEY = 'pokedle.sound'
const CRIES = (((import.meta.env?.VITE_CRIES_URL as string | undefined) ?? 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon')).replace(/\/$/, '')

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: AudioNode | null = null
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
    // Limiteur final : cri + impact en même temps ne saturent pas.
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -3
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = 0.1
    master.connect(limiter).connect(ctx.destination)
    sfxBus = makeBus(ctx, master)
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

// ——— Effets synthétisés (voir sfx.ts) ———
export function playSfx(id: SfxId) {
  if (muted) return
  const c = ensure()
  if (!c || !sfxBus || c.state !== 'running') return
  SFX[id](c, c.currentTime + 0.01, sfxBus)
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
