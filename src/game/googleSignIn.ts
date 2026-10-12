import { supabase } from './cloud'

/** Client ID OAuth « Web » de Google Cloud (public par conception). Même ID que dans Supabase → Providers → Google. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

type Credential = { credential: string }
type Gsi = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: Credential) => void; nonce?: string; use_fedcm_for_prompt?: boolean }) => void
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
    }
  }
}
declare global {
  interface Window {
    google?: Gsi
  }
}

let scriptPromise: Promise<boolean> | null = null
/** Charge le script Google Identity Services une seule fois ; false si bloqué (adblock, hors-ligne). */
const loadGsi = (): Promise<boolean> => {
  if (window.google?.accounts) return Promise.resolve(true)
  scriptPromise ??= new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve(!!window.google?.accounts)
    s.onerror = () => {
      scriptPromise = null
      resolve(false)
    }
    document.head.appendChild(s)
  })
  return scriptPromise
}

const sha256Hex = async (s: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Affiche le bouton « Se connecter avec Google » (Google Identity Services) dans `el`.
 * Google affiche alors le domaine du site (pokebadle.fun) au lieu du callback supabase.co ; le jeton est ensuite
 * échangé contre une session Supabase via signInWithIdToken. Le nonce brut va à Supabase, sa version hachée à Google.
 * Renvoie false si GIS est indisponible : l'appelant garde alors le flux OAuth classique.
 */
export const renderGoogleButton = async (
  el: HTMLElement,
  cb: { onStart: () => void; onError: (message: string) => void; onDone: () => void; locale: string; width: number },
): Promise<boolean> => {
  if (!supabase || !GOOGLE_CLIENT_ID || !(await loadGsi()) || !window.google) return false
  const raw = crypto.randomUUID() + crypto.randomUUID()
  const hashed = await sha256Hex(raw)
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashed,
    use_fedcm_for_prompt: true,
    callback: async ({ credential }) => {
      cb.onStart()
      const { error } = await supabase!.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: raw })
      if (error) cb.onError(error.message)
      else cb.onDone()
    },
  })
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    locale: cb.locale,
    width: cb.width,
  })
  return true
}
