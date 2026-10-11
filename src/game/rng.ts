// PRNG déterministe : la même clé de jour donne la même partie pour tout le monde.
export function hashString(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Rand = () => number

export function pick<T>(rand: Rand, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

export function shuffle<T>(rand: Rand, arr: readonly T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function seedArray(seed: number): [number, number, number, number] {
  const r = mulberry32(seed)
  return [
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
    Math.floor(r() * 65536),
  ]
}

/** Jour de référence en UTC (YYYY-MM-DD). Le jeu change à minuit UTC. */
export function dayKeyUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}
