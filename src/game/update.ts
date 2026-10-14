// Détection d'un bundle périmé : l'app compare son identifiant de build (__BUILD__) à celui de dist/version.json, servi sans cache.
// Pourquoi : le tirage du dresseur du jour est calculé dans le navigateur ; un client resté sur un ancien bundle (onglet ouvert,
// premier chargement servi par l'ancien précache du service worker) tirerait un autre dresseur que les autres joueurs.
import { useCallback, useEffect, useState } from 'react'

/** Pas de contrôle en développement (`vite dev` n'émet pas version.json et __BUILD__ vaut « dev » hors dépôt git). */
const ENABLED = typeof __BUILD__ === 'string' && __BUILD__ !== 'dev'
const CHECK_EVERY_MS = 10 * 60_000
const MIN_GAP_MS = 60_000
const TRY_KEY = 'pokedle:updateTry'
/** Délai pendant lequel on ne relance pas automatiquement une mise à jour vers la même version (anti-boucle de rechargement). */
const RETRY_AFTER_MS = 2 * 60_000

/** Identifiant de build publié par le serveur, ou null (hors ligne, fichier absent, réponse invalide). */
export async function fetchServerBuild(): Promise<string | null> {
  if (!ENABLED) return null
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { build?: unknown }
    return typeof data.build === 'string' && data.build && data.build !== 'dev' ? data.build : null
  } catch {
    return null
  }
}

/** Renvoie l'identifiant de la version serveur si elle diffère de celle de l'app, sinon null. */
export async function staleBuild(): Promise<string | null> {
  const server = await fetchServerBuild()
  return server && server !== __BUILD__ ? server : null
}

/**
 * Met à jour : désinscrit le service worker, vide le précache de l'app (pas les sprites ni les cris, lourds) puis recharge.
 * Au rechargement la page vient du réseau et le service worker se réinstalle avec le nouveau bundle.
 */
export async function applyUpdate(): Promise<void> {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? []
    await Promise.all(regs.map((r) => r.unregister()))
  } catch {
    /* service worker indisponible */
  }
  try {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => /precache/i.test(k)).map((k) => caches.delete(k)))
  } catch {
    /* Cache API indisponible */
  }
  window.location.reload()
}

/**
 * Mise à jour automatique (sans action du joueur), avec garde-fou : une seule tentative par version et par fenêtre de 2 minutes,
 * pour ne jamais boucler si le serveur sert encore un ancien index.html. Renvoie true si le rechargement est lancé.
 */
export function autoUpdate(serverBuild: string): boolean {
  try {
    const last = JSON.parse(sessionStorage.getItem(TRY_KEY) ?? 'null') as { to?: string; at?: number } | null
    if (last?.to === serverBuild && typeof last.at === 'number' && Date.now() - last.at < RETRY_AFTER_MS) return false
    sessionStorage.setItem(TRY_KEY, JSON.stringify({ to: serverBuild, at: Date.now() }))
  } catch {
    return false // sans sessionStorage on ne peut pas garantir l'absence de boucle
  }
  void applyUpdate()
  return true
}

/** true quand le serveur publie une autre version que celle qui tourne : au lancement, toutes les 10 min et au retour au premier plan. */
export function useUpdateAvailable(): { available: boolean; recheck: () => void } {
  const [available, setAvailable] = useState(false)
  const recheck = useCallback(() => {
    void staleBuild().then((s) => setAvailable(!!s))
  }, [])
  useEffect(() => {
    if (!ENABLED) return
    let last = 0
    const run = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < MIN_GAP_MS) return
      last = Date.now()
      recheck()
    }
    const first = window.setTimeout(run, 3000)
    const timer = window.setInterval(run, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', run)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [recheck])
  return { available, recheck }
}
