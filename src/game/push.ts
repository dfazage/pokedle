// Notifications push (Web Push) : « le combat du jour est disponible », envoyées à 12h (Paris) par l'Edge Function
// send-daily-push. Le navigateur fournit une souscription (endpoint + clés) que l'on enregistre côté Supabase ; voir
// supabase/push_subscriptions.sql. Sans VITE_VAPID_PUBLIC_KEY (ou sans Supabase) la fonctionnalité reste cachée.
import { supabase } from './cloud'
import { getLang } from '../i18n'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

/** off : pas (encore) activé · on : abonné · denied : permission refusée dans le navigateur · ios-install : iPhone/iPad,
 *  il faut d'abord ajouter la PWA à l'écran d'accueil · unsupported : navigateur sans Push API. */
export type PushState = 'off' | 'on' | 'denied' | 'ios-install' | 'unsupported'

/** Fonctionnalité disponible dans ce build (clé VAPID publique + Supabase). */
export const pushConfigured = (): boolean => !!VAPID_PUBLIC_KEY && !!supabase

const isIos = (): boolean => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = (): boolean => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const hasPush = (): boolean => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** applicationServerKey attend des octets : la clé VAPID publique est en base64url. */
function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/** Enregistre (ou réattribue au compte courant) la souscription côté serveur. */
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  if (!supabase) return false
  const json = sub.toJSON()
  const { endpoint, keys } = json
  if (!endpoint || !keys?.p256dh || !keys.auth) return false
  const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth, p_lang: getLang() })
  return !error
}

export async function pushState(): Promise<PushState> {
  if (!hasPush()) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission !== 'granted') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** À appeler suite à un geste de l'utilisateur (bouton) : demande la permission, s'abonne, enregistre côté serveur. */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !hasPush()) return pushState()
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
  if (!(await saveSubscription(sub))) {
    await sub.unsubscribe() // pas enregistrée côté serveur : on n'en garde pas une qui ne servirait à rien
    throw new Error('save_push_subscription')
  }
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  if (!hasPush()) return pushState()
  const sub = await currentSubscription()
  if (sub) {
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await supabase?.rpc('delete_push_subscription', { p_endpoint: endpoint })
  }
  return pushState()
}

/** À chaque lancement, une fois connecté : si la permission est déjà accordée, on s'assure que la souscription existe
 *  (le navigateur peut l'avoir renouvelée ou perdue) et que le serveur la connaît avec la langue courante. Silencieux. */
export async function syncPush(): Promise<void> {
  try {
    if (!VAPID_PUBLIC_KEY || !supabase || !hasPush() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
    await saveSubscription(sub)
  } catch {
    /* hors-ligne, service worker indisponible… : on réessaiera au prochain lancement */
  }
}
