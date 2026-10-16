import { useMemo, useState } from 'react'
import { AVATARS } from '../game/avatars'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Crown, Flame, LogIn, LogOut, Moon, Monitor, Pencil, Camera, Star, Sun, X, Trophy, Layers, ShieldCheck } from 'lucide-react'
import type { Ctx } from './types'
import { dayResults, recId, slotOf, type DayRecord } from '../game/history'
import type { ScoreBreakdown } from '../game/scoring'
import type { LeaderRow } from '../game/cloud'
import { supabase } from '../game/cloud'
import { pushConfigured } from '../game/push'
import { RemindersEntry } from './Reminders'
import { GEN_INFO, trainerName } from '../game/fr'
import { displayDay, keyForDisplayDay } from '../game/rng'
import { Avatar, TopBar } from '../ui/kit'
import { locale, pick, t, tn, useLang } from '../i18n'

function BattleDetail({ r, sc, today, onClose }: { r: DayRecord; sc?: ScoreBreakdown; today: string; onClose: () => void }) {
  const win = r.result === 'win'
  const alive = r.survivors ?? (win ? 1 : 0)
  const kos = r.kos ?? (win ? 6 : 0)
  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={trainerName(r.trainer)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn sheet-x" onClick={onClose} aria-label={t('party.close')}><X size={20} /></button>
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 700 }}>{label(r.dayKey, today)}</span>
            {slotOf(r) > 1 && <span className="pill">{t('hist.battleN', { n: slotOf(r) })}</span>}
            <span className={win ? 'pill green' : 'pill red'}>{win ? t('hist.win') : t('hist.loss')}</span>
            {(r.attempts ?? 1) > 1 && <span className="pill">{t('hist.attempt', { n: r.attempts })}</span>}
          </div>
          <div>
            <h2 className="h2" style={{ margin: 0, fontSize: 26 }}>{trainerName(r.trainer)}</h2>
            <div className="muted small">{t('hist.gen', { n: r.gen, game: GEN_INFO[r.gen]?.game })}</div>
          </div>
          <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="card"><div className="lab">{t('res.turns')}</div><b style={{ fontSize: 26 }}>{r.turns}</b></div>
            <div className="card"><div className="lab">{t('res.survivors')}</div><b style={{ fontSize: 26 }}>{alive}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < alive ? 'on' : ''} />)}</div></div>
            <div className="card"><div className="lab">{t('res.kos')}</div><b style={{ fontSize: 26 }}>{kos}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < kos ? 'on blue' : ''} />)}</div></div>
          </div>
          {sc && (
            <section className="card stack">
              <div className="row between">
                <span className="lab" style={{ margin: 0 }}><Star size={13} style={{ verticalAlign: -2 }} /> {t('res.pointsDay')}</span>
                <b style={{ fontSize: 24, color: 'var(--yellow)' }}>+{sc.points}</b>
              </div>
              {win ? (
                <div className="stack small" style={{ gap: 6 }}>
                  {([
                    [t('sc.base'), `${sc.base}`],
                    [t('sc.speed'), `${Math.round(sc.speed * 100)} %`],
                    [t('sc.hp'), `${Math.round(sc.hp * 100)} %`],
                    [t('sc.survivors'), `${Math.round(sc.survivors * 100)} %`],
                    [t('sc.streak', { n: sc.streak }), `×${sc.streakMult.toFixed(2)}`],
                    ...(sc.flawless ? [[t('sc.flawless'), '+10']] : []),
                    ...(sc.attempt > 1 ? [[t('sc.attempt', { n: sc.attempt }), `×${sc.attemptMult}`]] : []),
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="row between"><span className="muted">{k}</span><b>{v}</b></div>
                  ))}
                </div>
              ) : (
                <p className="muted small">{t('res.noPoints')}</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

const MONTHS = () => pick(
  ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
)
const DOW = () => pick(['L', 'M', 'M', 'J', 'V', 'S', 'D'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']) // semaine commençant le lundi
const MON_SHORT = () => pick(
  ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
)

function label(day: string, today: string) {
  const [, m, d] = displayDay(day).split('-').map(Number)
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86400000)
  const base = t('date.short', { d, m: MON_SHORT()[m - 1] })
  return diff === 0 ? t('date.today', { d: base }) : diff === 1 ? t('date.yesterday', { d: base }) : base
}

export function History(c: Ctx) {
  useLang()
  const [ty, tm] = displayDay(c.today).split('-').map(Number)
  const [view, setView] = useState({ y: ty, m: tm - 1 })
  const byDay = useMemo(() => dayResults(c.history), [c.history])
  const first = new Date(Date.UTC(view.y, view.m, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const shift = (d: number) => setView((v) => { const n = new Date(Date.UTC(v.y, v.m + d, 1)); return { y: n.getUTCFullYear(), m: n.getUTCMonth() } })
  const rate = c.stats.played ? Math.round((c.stats.totalWins / c.stats.played) * 100) : 0
  const recent = [...c.history].reverse().slice(0, 20)
  const [open, setOpen] = useState<string | null>(null)
  const sel = open ? c.history.find((r) => recId(r) === open) : undefined
  return (
    <>
      <div>
        <h1 className="title">{t('hist.title')}</h1>
        <p className="muted">{t('hist.sub')}</p>
      </div>
      <section className="card stack">
        <div className="row between">
          <h2 className="h2">{MONTHS()[view.m]} {view.y}</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="iconbtn" onClick={() => shift(-1)} aria-label={t('hist.prevMonth')}><ChevronLeft size={18} /></button>
            <button className="iconbtn" onClick={() => shift(1)} aria-label={t('hist.nextMonth')}><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="cal">
          {DOW().map((d, i) => <div key={i} className="h">{d}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={'e' + i} className="d empty" />)}
          {Array.from({ length: days }, (_, i) => {
            const date = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
            const key = keyForDisplayDay(date, (k) => byDay.has(k) || k === c.today) // la clé stockée porte la date de fin du jour de jeu
            const r = byDay.get(key)
            return <div key={key} className={`d ${r ? (r === 'win' ? 'w' : 'l') : ''} ${key === c.today ? 'today' : ''}`}>{i + 1}</div>
          })}
        </div>
        <div className="row between small muted" style={{ fontWeight: 700 }}>
          <span>{tn('hist.battles', c.stats.played)}</span>
          <span style={{ color: 'var(--tertiary)' }}>{tn('hist.wins', c.stats.totalWins)} ({rate}%)</span>
          <span style={{ color: 'var(--yellow)' }}>{t('hist.record', { n: c.stats.bestStreak })}</span>
        </div>
      </section>
      <h2 className="h2">{t('hist.recent')}</h2>
      {recent.length === 0 && <p className="muted">{t('hist.empty')}</p>}
      {recent.map((r) => (
        <button key={recId(r)} type="button" className="card stack hist-card" onClick={() => setOpen(recId(r))} aria-label={`${trainerName(r.trainer)} — ${t('hist.detail')}`}>
          <div className="row between">
            <span className="small" style={{ fontWeight: 700 }}>{label(r.dayKey, c.today)}{slotOf(r) > 1 ? ` · ${t('hist.battleN', { n: slotOf(r) })}` : ''}</span>
            <span className={r.result === 'win' ? 'pill green' : 'pill red'}>{r.result === 'win' ? t('hist.win') : t('hist.loss')}</span>
          </div>
          <div className="row between" style={{ padding: 12, borderRadius: 16, background: 'var(--surface2)' }}>
            <div>
              <b style={{ fontSize: 18 }}>{trainerName(r.trainer)}</b>
              <div className="muted small">{t('hist.gen', { n: r.gen, game: GEN_INFO[r.gen]?.game })}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 22, color: r.result === 'win' ? 'var(--tertiary)' : 'var(--secondary)' }}>{r.survivors ?? (r.result === 'win' ? '≥1' : 0)}/6</b>
                <div className="muted small">{t('hist.turns', { n: r.turns, p: c.score.byDay.get(recId(r))?.points ?? 0 })}</div>
              </div>
              <ChevronRight size={18} className="muted" aria-hidden="true" />
            </div>
          </div>
        </button>
      ))}
      {sel && <BattleDetail r={sel} sc={c.score.byDay.get(recId(sel))} today={c.today} onClose={() => setOpen(null)} />}
    </>
  )
}

type Tab = 'today' | 'week' | 'season'
/** Saison = mois de la clé du jour de jeu (comme `date_trunc('month', game_day())` côté serveur) : nom du mois et jours restants avant la remise à zéro. */
function seasonInfo(today: string) {
  const [y, m] = today.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale(), { month: 'long', timeZone: 'UTC' })
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const left = Math.round((Date.parse(last) - Date.parse(today)) / 86400000)
  const of = /^[aeiouyhéè]/i.test(month) ? 'd’' : 'de '
  return { title: t('lb.season.title', { month, of }), left: left > 0 ? tn('lb.season.left', left) : t('lb.season.last') }
}
/** Points classants d'un joueur selon la période affichée. */
const pointsFor = (x: LeaderRow, tab: Tab) => (tab === 'today' ? x.points_today : tab === 'week' ? x.points_week : x.points_season) ?? 0
export function Leaderboard(c: Ctx & { rows: LeaderRow[] }) {
  useLang()
  const [tab, setTab] = useState<Tab>('today')
  const sorted = useMemo(() => {
    let r = [...c.rows]
    if (tab === 'today') r = r.filter((x) => x.won_today)
    else if (r.some((x) => x.points !== undefined)) r = r.filter((x) => pointsFor(x, tab) > 0)
    r.sort((a, b) => pointsFor(b, tab) - pointsFor(a, tab) || b.wins - a.wins || b.best_streak - a.best_streak)
    return r
  }, [c.rows, tab])
  if (!c.email)
    return (
      <>
        <h1 className="title">{t('lb.title')}</h1>
        <section className="card stack" style={{ textAlign: 'center' }}>
          <Trophy size={40} style={{ margin: '0 auto', color: 'var(--yellow)' }} />
          <h2 className="h2">{t('lb.joinTitle')}</h2>
          <p className="muted">{t('lb.joinText')}</p>
          <button className="btn violet" onClick={() => c.go('auth')}><LogIn size={18} /> {t('lb.login')}</button>
        </section>
      </>
    )
  const hasPoints = c.rows.some((r) => r.points !== undefined)
  const fmt = (n: number) => t('pts', { n: n.toLocaleString(locale()) })
  // Valeur classante selon l'onglet, et sa version affichable (points, jours de série ou victoires).
  const val = (r: LeaderRow) => (hasPoints ? pointsFor(r, tab) : r.wins)
  const show = (n: number) => (hasPoints ? fmt(n) : t('lb.winsShort', { n }))
  const av = (r: LeaderRow) => (r.username === c.username ? (c.avatar ?? r.avatar) : r.avatar)
  const myIdx = sorted.findIndex((r) => r.username === c.username)
  const me = myIdx >= 0 ? sorted[myIdx] : null
  const podium = sorted.length >= 3 ? [sorted[1], sorted[0], sorted[2]] : sorted.slice(0, 3)
  const sub = (r: LeaderRow) => `${tn('lb.winsMetric', r.wins)} · ${t('lb.best', { n: r.best_streak })}`
  // Progression vers le rang du dessus : barre entre le joueur du dessous (ou 0) et celui du dessus.
  const above = myIdx > 0 ? sorted[myIdx - 1] : null
  const below = myIdx >= 0 && myIdx < sorted.length - 1 ? sorted[myIdx + 1] : null
  const pct = !me ? 0 : !above ? 100 : (() => {
    const lo = below ? val(below) : 0
    const span = val(above) - lo
    return span > 0 ? Math.max(4, Math.min(100, Math.round(((val(me) - lo) / span) * 100))) : 100
  })()
  const gapRow = (r: LeaderRow, i: number) => {
    const g = i > 0 ? val(sorted[i - 1]) - val(r) : 0
    return g > 0 ? <span className="ld-gap">{t('lb.gapUp', { gap: show(g), n: i })}</span> : null
  }
  return (
    <div className="ld">
      <div className="ld-glow" aria-hidden="true"><i /><i /><i /><i /></div>
      <div>
        <h1 className="title">{t('lb.title')}</h1>
        <p className="eyebrow muted">{t('lb.arena')}</p>
      </div>
      <div className="tabs">
        {([['today', t('lb.tab.today')], ['week', t('lb.tab.week')], ['season', t('lb.tab.season')]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'season' && (() => {
        const si = seasonInfo(c.today)
        return <p className="ld-season"><CalendarDays size={16} aria-hidden="true" /> {si.title} <span className="ld-chip">{si.left}</span></p>
      })()}
      {c.username && (
        <section className="ld-glass ld-me">
          {me ? (
            <>
              <div className="ld-me-head">
                <div className="ld-me-rank"><span className="eyebrow">{t('lb.myPos')}</span><b>#{myIdx + 1}</b></div>
                <b>{show(val(me))}</b>
              </div>
              <div className="ld-bar"><i style={{ width: `${pct}%` }} /></div>
              <span className="small muted">{above ? t('lb.toPass', { gap: show(val(above) - val(me)), n: myIdx }) : t('lb.leader')}</span>
            </>
          ) : (
            <div className="ld-me-head"><div className="ld-me-rank"><span className="eyebrow">{t('lb.you', { name: c.username })}</span><span className="small muted">{t(tab === 'today' ? 'lb.winToAppear' : 'lb.winPeriod')}</span></div></div>
          )}
        </section>
      )}
      {sorted.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{tab === 'today' ? t('lb.emptyToday') : t(tab === 'week' ? 'lb.emptyWeek' : 'lb.emptySeason')}</p>}
      {podium.length > 0 && (
        <div className="ld-pod">
          {podium.map((r) => {
            const rank = sorted.indexOf(r) + 1
            return (
              <div key={r.username} className={`ld-pc r${rank}`}>
                {rank === 1 && <Crown size={26} className="ld-crown" fill="currentColor" aria-hidden="true" />}
                <Avatar id={av(r)} name={r.username} size={rank === 1 ? 84 : 64} ring="var(--m)" />
                <b className="ld-name">{r.username}</b>
                <span className="ld-pts">{show(val(r))}</span>
                <div className="ld-base">
                  <span className="ld-rk">{rank}</span>
                  <span className="ld-st"><Flame size={13} fill="currentColor" aria-hidden="true" /> {r.current_streak}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {sorted.length > 3 && (
        <>
          <div className="ld-sh"><h2 className="h2">{t('lb.top')}</h2><span className="eyebrow muted">{t('lb.elite')}</span></div>
          <section className="ld-glass ld-card">
            {sorted.slice(3, 10).map((r, k) => (
              <div key={r.username} className={`ld-row ${r.username === c.username ? 'me' : ''}`}>
                <span className="ld-n">{k + 4}</span>
                <Avatar id={av(r)} name={r.username} size={42} />
                <div className="grow"><b>{r.username}</b><div className="muted small">{sub(r)}</div></div>
                <div className="ld-end"><b>{show(val(r))}</b>{gapRow(r, k + 3)}</div>
              </div>
            ))}
          </section>
        </>
      )}
      {sorted.length > 10 && (
        <>
          <div className="ld-sh"><h2 className="h2">{t('lb.rest')}</h2><span className="eyebrow muted">{t('lb.restRange')}</span></div>
          <div className="ld-rest">
            {sorted.slice(10).map((r, k) => (
              <div key={r.username} className={`ld-mini ${r.username === c.username ? 'me' : ''}`}>
                <span className="ld-n">{k + 11}</span>
                <Avatar id={av(r)} name={r.username} size={30} />
                <b className="grow">{r.username}</b>
                {r.username === c.username && <span className="ld-you">{t('lb.meBadge')}</span>}
                <b>{show(val(r))}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function Settings(c: Ctx & { theme: 'auto' | 'light' | 'dark'; setTheme: (t: 'auto' | 'light' | 'dark') => void; version: string }) {
  useLang()
  const opts: ['light' | 'dark' | 'auto', string, typeof Sun][] = [['light', t('set.light'), Sun], ['dark', t('set.dark'), Moon], ['auto', t('set.auto'), Monitor]]
  const rate = c.stats.played ? Math.round((c.stats.totalWins / c.stats.played) * 100) : 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await c.onRename(draft)
    setBusy(false)
    if (r === 'ok') setEditing(false)
    else setErr(t(r === 'taken' ? 'set.nameTaken' : r === 'invalid' ? 'set.nameInvalid' : 'set.nameError'))
  }
  return (
    <>
      <TopBar title={t('set.title')} right={<span className="pill yellow"><Flame size={14} /> {c.stats.currentStreak}</span>} />
      <div className="lab">{t('set.account')}</div>
      <section className="card stack">
        <div className="row">
          {c.email ? (
            <button type="button" className="avatar-edit" aria-label={t('set.changeAvatar')} aria-expanded={picking} onClick={() => setPicking(!picking)}>
              <Avatar id={c.avatar} name={c.username ?? t('guest')} />
              <span className="badge-edit"><Camera size={12} /></span>
            </button>
          ) : (
            <Avatar id={c.avatar} name={c.username ?? t('guest')} />
          )}
          {editing ? (
            <form className="grow stack" style={{ gap: 6 }} onSubmit={save}>
              <div className="row" style={{ gap: 6 }}>
                <label className="field grow" style={{ margin: 0 }}>
                  <input autoFocus aria-label={t('auth.pseudo')} placeholder={t('auth.pseudoPh')} minLength={3} maxLength={20} required value={draft} onChange={(e) => { setDraft(e.target.value); setErr('') }} />
                </label>
                <button type="submit" className="iconbtn" aria-label={t('reset.save')} disabled={busy}><Check size={18} /></button>
                <button type="button" className="iconbtn" aria-label={t('cancel')} onClick={() => setEditing(false)}><X size={18} /></button>
              </div>
              {err && <div className="small" style={{ color: 'var(--secondary)' }}>{err}</div>}
            </form>
          ) : (
            <>
              <div className="grow">
                <b style={{ fontSize: 20 }}>{c.username ?? (c.email ? t('set.chooseName') : t('guest'))}</b>
                <div className="muted small">{c.email ?? t('set.notSynced')}</div>
              </div>
              {c.email && <button className="iconbtn" aria-label={t('set.editName')} onClick={() => { setDraft(c.username ?? ''); setErr(''); setEditing(true) }}><Pencil size={18} /></button>}
            </>
          )}
        </div>
        {picking && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="lab" style={{ margin: 0 }}>{t('set.chooseAvatar')}</div>
            <div className="avatar-pick" role="radiogroup" aria-label={t('set.chooseAvatar')}>
              {AVATARS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={c.avatar === id} aria-label={t(`avatar.${id}`)} className={c.avatar === id ? 'on' : ''} onClick={() => { c.onAvatar(id); setPicking(false) }}>
                  <Avatar id={id} name={id} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row between" style={{ padding: 14, borderRadius: 16, background: 'rgba(247, 201, 72, 0.16)', border: '1px solid rgba(247, 201, 72, 0.4)' }}>
          <span className="row" style={{ gap: 8 }}><Star size={20} fill="var(--yellow)" style={{ color: 'var(--yellow)' }} /><span className="lab" style={{ margin: 0 }}>{t('set.points')}</span></span>
          <b style={{ fontSize: 28, color: 'var(--yellow)' }}>{c.score.total.toLocaleString(locale())}</b>
        </div>
        <div className="row">
          <div className="grow row between" style={{ padding: 12, borderRadius: 14, background: 'var(--surface2)' }}><span className="muted small">{t('set.wins')}</span><b style={{ color: 'var(--tertiary)' }}>{c.stats.totalWins} ({rate}%)</b></div>
          <div className="grow row between" style={{ padding: 12, borderRadius: 14, background: 'var(--surface2)' }}><span className="muted small">{t('set.bestStreak')}</span><b style={{ color: 'var(--yellow)' }}>{c.stats.bestStreak} {t('unit.day')}</b></div>
        </div>
        {c.email ? (
          <button className="btn ghost" onClick={() => supabase?.auth.signOut()}><LogOut size={18} /> {t('set.logout')}</button>
        ) : (
          <button className="btn violet" onClick={() => c.go('auth')}><LogIn size={18} /> {t('set.loginUp')}</button>
        )}
      </section>
      <div className="lab">{t('set.appearance')}</div>
      <section className="card">
        <div className="seg">
          {opts.map(([k, l, I]) => (
            <button key={k} className={c.theme === k ? 'on' : ''} onClick={() => c.setTheme(k)} aria-pressed={c.theme === k}><I size={22} />{l}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>{t('set.themeNote')}</p>
      </section>
      {pushConfigured() && (
        <>
          <div className="lab">{t('push.label')}</div>
          <RemindersEntry {...c} />
        </>
      )}
      <div className="lab">{t('set.game')}</div>
      <button className="card row" onClick={() => c.go('guide')} style={{ textAlign: 'left' }}>
        <Layers size={22} style={{ color: 'var(--violet)' }} />
        <div className="grow"><b>{t('set.guide')}</b><div className="muted small">{t('set.guideSub')}</div></div>
        <ChevronRight size={18} className="muted" />
      </button>
      {c.isAdmin && (
        <>
          <div className="lab">{t('set.admin')}</div>
          <button className="card row" onClick={() => c.go('admin')} style={{ textAlign: 'left' }}>
            <ShieldCheck size={22} style={{ color: 'var(--secondary)' }} />
            <div className="grow"><b>{t('set.adminOpts')}</b><div className="muted small">{t('set.adminSub')}</div></div>
            <ChevronRight size={18} className="muted" />
          </button>
        </>
      )}
      <p className="muted small" style={{ textAlign: 'center' }}>Pokébadle Battle · v{c.version}</p>
    </>
  )
}
