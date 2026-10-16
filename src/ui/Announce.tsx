import { useEffect, useState } from 'react'
import { Swords } from 'lucide-react'
import { DOUBLE_FROM_MS } from '../game/rng'
import { locale, t, useLang } from '../i18n'

// Notif ponctuelle « 2 combats par jour » (même présentation que l'ancien sondage, voir PrefPoll.tsx, désormais désactivé).
// Affichée une seule fois par compte et par appareil ; `hold` la masque sans la perdre (autre écran que l'accueil, bandeau de mise à jour).
const SHOW_DELAY_MS = 2500
const seenKey = (userId: string) => `pokedle:announce:twoBattles:${userId}`

function seen(userId: string): boolean {
  try {
    return localStorage.getItem(seenKey(userId)) === '1'
  } catch {
    return false
  }
}

/** Heure locale de l'appareil pour l'heure UTC `h` du jour de bascule ; null si elle est identique à celle de Kuala Lumpur (UTC+8). */
export function localTimes(): { a: string; b: string } | null {
  if (new Date().getTimezoneOffset() === -480) return null
  const fmt = (h: number) => new Date(DOUBLE_FROM_MS + (h - 4) * 3600_000).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })
  return { a: fmt(4), b: fmt(10) }
}

export function Announce({ userId, hold }: { userId: string | null; hold: boolean }) {
  return <AnnounceFor key={userId ?? 'anon'} userId={userId} hold={hold} /> // un autre compte reçoit sa propre annonce
}

function AnnounceFor({ userId, hold }: { userId: string | null; hold: boolean }) {
  useLang()
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!userId || seen(userId)) return
    const id = window.setTimeout(() => setShow(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(id)
  }, [userId])
  if (hold || !show || !userId) return null
  const close = () => {
    setShow(false)
    try {
      localStorage.setItem(seenKey(userId), '1')
    } catch {
      /* stockage indisponible : l'annonce reviendra au prochain lancement */
    }
  }
  const date = new Date(DOUBLE_FROM_MS).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })
  const local = localTimes()
  return (
    <section className="prefpoll" aria-labelledby="announce-title">
      <div>
        <div className="prefpoll-eyebrow"><Swords size={13} style={{ verticalAlign: -2 }} /> {t('announce.eyebrow')}</div>
        <h2 id="announce-title" className="prefpoll-title">{t('announce.title', { date })}</h2>
        <p className="prefpoll-body muted">{t('announce.body')}{local ? ` ${t('announce.local', local)}` : ''}</p>
      </div>
      <button type="button" className="btn" onClick={close}>{t('announce.ok')}</button>
    </section>
  )
}
