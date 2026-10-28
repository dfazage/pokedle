import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { DOUBLE_FROM_MS } from '../game/rng'
import { locale, t, useLang } from '../i18n'

// Notif ponctuelle de nouveauté (même présentation que l'ancien sondage, voir PrefPoll.tsx, désormais désactivé).
// Actuelle : « Rejoue les combats passés » (mode entraînement, v1.11.0) ; elle remplace l'annonce « 2 combats par jour » (clé twoBattles, retirée).
// Affichée une seule fois par compte et par appareil ; `hold` la masque sans la perdre (autre écran que l'accueil, bandeau de mise à jour).
const SHOW_DELAY_MS = 2500
const seenKey = (userId: string) => `pokedle:announce:practice:${userId}`
/** Bande de calendrier décorative : victoires, une défaite à rejouer (entourée), un jour non joué, aujourd'hui. */
const STRIP: { n: number; cls: string }[] = [
  { n: 21, cls: 'w' }, { n: 22, cls: 'w' }, { n: 23, cls: 'l pick' }, { n: 24, cls: '' }, { n: 25, cls: 'w' }, { n: 26, cls: 'w' }, { n: 27, cls: 'today' },
]

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

export function Announce({ userId, hold, onTry }: { userId: string | null; hold: boolean; onTry: () => void }) {
  return <AnnounceFor key={userId ?? 'anon'} userId={userId} hold={hold} onTry={onTry} /> // un autre compte reçoit sa propre annonce
}

function AnnounceFor({ userId, hold, onTry }: { userId: string | null; hold: boolean; onTry: () => void }) {
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
  return (
    <section className="prefpoll" aria-labelledby="announce-title">
      <div>
        <div className="prefpoll-eyebrow"><RotateCcw size={13} style={{ verticalAlign: -2 }} /> {t('announce.eyebrow')}</div>
        <h2 id="announce-title" className="prefpoll-title">{t('announce.title')}</h2>
        <p className="prefpoll-body muted">{t('announce.body')}</p>
      </div>
      <div className="cal announce-strip" aria-hidden="true">
        {STRIP.map((d) => <div key={d.n} className={`d ${d.cls}`}>{d.n}</div>)}
      </div>
      <div className="prefpoll-opts">
        <button type="button" className="btn ghost" onClick={close}>{t('announce.later')}</button>
        <button type="button" className="btn violet" onClick={() => { close(); onTry() }}>{t('announce.try')}</button>
      </div>
    </section>
  )
}
