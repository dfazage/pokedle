import names from '../data/names.fr.json'

const toId = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const sp = names.species as Record<string, string>
const mv = names.moves as Record<string, string>

/** Nom français d'une espèce (retombe sur le nom anglais). */
export const spFr = (name: string) => {
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
/** Nom français d'une attaque (retombe sur le nom anglais). */
export const mvFr = (name: string) => mv[toId(name)] ?? name

export const TYPE_FR: Record<string, string> = {
  Normal: 'Normal', Fire: 'Feu', Water: 'Eau', Electric: 'Électrik', Grass: 'Plante', Ice: 'Glace', Fighting: 'Combat',
  Poison: 'Poison', Ground: 'Sol', Flying: 'Vol', Psychic: 'Psy', Bug: 'Insecte', Rock: 'Roche', Ghost: 'Spectre',
  Dragon: 'Dragon', Dark: 'Ténèbres', Steel: 'Acier',
}
export const CLASS_FR: Record<string, string> = {
  'Gym Leader': "Champion d'arène",
  'Kanto Gym Leader': "Champion d'arène de Kanto",
  'Elite Four': 'Conseil des 4',
  Champion: 'Maître de la Ligue',
}
export const GEN_INFO: Record<number, { roman: string; region: string; game: string; species: string }> = {
  1: { roman: 'I', region: 'Kanto', game: 'Rouge', species: '#001 → #151' },
  2: { roman: 'II', region: 'Johto', game: 'Cristal', species: '#001 → #251' },
  3: { roman: 'III', region: 'Hoenn', game: 'Émeraude', species: '#001 → #386' },
  4: { roman: 'IV', region: 'Sinnoh', game: 'Platine', species: '#001 → #493' },
}
