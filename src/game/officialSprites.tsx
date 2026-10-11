// Illustrations des Pokémon, lues à la volée dans le dépôt PokéAPI/sprites (aucun fichier hébergé chez nous) :
//  - sprites Platine (génération 4, face et dos) pour toutes les générations du jeu : rendu uniforme, et la gen 4
//    couvre les 493 espèces ;
//  - artwork officiel pour les grandes cartes (fiche, aperçu).
// Si l'image est introuvable (forme, hors-ligne…), on retombe sur le sprite, puis sur le sprite généré par code
// de game/sprites.ts. Les images sont mises en cache par le service worker (voir vite.config.ts).
// VITE_SPRITES_URL permet de pointer vers un miroir de PokéAPI/sprites (même arborescence).
import { useEffect, useMemo, useState } from 'react'
import type { ImgHTMLAttributes } from 'react'
import { spriteUrl } from './sprites'
import type { SpriteSpec } from './sprites'

const ROOT = (((import.meta.env?.VITE_SPRITES_URL as string | undefined) ?? 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon')).replace(/\/$/, '')
const SPRITE_VERSION = 'versions/generation-iv/platinum'

export const officialSpriteUrl = (num: number, back: boolean): string => `${ROOT}/${SPRITE_VERSION}/${back ? 'back/' : ''}${num}.png`

export const artworkUrl = (num: number): string => `${ROOT}/other/official-artwork/${num}.png`

type Props = { spec: SpriteSpec; back?: boolean; artwork?: boolean } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

export function MonImg({ spec, back = false, artwork = false, ...img }: Props) {
  const [failed, setFailed] = useState(0) // nombre d'images déjà en échec pour cette espèce
  useEffect(() => setFailed(0), [spec.num, back, artwork])
  const candidates = [artwork && !back ? artworkUrl(spec.num) : '', officialSpriteUrl(spec.num, back)].filter(Boolean)
  const remote = candidates[failed] ?? ''
  const generated = useMemo(() => (remote ? '' : spriteUrl(spec, back)), [remote, spec.num, spec.types.join('/'), back]) // eslint-disable-line react-hooks/exhaustive-deps
  // crossOrigin : réponses « non opaques » → le cache du service worker garde la vraie taille (pas de quota gonflé).
  return <img {...img} src={remote || generated} crossOrigin={remote ? 'anonymous' : undefined} onError={remote ? () => setFailed((n) => n + 1) : undefined} />
}
