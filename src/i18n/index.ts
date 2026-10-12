// Internationalisation FR / EN, sans dépendance : un petit store externe + des dictionnaires typés.
//  • t('clé', { param })        → texte dans la langue courante (utilisable partout, hors composants compris)
//  • tn('clé', n, { param })    → pluriel : lit `clé_one` / `clé_other`
//  • useLang()                  → { lang, setLang } ; abonne le composant aux changements de langue
//  • parse('clé', texte)        → retrouve les paramètres d'un message déjà formaté (toutes langues) : sert aux sons de combat
import { useSyncExternalStore } from 'react'
import { fr } from './fr'
import { en } from './en'

export type Lang = 'fr' | 'en'
export type Key = keyof typeof fr
export const LANGS: Lang[] = ['fr', 'en']

const DICTS: Record<Lang, Record<Key, string>> = { fr, en }
const STORE_KEY = 'pokedle:lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible */
  }
  // Première visite : langue du navigateur (français si fr-*, anglais sinon). Hors navigateur (scripts de test) : français.
  if (typeof window === 'undefined') return 'fr'
  return (navigator.languages?.[0] ?? navigator.language ?? 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

let current: Lang = detect()
const listeners = new Set<() => void>()
const syncDocument = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = current
}
syncDocument()

export const getLang = (): Lang => current
export function setLang(l: Lang) {
  if (l === current) return
  current = l
  try {
    localStorage.setItem(STORE_KEY, l)
  } catch {
    /* stockage indisponible */
  }
  syncDocument()
  listeners.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Abonne le composant à la langue (re-rendu au changement) et renvoie la langue courante. */
export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return { lang, setLang }
}

type Params = Record<string, string | number | undefined | null>

export const hasKey = (k: string): k is Key => k in fr

export function t(key: Key, params?: Params): string {
  const s = DICTS[current][key] ?? fr[key] ?? key
  return params ? s.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? '')) : s
}

type PluralBase = Key extends infer K ? (K extends `${infer B}_one` ? B : never) : never
/** Pluriel : en français 0 et 1 sont au singulier, en anglais seul 1. */
export function tn(base: PluralBase, n: number, params?: Params): string {
  const one = n === 1 || (current === 'fr' && n === 0)
  return t(`${base}_${one ? 'one' : 'other'}` as Key, { n, ...params })
}

/** Choisit une valeur selon la langue (tableaux de mois, etc.). */
export const pick = <T,>(frVal: T, enVal: T): T => (current === 'fr' ? frVal : enVal)
/** Locale pour toLocaleString / Intl. */
export const locale = () => (current === 'fr' ? 'fr-FR' : 'en-US')

// ── Analyse inverse d'un message formaté ──
const rxCache = new Map<string, RegExp>()
function compile(tpl: string) {
  let rx = rxCache.get(tpl)
  if (!rx) {
    const src = tpl
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('')
    rx = new RegExp(`^${src}$`)
    rxCache.set(tpl, rx)
  }
  return rx
}
/**
 * Essaie le gabarit `key` dans toutes les langues : renvoie les valeurs des paramètres (dans l'ordre d'apparition),
 * ou null si le message ne correspond pas. Un gabarit sans paramètre renvoie un tableau vide (donc « vrai »).
 */
export function parse(key: Key, msg: string): string[] | null {
  for (const l of LANGS) {
    const m = msg.match(compile(DICTS[l][key]))
    if (m) return m.slice(1)
  }
  return null
}
