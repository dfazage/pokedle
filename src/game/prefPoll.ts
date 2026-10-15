// Sondage ponctuel « 1 ou 2 combats par jour ? » : notif affichée une seule fois à chaque joueur connecté.
// Source de vérité : le serveur (supabase/battle_pref_votes.sql). Le navigateur garde seulement un drapeau par compte pour
// ne pas interroger le serveur à chaque lancement une fois la réponse donnée. Module pur (testable avec scripts/test_pref_poll.ts).
export type PrefChoice = 1 | 2

/** Délai avant que la notif remonte, pour laisser l'accueil se dessiner. */
export const ASK_DELAY_MS = 2500

/** Une clé par compte : un autre compte sur le même appareil reçoit donc sa propre question. */
export const prefKey = (userId: string) => `pokedle:prefPoll:${userId}`

export function parsePref(raw: string | null): PrefChoice | null {
  return raw === '1' ? 1 : raw === '2' ? 2 : null
}

export function loadPref(userId: string): PrefChoice | null {
  try {
    return parsePref(localStorage.getItem(prefKey(userId)))
  } catch {
    return null
  }
}

export function savePref(userId: string, choice: PrefChoice) {
  try {
    localStorage.setItem(prefKey(userId), String(choice))
  } catch {
    /* stockage indisponible : le serveur dira au prochain lancement que le joueur a déjà répondu */
  }
}
