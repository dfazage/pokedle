import { useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Flame, LogIn, LogOut, Moon, Monitor, Pencil, Star, Sun, X, Trophy, Layers, ShieldCheck } from 'lucide-react'
import type { Ctx } from './types'
import type { DayRecord } from '../game/history'
import type { ScoreBreakdown } from '../game/scoring'
import type { LeaderRow } from '../game/cloud'
import { supabase } from '../game/cloud'
import { GEN_INFO } from '../game/fr'
import { TopBar } from '../ui/kit'
import { locale, pick, t, tn, useLang } from '../i18n'

function BattleDetail({ r, sc, today, onClose }: { r: DayRecord; sc?: ScoreBreakdown; today: string; onClose: () => void }) {
  const win = r.result === 'win'
  const alive = r.survivors ?? (win ? 1 : 0)
  const kos = r.kos ?? (win ? 6 : 0)
  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={r.trainer}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn sheet-x" onClick={onClose} aria-label={t('party.close')}><X size={20} /></button>
        <div className="stack">
          <div className="row" style={{ gap: 8 }}>
            <span className="small muted" style={{ fontWeight: 700 }}>{label(r.dayKey, today)}</span>
            <span className={win ? 'pill green' : 'pill red'}>{win ? t('hist.win') : t('hist.loss')}</span>
            {(r.attempts ?? 1) > 1 && <span className="pill">{t('hist.attempt', { n: r.attempts })}</span>}
          </div>
          <div>
            <h2 className="h2" style={{ margin: 0, fontSize: 26 }}>{r.trainer}</h2>
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
  const [, m, d] = day.split('-').map(Number)
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86400000)
  const base = t('date.short', { d, m: MON_SHORT()[m - 1] })
  return diff === 0 ? t('date.today', { d: base }) : diff === 1 ? t('date.yesterday', { d: base }) : base
}

export function History(c: Ctx) {
  useLang()
  const [ty, tm] = c.today.split('-').map(Number)
  const [view, setView] = useState({ y: ty, m: tm - 1 })
  const byDay = useMemo(() => new Map(c.history.map((r) => [r.dayKey, r])), [c.history])
  const first = new Date(Date.UTC(view.y, view.m, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const shift = (d: number) => setView((v) => { const n = new Date(Date.UTC(v.y, v.m + d, 1)); return { y: n.getUTCFullYear(), m: n.getUTCMonth() } })
  const rate = c.stats.played ? Math.round((c.stats.totalWins / c.stats.played) * 100) : 0
  const recent = [...c.history].reverse().slice(0, 20)
  const [open, setOpen] = useState<string | null>(null)
  const sel = open ? c.history.find((r) => r.dayKey === open) : undefined
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
            const key = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
            const r = byDay.get(key)
            return <div key={key} className={`d ${r ? (r.result === 'win' ? 'w' : 'l') : ''} ${key === c.today ? 'today' : ''}`}>{i + 1}</div>
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
        <button key={r.dayKey} type="button" className="card stack hist-card" onClick={() => setOpen(r.dayKey)} aria-label={`${r.trainer} — ${t('hist.detail')}`}>
          <div className="row between">
            <span className="small" style={{ fontWeight: 700 }}>{label(r.dayKey, c.today)}</span>
            <span className={r.result === 'win' ? 'pill green' : 'pill red'}>{r.result === 'win' ? t('hist.win') : t('hist.loss')}</span>
          </div>
          <div className="row between" style={{ padding: 12, borderRadius: 16, background: 'var(--surface2)' }}>
            <div>
              <b style={{ fontSize: 18 }}>{r.trainer}</b>
              <div className="muted small">{t('hist.gen', { n: r.gen, game: GEN_INFO[r.gen]?.game })}</div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ textAlign: 'right' }}>
                <b style={{ fontSize: 22, color: r.result === 'win' ? 'var(--tertiary)' : 'var(--secondary)' }}>{r.survivors ?? (r.result === 'win' ? '≥1' : 0)}/6</b>
                <div className="muted small">{t('hist.turns', { n: r.turns, p: c.score.byDay.get(r.dayKey)?.points ?? 0 })}</div>
              </div>
              <ChevronRight size={18} className="muted" aria-hidden="true" />
            </div>
          </div>
        </button>
      ))}
      {sel && <BattleDetail r={sel} sc={c.score.byDay.get(sel.dayKey)} today={c.today} onClose={() => setOpen(null)} />}
    </>
  )
}

type Tab = 'today' | 'streak' | 'total'
export function Leaderboard(c: Ctx & { rows: LeaderRow[] }) {
  useLang()
  const [tab, setTab] = useState<Tab>('total')
  const sorted = useMemo(() => {
    let r = [...c.rows]
    if (tab === 'today') r = r.filter((x) => x.won_today)
    const pts = (x: LeaderRow) => (tab === 'today' ? x.points_today : x.points) ?? 0
    r.sort((a, b) =>
      tab === 'streak'
        ? b.current_streak - a.current_streak || b.wins - a.wins
        : pts(b) - pts(a) || b.wins - a.wins || b.best_streak - a.best_streak,
    )
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
  const metric = (r: LeaderRow) =>
    tab === 'streak' ? t('lb.streakMetric', { n: r.current_streak }) : hasPoints ? fmt((tab === 'today' ? r.points_today : r.points) ?? 0) : tn('lb.winsMetric', r.wins)
  const top = sorted.slice(0, 3)
  const myIdx = sorted.findIndex((r) => r.username === c.username)
  const podium = top.length >= 3 ? [top[1], top[0], top[2]] : top
  return (
    <>
      <div className="row between">
        <div>
          <h1 className="title">{t('lb.title')}</h1>
          <p className="eyebrow muted">{t('lb.arena')}</p>
        </div>
      </div>
      <div className="tabs">
        {([['today', t('lb.tab.today')], ['streak', t('lb.tab.streak')], ['total', t('lb.tab.total')]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {sorted.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{tab === 'today' ? t('lb.emptyToday') : t('lb.empty')}</p>}
      {top.length > 0 && (
        <div className="podium" style={top.length < 3 ? { gridTemplateColumns: `repeat(${top.length}, 1fr)` } : undefined}>
          {podium.map((r) => {
            const rank = sorted.indexOf(r) + 1
            return (
              <div key={r.username} className={`p ${rank === 1 ? 'first' : ''}`}>
                <div className="avatar" style={{ margin: '0 auto 8px', width: rank === 1 ? 64 : 52, height: rank === 1 ? 64 : 52, borderColor: rank === 1 ? 'var(--yellow)' : rank === 2 ? '#aeb8c8' : '#d08a4a' }}>{r.username[0].toUpperCase()}</div>
                <b>{rank}. {r.username}</b>
                <div className="small" style={{ color: 'var(--primary)', fontWeight: 700 }}>{metric(r)}</div>
              </div>
            )
          })}
        </div>
      )}
      <div className="stack" style={{ gap: 8 }}>
        {sorted.slice(3).map((r, i) => (
          <div key={r.username} className={`lb ${r.username === c.username ? 'me' : ''}`}>
            <span className="rank">#{i + 4}</span>
            <div className="grow"><b>{r.username}</b><div className="muted small">{t('lb.best', { n: r.best_streak })}{hasPoints ? ` · ${t('lb.winsShort', { n: r.wins })}` : ''}</div></div>
            <span className="pill"><Flame size={13} /> {r.current_streak}</span>
            <b className="small">{hasPoints ? fmt((tab === 'today' ? r.points_today : r.points) ?? 0) : t('lb.winsShort', { n: r.wins })}</b>
          </div>
        ))}
        {myIdx >= 3 ? null : myIdx === -1 && c.username ? (
          <div className="lb me"><span className="rank">—</span><div className="grow"><b>{t('lb.you', { name: c.username })}</b><div className="muted small">{tab === 'today' ? t('lb.winToAppear') : t('lb.unranked')}</div></div></div>
        ) : null}
      </div>
    </>
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
          <div className="avatar">{(c.username ?? t('guest'))[0].toUpperCase()}</div>
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
      <p className="muted small" style={{ textAlign: 'center' }}>Pokédle Battle · v{c.version}</p>
    </>
  )
}
