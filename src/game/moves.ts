// Fiche d'une attaque : description française officielle (src/data/moves.desc.fr.json, voir scripts/build_move_desc.mjs)
// et libellés des champs. Les chiffres (puissance, précision, PP, priorité, cible) viennent du simulateur.
import desc from '../data/moves.desc.fr.json'

const D = desc as Record<string, string>
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Description française d'une attaque (vide si inconnue). « Hidden Power Fire 70 » → Puissance Cachée. */
export const moveDesc = (name: string): string => D[toId(name.replace(/^(Hidden Power) .*/, '$1'))] ?? ''

export const CATEGORY_FR: Record<string, string> = { Physical: 'Physique', Special: 'Spéciale', Status: 'Statut' }

export const TARGET_FR: Record<string, string> = {
  normal: 'Un adversaire', any: 'Un Pokémon au choix', adjacentFoe: 'Un adversaire', adjacentAlly: 'Un allié',
  adjacentAllyOrSelf: 'Un allié ou soi', allAdjacentFoes: 'Tous les adversaires', allAdjacent: 'Tous les adjacents',
  self: 'Le lanceur', allySide: 'Côté allié', foeSide: 'Côté adverse', all: 'Tout le terrain',
  randomNormal: 'Un adversaire au hasard', scripted: 'Selon le contexte', allies: 'Les alliés', allyTeam: 'Équipe alliée',
}

export interface MoveFacts {
  name: string
  type: string
  category: string
  power: number
  /** Précision en % ; 0 = ne rate jamais. */
  acc: number
  pp: number
  /** PP restants (en combat). */
  ppLeft?: number
  priority: number
  target: string
}
