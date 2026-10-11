// Illustrations des Pokémon, lues à la volée dans le dépôt PokéAPI/sprites (aucun fichier hébergé chez nous) :
//  - sprites de la version de la génération en cours (Rouge/Bleu, Cristal, Émeraude, Platine ; face et dos) ;
//  - artwork officiel pour les grandes cartes (fiche, aperçu).
// Si l'image est introuvable (forme, hors-ligne…), on retombe sur le sprite, puis sur le sprite généré par code
// de game/sprites.ts. Les images sont mises en cache par le service worker (voir vite.config.ts).
// VITE_SPRITES_URL permet de pointer vers un miroir de PokéAPI/sprites (même arborescence).
import { useEffect, useMemo, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { spriteUrl } from './sprites'
import type { SpriteSpec } from './sprites'

const ROOT = (((import.meta.env?.VITE_SPRITES_URL as string | undefined) ?? 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon')).replace(/\/$/, '')
// génération -> [dossier de génération, version]
const VERSIONS: Record<number, [string, string]> = {
  1: ['generation-i', 'red-blue'],
  2: ['generation-ii', 'crystal'],
  3: ['generation-iii', 'emerald'],
  4: ['generation-iv', 'platinum'],
}
let currentGen = 0

/** Génération du combat du jour — posée une fois par App avant le rendu des écrans. */
export function setSpriteGen(gen: number | undefined) {
  currentGen = gen ?? 0
}

export function officialSpriteUrl(num: number, back: boolean, gen = currentGen): string {
  const v = VERSIONS[gen]
  return v ? `${ROOT}/versions/${v[0]}/${v[1]}/${back ? 'back/' : ''}${num}.png` : ''
}

export const artworkUrl = (num: number): string => `${ROOT}/other/official-artwork/${num}.png`

type Props = { spec: SpriteSpec; back?: boolean; artwork?: boolean } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

export function MonImg({ spec, back = false, artwork = false, ...img }: Props) {
  const gen = currentGen
  const [failed, setFailed] = useState(0) // nombre d'images déjà en échec pour cette espèce
  useEffect(() => setFailed(0), [spec.num, back, artwork, gen])
  const candidates = [artwork && !back ? artworkUrl(spec.num) : '', officialSpriteUrl(spec.num, back, gen)].filter(Boolean)
  const remote = candidates[failed] ?? ''
  const generated = useMemo(() => (remote ? '' : spriteUrl(spec, back)), [remote, spec.num, spec.types.join('/'), back]) // eslint-disable-line react-hooks/exhaustive-deps
  // crossOrigin : réponses « non opaques » → le cache du service worker garde la vraie taille (pas de quota gonflé).
  return <img {...img} src={remote || generated} crossOrigin={remote ? 'anonymous' : undefined} onError={remote ? () => setFailed((n) => n + 1) : undefined} />
}
