import { useEffect, useState } from 'react'
import { Bell, Flame } from 'lucide-react'
import type { DayRecord } from '../game/history'
import { weekCells } from '../game/week'
import { enablePush, pushConfigured, pushState } from '../game/push'
import { loadSnooze, saveSnooze, shouldAskPush } from '../game/pushAsk'
import { locale, t, useLang } from '../i18n'

const dayLetter = (key: string) => new Date(key + 'T00:00:00Z').toLocaleDateString(locale(), { weekday: 'narrow', timeZone: 'UTC' })

/** Ta semaine en sept points : victoires, défaites, jours manqués, et demain en pointillés. */
export function WeekStrip({ history, today }: { history: DayRecord[]; today: string }) {
  useLang()
  return (
    <div className="wk" role="list" aria-label={t('res.week')}>
      {weekCells(history, today).map((c) => (
        <div key={c.dayKey} className={c.isToday ? 'wk-d today' : 'wk-d'} role="listitem" aria-label={`${dayLetter(c.dayKey)} · ${t(`res.week.${c.state}`)}`}>
          <span className="wk-l">{dayLetter(c.dayKey)}</span>
          <i className={`wk-dot ${c.state}`} aria-hidden>{c.state === 'win' ? <Flame size={16} /> : null}</i>
        </div>
      ))}
    </div>
  )
}

/** Feuille proposée juste après une victoire : le joueur est content, c'est le bon moment pour les rappels. */
export function PushAsk({ win, signedIn }: { win: boolean; signedIn: boolean }) {
  useLang()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!win || !signedIn || !pushConfigured()) return
    let alive = true
    let timer = 0
    pushState()
      .then((state) => {
        if (!alive || !shouldAskPush({ win, signedIn, configured: true, state, snoozedAt: loadSnooze(), now: Date.now() })) return
        timer = window.setTimeout(() => alive && setOpen(true), 1600) // laisse jouer l'animation du cœur gagné
      })
      .catch(() => undefined)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [win, signedIn])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && later()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  if (!open) return null
  const later = () => {
    saveSnooze()
    setOpen(false)
  }
  const accept = async () => {
    setBusy(true)
    setErr(false)
    try {
      const s = await enablePush() // c'est ce tap qui déclenche l'autorisation du navigateur
      if (s === 'on') setOpen(false)
      else later() // refusé ou ignoré : on n'insiste pas avant 7 jours
    } catch {
      setErr(true)
    }
    setBusy(false)
  }
  return (
    <div className="sheet-bg" onClick={later} role="dialog" aria-modal="true" aria-label={t('push.ask.title')}>
      <div className="sheet push-ask" onClick={(e) => e.stopPropagation()}>
        <span className="rem-ico push-ask-ico" aria-hidden><Bell size={28} /></span>
        <h2 className="h2" style={{ margin: 0 }}>{t('push.ask.title')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('push.ask.body')}</p>
        <button type="button" className="btn violet" disabled={busy} onClick={accept}><Bell size={18} /> {t('push.ask.yes')}</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={later}>{t('push.ask.later')}</button>
        {err && <p className="small" style={{ color: 'var(--secondary)', margin: 0 }} role="alert">{t('push.error')}</p>}
        <p className="muted small" style={{ margin: 0 }}>{t('push.ask.foot')}</p>
      </div>
    </div>
  )
}
