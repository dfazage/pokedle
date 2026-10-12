// Illustrations des Pokémon, lues à la volée dans le dépôt PokéAPI/sprites (aucun fichier hébergé chez nous) :
//  - sprites Platine (génération 4, face et dos) pour toutes les générations du jeu : rendu uniforme, et la gen 4
//    couvre les 493 espèces ;
//  - artwork officiel pour les grandes cartes (fiche, aperçu).
// Si l'image est introuvable (forme, hors-ligne…), on retombe sur le sprite, puis sur le sprite généré par code
// de game/sprites.ts. Les images sont mises en cache par le service worker (voir vite.config.ts).
// VITE_SPRITES_URL permet de pointer vers un miroir de PokéAPI/sprites (même arborescence).
// Avec la prop `animated`, on tente d'abord le GIF animé BW/BW2 de Pokémon Showdown (gen5ani, face et dos, 649 espèces),
// lu à la volée (hotlink, sans CORS : réponse opaque mais affichable) ; VITE_SHOWDOWN_SPRITES_URL pointe vers un miroir.
import { useEffect, useMemo, useState } from 'react'
import { Dex } from '@pkmn/dex'
import type { ImgHTMLAttributes } from 'react'
import { spriteUrl } from './sprites'
import type { SpriteSpec } from './sprites'

const ROOT = (((import.meta.env?.VITE_SPRITES_URL as string | undefined) ?? 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon')).replace(/\/$/, '')
const SPRITE_VERSION = 'versions/generation-iv/platinum'

export const officialSpriteUrl = (num: number, back: boolean): string => `${ROOT}/${SPRITE_VERSION}/${back ? 'back/' : ''}${num}.png`

const SD_ROOT = (((import.meta.env?.VITE_SHOWDOWN_SPRITES_URL as string | undefined) ?? 'https://play.pokemonshowdown.com/sprites')).replace(/\/$/, '')

// Showdown nomme les fichiers par id d'espèce (« mrmime », « nidoranf »), pas par numéro de Pokédex.
let sdIds: Map<number, string> | null = null
export function showdownId(num: number): string | undefined {
  if (!sdIds) {
    sdIds = new Map()
    for (const s of Dex.forGen(5).species.all()) if (!s.forme && s.num > 0 && s.num <= 649) sdIds.set(s.num, s.id)
  }
  return sdIds.get(num)
}

export const animatedSpriteUrl = (num: number, back: boolean): string => {
  const id = showdownId(num)
  return id ? `${SD_ROOT}/gen5ani${back ? '-back' : ''}/${id}.gif` : ''
}

export const artworkUrl = (num: number): string => `${ROOT}/other/official-artwork/${num}.png`

type Props = { spec: SpriteSpec; back?: boolean; artwork?: boolean; animated?: boolean } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

export function MonImg({ spec, back = false, artwork = false, animated = false, ...img }: Props) {
  const [failed, setFailed] = useState(0) // nombre d'images déjà en échec pour cette espèce
  useEffect(() => setFailed(0), [spec.num, back, artwork, animated])
  const candidates = [artwork && !back ? artworkUrl(spec.num) : '', animated && !artwork ? animatedSpriteUrl(spec.num, back) : '', officialSpriteUrl(spec.num, back)].filter(Boolean)
  const remote = candidates[failed] ?? ''
  const generated = useMemo(() => (remote ? '' : spriteUrl(spec, back)), [remote, spec.num, spec.types.join('/'), back]) // eslint-disable-line react-hooks/exhaustive-deps
  // crossOrigin : réponses « non opaques » → le cache du service worker garde la vraie taille (pas de quota gonflé).
  return <img {...img} src={remote || generated} crossOrigin={remote && !remote.startsWith(SD_ROOT) ? 'anonymous' : undefined} onError={remote ? () => setFailed((n) => n + 1) : undefined} />
}
