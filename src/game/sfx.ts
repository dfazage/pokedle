// Effets sonores du combat, synthétisés par code (Web Audio) : originaux, aucun fichier.
// Chaque effet reçoit le contexte, l'instant de départ et le nœud de sortie : on peut donc les rendre hors-ligne
// (OfflineAudioContext) pour les mesurer.
export type SfxId = 'move' | 'hit' | 'super' | 'resist' | 'crit' | 'miss' | 'immune' | 'status' | 'win' | 'lose' | 'faint'

type Ctx = BaseAudioContext
type Tone = { f0: number; f1?: number; at?: number; dur: number; type?: OscillatorType; vol?: number }
type Noise = { at?: number; dur: number; vol?: number; filter?: BiquadFilterType; f0: number; f1?: number; q?: number }

const noiseBufs = new WeakMap<Ctx, AudioBuffer>()

export function tone(c: Ctx, out: AudioNode, t: number, o: Tone) {
  const t0 = t + (o.at ?? 0)
  const osc = c.createOscillator()
  osc.type = o.type ?? 'square'
  osc.frequency.setValueAtTime(o.f0, t0)
  if (o.f1 && o.f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(o.vol ?? 0.2, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  osc.connect(g).connect(out)
  osc.start(t0)
  osc.stop(t0 + o.dur + 0.02)
}

export function noise(c: Ctx, out: AudioNode, t: number, o: Noise) {
  let buf = noiseBufs.get(c)
  if (!buf) {
    buf = c.createBuffer(1, c.sampleRate, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    noiseBufs.set(c, buf)
  }
  const t0 = t + (o.at ?? 0)
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = o.filter ?? 'lowpass'
  if (o.q) f.Q.value = o.q
  f.frequency.setValueAtTime(o.f0, t0)
  if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur)
  const g = c.createGain()
  g.gain.setValueAtTime(o.vol ?? 0.25, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur)
  src.connect(f).connect(g).connect(out)
  src.start(t0, 0, o.dur + 0.02)
}

/** Chaîne de sortie des effets : gain → compresseur (limite les pics quand plusieurs sons se superposent) → destination. */
export function makeBus(c: Ctx, dest: AudioNode): AudioNode {
  const pre = c.createGain()
  pre.gain.value = 2.2 // +7 dB : le compresseur écrase ensuite les pics, ce qui donne du « punch » sans saturer
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -10
  comp.knee.value = 8
  comp.ratio.value = 10
  comp.attack.value = 0.002
  comp.release.value = 0.12
  pre.connect(comp).connect(dest)
  return pre
}

// Niveaux visés (RMS, dBFS) : cris ≈ −14 à −18 ; impacts −12 à −17 ; sons secondaires −20 à −26.
// Médiums/aigus privilégiés : les haut-parleurs de téléphone ne rendent presque rien sous ~200 Hz.
export const SFX: Record<SfxId, (c: Ctx, t: number, out: AudioNode) => void> = {
  move: (c, t, out) => {
    tone(c, out, t, { f0: 500, f1: 1000, dur: 0.08, vol: 0.2 })
    noise(c, out, t, { at: 0.04, dur: 0.1, vol: 0.3, f0: 2200, f1: 600 })
  },
  // Coup normal : lancement, puis claquement + « poum » médium (joué avec le message « X utilise Y ! »).
  hit: (c, t, out) => {
    tone(c, out, t, { f0: 500, f1: 1000, dur: 0.06, vol: 0.2 })
    noise(c, out, t, { at: 0.06, filter: 'highpass', dur: 0.05, vol: 0.65, f0: 1500 })
    noise(c, out, t, { at: 0.06, dur: 0.14, vol: 0.7, f0: 3000, f1: 600 })
    tone(c, out, t, { at: 0.06, f0: 420, f1: 110, dur: 0.11, vol: 0.65 })
  },
  // Super efficace : double impact appuyé + craquement + tintement.
  super: (c, t, out) => {
    noise(c, out, t, { filter: 'highpass', dur: 0.06, vol: 0.65, f0: 1500 })
    noise(c, out, t, { dur: 0.24, vol: 0.7, f0: 4000, f1: 500 })
    tone(c, out, t, { f0: 500, f1: 90, dur: 0.22, vol: 0.6 })
    tone(c, out, t, { f0: 260, f1: 70, dur: 0.26, type: 'sawtooth', vol: 0.3 })
    noise(c, out, t, { at: 0.1, dur: 0.18, vol: 0.6, f0: 3200, f1: 400 })
    tone(c, out, t, { at: 0.1, f0: 380, f1: 80, dur: 0.18, vol: 0.45 })
    tone(c, out, t, { at: 0.03, f0: 1568, f1: 2093, dur: 0.12, type: 'triangle', vol: 0.22 })
  },
  // Peu efficace : choc étouffé, court.
  resist: (c, t, out) => {
    noise(c, out, t, { dur: 0.13, vol: 0.55, f0: 900, f1: 300 })
    tone(c, out, t, { f0: 280, f1: 120, dur: 0.14, type: 'triangle', vol: 0.55 })
  },
  // Critique : claquement sec, impact net, puis « étoile » qui monte.
  crit: (c, t, out) => {
    noise(c, out, t, { filter: 'highpass', dur: 0.12, vol: 0.7, f0: 2500 })
    noise(c, out, t, { dur: 0.2, vol: 0.6, f0: 4500, f1: 400 })
    tone(c, out, t, { f0: 320, f1: 70, dur: 0.18, vol: 0.55 })
    tone(c, out, t, { at: 0.07, f0: 1760, dur: 0.09, type: 'triangle', vol: 0.25 })
    tone(c, out, t, { at: 0.13, f0: 2349, dur: 0.14, type: 'triangle', vol: 0.25 })
  },
  // Raté : souffle d'air qui passe.
  miss: (c, t, out) => noise(c, out, t, { filter: 'bandpass', dur: 0.3, vol: 1, f0: 600, f1: 3000, q: 1.2 }),
  // Aucun effet : deux « tocs » creux.
  immune: (c, t, out) => {
    tone(c, out, t, { f0: 330, f1: 220, dur: 0.13, type: 'triangle', vol: 0.3 })
    tone(c, out, t, { at: 0.14, f0: 250, f1: 170, dur: 0.18, type: 'triangle', vol: 0.3 })
    noise(c, out, t, { dur: 0.03, vol: 0.3, f0: 2000 })
  },
  status: (c, t, out) => {
    ;[700, 560, 420].forEach((f, i) => tone(c, out, t, { at: i * 0.09, f0: f, f1: f * 0.9, dur: 0.11, type: 'triangle', vol: 0.25 }))
  },
  faint: (c, t, out) => tone(c, out, t, { f0: 520, f1: 90, dur: 0.55, type: 'triangle', vol: 0.3 }),
  win: (c, t, out) => {
    ;[523, 659, 784, 1047].forEach((f, i) => {
      const d = i === 3 ? 0.45 : 0.12
      tone(c, out, t, { at: i * 0.12, f0: f, dur: d, vol: 0.17 })
      tone(c, out, t, { at: i * 0.12, f0: f / 2, dur: d, type: 'triangle', vol: 0.17 })
    })
  },
  lose: (c, t, out) => {
    ;[392, 349, 311, 261].forEach((f, i) => tone(c, out, t, { at: i * 0.2, f0: f, dur: i === 3 ? 0.55 : 0.2, type: 'triangle', vol: 0.26 }))
  },
}
