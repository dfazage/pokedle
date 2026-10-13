// L'état de jeu local (choix du combat, ordre, essais, grille, historique, avatar) vit dans le navigateur, partagé par tous les comptes.
// On retient à qui il appartient : si un autre compte se connecte (ou après une déconnexion), on le vide pour ne pas rejouer
// le combat du compte précédent (combat « déjà fini » et victoire d'un autre joueur).
const OWNER_KEY = 'pokedle:owner'
const PREFIXES = ['pokedle:progress:', 'pokedle:order:', 'pokedle:attempt:', 'pokedle:grid:', 'pokedle:reset:']
const EXACT = ['pokedle:history:v1', 'pokedle.avatar']

function clearLocalGameState() {
  const doomed: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (EXACT.includes(k) || PREFIXES.some((p) => k.startsWith(p)))) doomed.push(k)
  }
  doomed.forEach((k) => localStorage.removeItem(k))
}

/** À appeler à chaque changement d'utilisateur. Retourne true si l'état local a été vidé (l'appelant doit alors réinitialiser son état mémoire). */
export function syncLocalOwner(userId: string | null): boolean {
  try {
    const owner = localStorage.getItem(OWNER_KEY)
    if (userId === null) {
      if (!owner) return false // invité qui n'a jamais été connecté : on garde son état
      clearLocalGameState()
      localStorage.removeItem(OWNER_KEY)
      return true
    }
    if (owner === userId) return false
    // Premier compte connecté sur cet appareil (owner absent) : l'état local d'un invité est conservé.
    const switched = !!owner
    if (switched) clearLocalGameState()
    localStorage.setItem(OWNER_KEY, userId)
    return switched
  } catch {
    return false
  }
}
