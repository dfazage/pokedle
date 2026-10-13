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
      if (!owner) return false // aucun compte n'a été vu sur cet appareil
      clearLocalGameState()
      localStorage.removeItem(OWNER_KEY)
      return true
    }
    if (owner === userId) return false
    // Propriétaire inconnu (état d'avant ce correctif) ou différent : on ne sait pas à qui appartient l'état local, on le vide.
    // L'app impose d'être connecté pour jouer : l'historique, les cœurs et l'avatar reviennent du serveur.
    clearLocalGameState()
    localStorage.setItem(OWNER_KEY, userId)
    return true
  } catch {
    return false
  }
}
