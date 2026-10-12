// Fiche d'une attaque : description officielle (FR : src/data/moves.desc.fr.json, voir scripts/build_move_desc.mjs ;
// EN : texte court de @pkmn/dex) et libellés des champs. Les chiffres (puissance, précision, PP, priorité, cible) viennent du simulateur.
import { Dex } from '@pkmn/dex'
import desc from '../data/moves.desc.fr.json'
import { getLang, hasKey, t } from '../i18n'

const D = desc as Record<string, string>
const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Description d'une attaque dans la langue courante (vide si inconnue). « Hidden Power Fire 70 » → Puissance Cachée. */
export const moveDesc = (name: string): string => {
  const base = name.replace(/^(Hidden Power) .*/, '$1')
  if (getLang() === 'en') return Dex.forGen(4).moves.get(base).shortDesc ?? ''
  return D[toId(base)] ?? ''
}

/** Libellé de la cible d'une attaque (clés `tg.*`) ; texte brut si inconnue. */
export const targetLabel = (target: string): string => {
  const k = `tg.${target}`
  return hasKey(k) ? t(k) : target
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
