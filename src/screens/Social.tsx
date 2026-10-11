import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, LogIn, LogOut, Moon, Monitor, Sun, Trophy, Layers } from 'lucide-react'
import type { Ctx } from './types'
import type { LeaderRow } from '../game/cloud'
import { supabase } from '../game/cloud'
import { GEN_INFO } from '../game/fr'
import { TopBar } from '../ui/kit'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MON_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function label(day: string, today: string) {
  const [, m, d] = day.split('-').map(Number)
  const diff = Math.round((Date.parse(today) - Date.parse(day)) / 86400000)
  const base = `${d} ${MON_SHORT[m - 1]}`
  return diff === 0 ? `Aujourd’hui · ${base}` : diff === 1 ? `Hier · ${base}` : base
}

export function History(c: Ctx) {
  const [ty, tm] = c.today.split('-').map(Number)
  const [view, setView] = useState({ y: ty, m: tm - 1 })
  const byDay = useMemo(() => new Map(c.history.map((r) => [r.dayKey, r])), [c.history])
  const first = new Date(Date.UTC(view.y, view.m, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const shift = (d: number) => setView((v) => { const n = new Date(Date.UTC(v.y, v.m + d, 1)); return { y: n.getUTCFullYear(), m: n.getUTCMonth() } })
  const rate = c.stats.played ? Math.round((c.stats.totalWins / c.stats.played) * 100) : 0
  const recent = [...c.history].reverse().slice(0, 20)
  return (
    <>
      <div>
        <h1 className="title">Historique</h1>
        <p className="muted">Journal de tes duels de ligue quotidienne</p>
      </div>
      <section className="card stack">
        <div className="row between">
          <h2 className="h2">{MONTHS[view.m]} {view.y}</h2>
          <div className="row" style={{ gap: 6 }}>
            <button className="iconbtn" onClick={() => shift(-1)} aria-label="Mois précédent"><ChevronLeft size={18} /></button>
            <button className="iconbtn" onClick={() => shift(1)} aria-label="Mois suivant"><ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="cal">
          {DOW.map((d, i) => <div key={i} className="h">{d}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={'e' + i} className="d empty" />)}
          {Array.from({ length: days }, (_, i) => {
            const key = `${view.y}-${String(view.m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
            const r = byDay.get(key)
            return <div key={key} className={`d ${r ? (r.result === 'win' ? 'w' : 'l') : ''} ${key === c.today ? 'today' : ''}`}>{i + 1}</div>
          })}
        </div>
        <div className="row between small muted" style={{ fontWeight: 700 }}>
          <span>{c.stats.played} combat{c.stats.played > 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--tertiary)' }}>{c.stats.totalWins} victoire{c.stats.totalWins > 1 ? 's' : ''} ({rate}%)</span>
          <span style={{ color: 'var(--yellow)' }}>Record : {c.stats.bestStreak}</span>
        </div>
      </section>
      <h2 className="h2">Combats récents</h2>
      {recent.length === 0 && <p className="muted">Aucun combat pour l’instant. Lance ton premier duel depuis l’accueil !</p>}
      {recent.map((r) => (
        <section key={r.dayKey} className="card stack">
          <div className="row between">
            <span className="small" style={{ fontWeight: 700 }}>{label(r.dayKey, c.today)}</span>
            <span className={r.result === 'win' ? 'pill green' : 'pill red'}>{r.result === 'win' ? 'Victoire' : 'Défaite'}</span>
          </div>
          <div className="row between" style={{ padding: 12, borderRadius: 16, background: 'var(--surface2)' }}>
            <div>
              <b style={{ fontSize: 18 }}>{r.trainer}</b>
              <div className="muted small">Gen {r.gen} · {GEN_INFO[r.gen]?.game}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <b style={{ fontSize: 22, color: r.result === 'win' ? 'var(--tertiary)' : 'var(--secondary)' }}>{r.survivors ?? (r.result === 'win' ? '≥1' : 0)}/6</b>
              <div className="muted small">{r.turns} tours</div>
            </div>
          </div>
        </section>
      ))}
    </>
  )
}

type Tab = 'today' | 'streak' | 'total'
export function Leaderboard(c: Ctx & { rows: LeaderRow[] }) {
  const [tab, setTab] = useState<Tab>('total')
  const sorted = useMemo(() => {
    let r = [...c.rows]
    if (tab === 'today') r = r.filter((x) => x.won_today)
    r.sort((a, b) => (tab === 'streak' ? b.current_streak - a.current_streak || b.wins - a.wins : b.wins - a.wins || b.best_streak - a.best_streak))
    return r
  }, [c.rows, tab])
  if (!c.email)
    return (
      <>
        <h1 className="title">Classement</h1>
        <section className="card stack" style={{ textAlign: 'center' }}>
          <Trophy size={40} style={{ margin: '0 auto', color: 'var(--yellow)' }} />
          <h2 className="h2">Rejoins l’arène mondiale</h2>
          <p className="muted">Connecte-toi pour sauvegarder ta série et apparaître au classement.</p>
          <button className="btn violet" onClick={() => c.go('auth')}><LogIn size={18} /> Se connecter</button>
        </section>
      </>
    )
  const metric = (r: LeaderRow) => (tab === 'streak' ? `🔥 ${r.current_streak}j` : `${r.wins} victoire${r.wins > 1 ? 's' : ''}`)
  const top = sorted.slice(0, 3)
  const myIdx = sorted.findIndex((r) => r.username === c.username)
  const podium = top.length >= 3 ? [top[1], top[0], top[2]] : top
  return (
    <>
      <div className="row between">
        <div>
          <h1 className="title">Classement</h1>
          <p className="eyebrow muted">Arène mondiale</p>
        </div>
      </div>
      <div className="tabs">
        {([['today', "Aujourd'hui"], ['streak', 'Série'], ['total', 'Total']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {sorted.length === 0 && <p className="muted" style={{ textAlign: 'center' }}>{tab === 'today' ? 'Personne n’a encore gagné aujourd’hui. Sois le premier !' : 'Aucun dresseur classé pour l’instant.'}</p>}
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
            <div className="grow"><b>{r.username}</b><div className="muted small">Record : {r.best_streak}j</div></div>
            <span className="pill"><Flame size={13} /> {r.current_streak}</span>
            <b className="small">{r.wins}V</b>
          </div>
        ))}
        {myIdx >= 3 ? null : myIdx === -1 && c.username ? (
          <div className="lb me"><span className="rank">—</span><div className="grow"><b>Toi ({c.username})</b><div className="muted small">{tab === 'today' ? 'Gagne le combat du jour pour apparaître ici.' : 'Pas encore classé.'}</div></div></div>
        ) : null}
      </div>
    </>
  )
}

export function Settings(c: Ctx & { theme: 'auto' | 'light' | 'dark'; setTheme: (t: 'auto' | 'light' | 'dark') => void; version: string }) {
  const opts: ['light' | 'dark' | 'auto', string, typeof Sun][] = [['light', 'Clair', Sun], ['dark', 'Sombre', Moon], ['auto', 'Auto', Monitor]]
  const rate = c.stats.played ? Math.round((c.stats.totalWins / c.stats.played) * 100) : 0
  return (
    <>
      <TopBar title="Paramètres" right={<span className="pill yellow"><Flame size={14} /> {c.stats.currentStreak}</span>} />
      <div className="lab">Compte dresseur</div>
      <section className="card stack">
        <div className="row">
          <div className="avatar">{(c.username ?? 'I')[0].toUpperCase()}</div>
          <div className="grow">
            <b style={{ fontSize: 20 }}>{c.username ?? 'Invité'}</b>
            <div className="muted small">{c.email ?? 'Partie non synchronisée'}</div>
          </div>
        </div>
        <div className="row">
          <div className="grow row between" style={{ padding: 12, borderRadius: 14, background: 'var(--surface2)' }}><span className="muted small">Victoires</span><b style={{ color: 'var(--tertiary)' }}>{c.stats.totalWins} ({rate}%)</b></div>
          <div className="grow row between" style={{ padding: 12, borderRadius: 14, background: 'var(--surface2)' }}><span className="muted small">Série max</span><b style={{ color: 'var(--yellow)' }}>{c.stats.bestStreak} j</b></div>
        </div>
        {c.email ? (
          <button className="btn ghost" onClick={() => supabase?.auth.signOut()}><LogOut size={18} /> Se déconnecter</button>
        ) : (
          <button className="btn violet" onClick={() => c.go('auth')}><LogIn size={18} /> Se connecter / Créer un compte</button>
        )}
      </section>
      <div className="lab">Apparence & thème</div>
      <section className="card">
        <div className="seg">
          {opts.map(([k, l, I]) => (
            <button key={k} className={c.theme === k ? 'on' : ''} onClick={() => c.setTheme(k)} aria-pressed={c.theme === k}><I size={22} />{l}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>Le combat garde toujours son écran sombre façon GBA.</p>
      </section>
      <div className="lab">Jeu</div>
      <button className="card row" onClick={() => c.go('generations')} style={{ textAlign: 'left' }}>
        <Layers size={22} style={{ color: 'var(--violet)' }} />
        <div className="grow"><b>Générations & versions</b><div className="muted small">Jeux utilisés pour les combats quotidiens</div></div>
        <ChevronRight size={18} className="muted" />
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>Pokédle Battle · v{c.version}</p>
    </>
  )
}
