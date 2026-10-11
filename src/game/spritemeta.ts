// Métadonnées visuelles par espèce (couleurs, silhouette, détails) issues de l'analyse Vision des sprites
// de référence — voir scripts/analyze_sprites.py puis scripts/build_sprite_meta.ts.
// Aucun pixel officiel n'est embarqué : on ne garde que quelques indices (couleurs hex, archétype…) qui
// pilotent le générateur de src/game/sprites.ts. Sans entrée pour une espèce, le générateur retombe sur
// la logique d'origine (types + graine de la ligne évolutive).
import raw from '../data/sprite_meta.json'

export type Arch = 'biped' | 'quad' | 'blob' | 'serpent' | 'bird' | 'fish' | 'insect' | 'floater'

export interface SpriteMeta {
  arch?: Arch
  /** Couleurs hex « #rrggbb » : corps, accent (ventre / extrémités), déco. */
  colors?: string[]
  /** 0 oreilles pointues, 1 oreilles rondes, 2 corne. */
  ear?: 0 | 1 | 2
  /** 0 queue fine, 1 queue à bout rond, 2 queue pointue/en pagaie. */
  tail?: 0 | 1 | 2
  noTail?: boolean
  spiky?: boolean
}

const META = raw as Record<string, SpriteMeta>

export const spriteMeta = (num: number): SpriteMeta | undefined => META[String(num)]
