import { useEffect, useState } from 'react'
import { Bell, Flame, X } from 'lucide-react'
import type { DayRecord } from '../game/history'
import { calendarWeek, weekCells, type CalState } from '../game/week'
import { enablePush, pushConfigured, pushState } from '../game/push'
import { loadSnooze, saveSnooze, shouldAskPush } from '../game/pushAsk'
import { locale, t, tn, useLang } from '../i18n'

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

const dayName = (key: string) => {
  const s = new Date(key + 'T00:00:00Z').toLocaleDateString(locale(), { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const dayShort = (key: string) => new Date(key + 'T00:00:00Z').toLocaleDateString(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' })
const STATE_LABEL: Record<CalState, 'res.week.win' | 'res.week.loss' | 'res.week.none' | 'home.weekToday' | 'home.weekFuture'> = {
  win: 'res.week.win',
  loss: 'res.week.loss',
  none: 'res.week.none',
  today: 'home.weekToday',
  future: 'home.weekFuture',
}

/** Victoire : une Poké Ball à plat (le liseré prend la couleur de la carte). */
function BallIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 36 36" aria-hidden>
      <path d="M2 18a16 16 0 0 1 32 0z" fill="#ef4444" />
      <path d="M2 18a16 16 0 0 0 32 0z" fill="#f4f4f8" />
      <rect x="2" y="16" width="32" height="4" className="cw-band" />
      <circle cx="18" cy="18" r="5.5" fill="#f4f4f8" className="cw-btn" strokeWidth="3" />
    </svg>
  )
}

/** Accueil : la semaine en cours (lundi → dimanche) — une case par jour, puis la série de la semaine. */
export function WeekCard({ history, today }: { history: DayRecord[]; today: string }) {
  useLang()
  const w = calendarWeek(history, today)
  const sub = w.todayDone ? t('home.weekSub.done') : w.run > 0 ? t('home.weekSub.keep') : t('home.weekSub.start')
  return (
    <>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">{t('home.weekKicker', { n: w.number })}</div>
          <h2 className="title">{t('res.week')}</h2>
        </div>
        <span className="pill">{dayShort(w.from)} → {dayShort(w.to)}</span>
      </div>
      <section className="card cw">
        <div className="cw-days" role="list" aria-label={t('res.week')}>
          {w.cells.map((c) => (
            <div key={c.dayKey} className={c.isToday ? 'cw-d today' : 'cw-d'} role="listitem" aria-label={`${dayName(c.dayKey)} ${new Date(c.dayKey + 'T00:00:00Z').getUTCDate()} · ${t(STATE_LABEL[c.state])}`}>
              <span className={`cw-dot ${c.state}`} aria-hidden>
                {c.state === 'win' ? <BallIcon /> : c.state === 'loss' ? <X size={16} strokeWidth={3.2} /> : c.state === 'today' ? <i /> : null}
              </span>
              <span className="cw-l">{dayName(c.dayKey)}</span>
              <span className="cw-n">{new Date(c.dayKey + 'T00:00:00Z').getUTCDate()}</span>
            </div>
          ))}
        </div>
        <hr className="cw-sep" />
        <div className="row between">
          <div className="cw-foot">
            <b>{w.run > 0 ? tn('home.weekRun', w.run) : t('home.weekRun0')}</b>
            <span className="muted small">{sub}</span>
          </div>
          <span className="pill yellow" aria-label={tn('home.weekWins', w.wins)}>{w.wins}/7</span>
        </div>
      </section>
    </>
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
