// Sprites des dresseurs, lus à la volée sur Pokémon Showdown (aucun fichier hébergé chez nous).
// PokéAPI ne fournit pas de sprites de dresseurs : on utilise le dossier /sprites/trainers/ de Showdown, dont les
// noms de fichiers correspondent à nos ids de dresseurs (brock, ltsurge, crasherwake, cynthia…).
// Ordre d'essai : sprite générique récent (style DS/BW, ex. ltsurge.png), puis variante de la génération du défi
// (ex. brock-gen1, lance-gen2) en repli si le sprite récent n'existe pas pour cet id.
// Si rien ne charge (hors-ligne, id inconnu), on affiche `fallback` (l'orbe de type).
// VITE_TRAINER_SPRITES_URL permet de pointer vers un miroir (même arborescence).
import { useEffect, useState } from 'react'
import type { ImgHTMLAttributes, ReactNode } from 'react'

const ROOT = (((import.meta.env?.VITE_TRAINER_SPRITES_URL as string | undefined) ?? 'https://play.pokemonshowdown.com/sprites/trainers')).replace(/\/$/, '')

export const trainerSpriteUrls = (id: string, gen: number): string[] => [`${ROOT}/${id}.png`, `${ROOT}/${id}-gen${gen}.png`]

type Props = { id: string; gen: number; fallback: ReactNode } & Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'>

export function TrainerImg({ id, gen, fallback, ...img }: Props) {
  const [failed, setFailed] = useState(0) // nombre d'URL déjà en échec pour ce dresseur
  useEffect(() => setFailed(0), [id, gen])
  const src = trainerSpriteUrls(id, gen)[failed]
  if (!src) return <>{fallback}</>
  // Pas de crossOrigin : Showdown n'envoie pas d'en-tête CORS, l'image serait rejetée. Réponse « opaque » mais
  // affichable, et mise en cache telle quelle par le service worker (statuts 0 et 200 acceptés, voir vite.config.ts).
  return <img {...img} alt="" src={src} onError={() => setFailed((n) => n + 1)} />
}
