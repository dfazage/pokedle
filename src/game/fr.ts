// Noms d'affichage localisés (FR / EN) : espèces, attaques, talents, objets, natures, types, classes de dresseurs, versions du jeu.
// Les données sources (Showdown, trainers*.json) sont en anglais : en EN on les affiche telles quelles.
import names from '../data/names.fr.json'
import trainersFr from '../data/trainers.fr.json'
import { getLang, hasKey, t } from '../i18n'

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sp = names.species as Record<string, string>
const mv = names.moves as Record<string, string>
const ab = names.abilities as Record<string, string>
const it = names.items as Record<string, string>
const nt = names.natures as Record<string, string>

/** Nom d'une espèce dans la langue courante (retombe sur le nom anglais). */
export const spName = (name: string) => {
  if (getLang() === 'en') return name
  const direct = sp[toId(name)]
  if (direct) return direct
  // Formes (« Unown-M », « Deoxys-Attack ») : nom français de l'espèce de base + forme.
  const i = name.indexOf('-')
  if (i > 0) {
    const base = sp[toId(name.slice(0, i))]
    if (base) return `${base}-${name.slice(i + 1)}`
  }
  return name
}
/** Nom d'un dresseur dans la langue courante (« Wallace » → « Marc »). Les noms sans entrée (Erika, Cynthia, Giovanni…) sont identiques en français. */
export const trainerName = (name: string) => (getLang() === 'en' ? name : ((trainersFr as Record<string, string>)[toId(name)] ?? name))
/** Nom d'une attaque dans la langue courante (retombe sur le nom anglais). */
export const mvName = (name: string) => (getLang() === 'en' ? name : (mv[toId(name)] ?? name))
/** Talent, objet et nature dans la langue courante (retombent sur le nom anglais). */
export const abName = (name: string) => (getLang() === 'en' ? name : (ab[toId(name)] ?? name))
export const itemName = (name: string) => (getLang() === 'en' ? name : (it[toId(name)] ?? name))
export const natureName = (name: string) => (getLang() === 'en' ? name : (nt[toId(name)] ?? name))
/** Anciens noms, conservés pour les scripts de test (scripts/*.ts). */
export const spFr = spName
export const mvFr = mvName

/** Nom d'un type (« Fire » → « Feu » / « Fire »). */
export const TYPE_FR: Record<string, string> = {
  Normal: 'Normal', Fire: 'Feu', Water: 'Eau', Electric: 'Électrik', Grass: 'Plante', Ice: 'Glace', Fighting: 'Combat',
  Poison: 'Poison', Ground: 'Sol', Flying: 'Vol', Psychic: 'Psy', Bug: 'Insecte', Rock: 'Roche', Ghost: 'Spectre',
  Dragon: 'Dragon', Dark: 'Ténèbres', Steel: 'Acier',
}
export const typeName = (type: string) => (getLang() === 'en' ? type : (TYPE_FR[type] ?? type))

/** Lieux de combat (champ `stage` des fichiers de dresseurs, écrits en français) → anglais. */
const STAGE_EN: Record<string, string> = {
  'Repaire Rocket': 'Rocket Hideout',
  'Sylphe SARL': 'Silph Co.',
  'Route 22': 'Route 22',
  'Mont Argenté': 'Mt. Silver',
  'Route Victoire': 'Victory Road',
  'Monde Distorsion': 'Distortion World',
  'QG Galaxie': 'Galactic HQ',
}
const stageName = (stage: string) => (getLang() === 'en' ? (STAGE_EN[stage] ?? stage) : stage)

/** Classe du dresseur, suivie du lieu du combat quand il y en a un (« Chef d'équipe (Repaire Rocket) »). */
export const classLabel = (tr: { class: string; stage?: string | null }) => {
  const key = `class.${tr.class}`
  const label = hasKey(key) ? t(key) : tr.class // classe inconnue : texte brut
  return label + (tr.stage ? ` (${stageName(tr.stage)})` : '')
}

/** Infos par génération. `game` est un getter : il suit la langue courante. */
export const GEN_INFO: Record<number, { roman: string; region: string; game: string; species: string }> = {
  1: { roman: 'I', region: 'Kanto', get game() { return t('game.red') }, species: '#001 → #151' },
  2: { roman: 'II', region: 'Johto', get game() { return t('game.crystal') }, species: '#001 → #251' },
  3: { roman: 'III', region: 'Hoenn', get game() { return t('game.emerald') }, species: '#001 → #386' },
  4: { roman: 'IV', region: 'Sinnoh', get game() { return t('game.platinum') }, species: '#001 → #493' },
}
