import { PartyList, MonSprite } from './Party'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Flame, Lock, Share2, Shield, Trophy, HeartCrack, BarChart3, ArrowRight } from 'lucide-react'
import type { Ctx } from './types'
import { CLASS_FR, GEN_INFO, mvFr, spFr } from '../game/fr'
import { BATTLE_GEN } from '../game/daily'
import { dayNumber, difficulty } from '../game/info'
import { computeStats, type DayRecord } from '../game/history'
import { TrainerImg } from '../game/trainerSprites'
import { MonOrb, SlideToConfirm, TopBar, TypeBadge, monCardStyle, useCountdown } from '../ui/kit'

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
const today$ = (c: Ctx) => c.history.find((r) => r.dayKey === c.today)

export function Home(c: Ctx) {
  const { challenge: ch, stats } = c
  const gi = GEN_INFO[ch.gen]
  const diff = difficulty(ch.estimatedWinRate)
  const left = useCountdown()
  const done = today$(c)
  const rate = stats.played ? Math.round((stats.totalWins / stats.played) * 100) : 0
  const worldRate = c.world && c.world.players ? ((c.world.wins / c.world.players) * 100).toFixed(1) : null
  return (
    <>
      <div className="row">
        <div className="avatar">{(c.username ?? 'I')[0].toUpperCase()}</div>
        <div className="grow">
          <div className="eyebrow muted">Dresseur</div>
          <div className="h2">Salut, {c.username ?? 'Invité'}</div>
        </div>
        <span className="pill yellow"><Flame size={14} /> {stats.currentStreak}j</span>
      </div>
      <div className="row between">
        <div>
          <div className="eyebrow">Pokédle #{dayNumber(c.today)} · Défi quotidien</div>
          <h1 className="title">Combat du Jour</h1>
        </div>
        <span className="pill"><Clock size={14} /> {left}</span>
      </div>

      <section className="hero">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => c.go('generations')}>Ligue {gi.region} · Gen {ch.gen}</button>
          <span className="chip y">Difficulté {stars(diff.stars)}</span>
        </div>
        <div className="hero-trainer">
          <div className="hero-trainer-txt">
            <h2>{ch.trainer.name}</h2>
            <p>{CLASS_FR[ch.trainer.class] ?? ch.trainer.class} · Pokémon {gi.game}. 1 seule tentative aujourd’hui, même équipe imposée pour tous !</p>
          </div>
          <TrainerImg
            id={ch.trainer.id}
            gen={ch.gen}
            className="trainer-sprite"
            fallback={<MonOrb types={ch.opponentPreview[0]?.types ?? ['Normal']} size={72} />}
          />
        </div>
        <button className="cta" onClick={c.onPlay}>
          {done ? 'Voir mon résultat' : c.inProgress ? 'Reprendre le combat' : 'Lancer le combat'} <ArrowRight size={18} />
        </button>
      </section>

      <div className="tiles">
        <div className="tile blue"><span className="l">Victoires</span><span className="n">{stats.totalWins}</span><span className="s">sur {stats.played} partie{stats.played > 1 ? "s" : ""}{stats.played ? ` · ${rate}%` : ''}</span></div>
        <div className="tile yellow"><span className="l">Série</span><span className="n">{stats.currentStreak}<small style={{ fontSize: 16 }}> j</small></span><span className="s">{stats.currentStreak ? 'En cours !' : 'À relancer'}</span></div>
        <div className="tile green"><span className="l">Record</span><span className="n">{stats.bestStreak}<small style={{ fontSize: 16 }}> j</small></span><span className="s">Meilleure série</span></div>
      </div>

      <div className="row between">
        <h2 className="h2">Ton équipe du jour</h2>
        <span className="pill">Niv. 100 · Imposée</span>
      </div>
      <PartyList team={ch.playerPreview} gen={BATTLE_GEN} locked={c.orderLocked} onMove={c.moveMon} />

      <button className="card row" onClick={() => (c.email ? undefined : c.go('auth'))} style={{ textAlign: 'left' }}>
        <span className="orb" style={{ width: 48, height: 48, ['--c1' as string]: '#8b6cd9', ['--c2' as string]: '#5ba8f0' }}><BarChart3 size={22} /></span>
        <div className="grow">
          <div className="lab" style={{ marginBottom: 2 }}>Taux de réussite mondial</div>
          {worldRate ? (
            <div><b style={{ fontSize: 24 }}>{worldRate}%</b> <span className="muted small">· {c.world!.wins} vainqueur{c.world!.wins > 1 ? 's' : ''} sur {c.world!.players}</span></div>
          ) : (
            <div className="muted small">{c.email ? 'Pas encore de résultats aujourd’hui.' : 'Connecte-toi pour voir le taux mondial.'}</div>
          )}
        </div>
        {!c.email && <ChevronRight size={18} className="muted" />}
      </button>
    </>
  )
}

export function Opponent(c: Ctx & { onBack: () => void }) {
  const { challenge: ch } = c
  const gi = GEN_INFO[ch.gen]
  const diff = difficulty(ch.estimatedWinRate)
  const left = useCountdown()
  const trainerTypes = ch.opponentPreview[0]?.types ?? ['Normal']
  const worldRate = c.world && c.world.players ? ((c.world.wins / c.world.players) * 100).toFixed(1) : null
  return (
    <>
      <TopBar title="Pokédle Battle" onBack={c.onBack} />
      <div className="row between">
        <span className="pill"><span style={{ width: 8, height: 8, borderRadius: 9, background: 'var(--primary)' }} /> Défi quotidien #{dayNumber(c.today)}</span>
        <span className="pill"><Clock size={14} /> {left}</span>
      </div>
      <section className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="pill" style={{ color: 'var(--primary)' }}>{CLASS_FR[ch.trainer.class] ?? ch.trainer.class}</span>
          <span className="pill yellow">Difficulté {stars(diff.stars)} {diff.label}</span>
        </div>
        <MonOrb types={trainerTypes} size={120} />
        <h1 className="title">{ch.trainer.name}</h1>
        <p className="muted">Pokémon {gi.game} · Ligue {gi.region} · Gen {ch.gen}</p>
      </section>
      <section className="card stack">
        <div className="row between">
          <h2 className="h2"><Shield size={18} style={{ verticalAlign: -3 }} /> Escouade ennemie ({ch.opponentPreview.length})</h2>
          <span className="muted small">Niv. 100</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {ch.opponentPreview.map((m, i) => (
            <div key={m.species + i} className="stack" style={{ alignItems: 'center', gap: 6, padding: 10, borderRadius: 18, background: 'var(--surface2)' }}>
              <MonOrb types={m.types} size={48} />
              <b style={{ fontSize: 13, textAlign: 'center' }}>{spFr(m.species)}</b>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {m.types.map((t) => <TypeBadge key={t} type={t} soft />)}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="card row between">
        <div>
          <div className="lab" style={{ marginBottom: 2 }}>Taux de victoire mondial</div>
          <b style={{ fontSize: 24, color: 'var(--yellow)' }}>{worldRate ? `${worldRate}%` : '—'}</b>
        </div>
        <span className="muted small">{c.world ? `${c.world.players} dresseur${c.world.players > 1 ? 's' : ''} aujourd’hui` : 'Connexion requise'}</span>
      </div>
      <button className="btn" onClick={() => c.go('team')}>Engager le combat <ArrowRight size={18} /></button>
      <p className="muted small" style={{ textAlign: 'center' }}><Lock size={13} style={{ verticalAlign: -2 }} /> 1 seule tentative aujourd’hui</p>
    </>
  )
}

export function Team(c: Ctx & { onBack: () => void; onStart: () => void }) {
  const team = c.challenge.playerPreview
  const [i, setI] = useState(0)
  const m = team[i]
  const next = (d: number) => setI((i + d + team.length) % team.length)
  const attack = m.stats.spa > m.stats.atk ? ['Attaque spé.', m.stats.spa] : ['Attaque', m.stats.atk]
  return (
    <>
      <TopBar title={<><div className="eyebrow" style={{ color: 'var(--primary)' }}>Pokédle Arena</div>Équipe du jour</>} onBack={c.onBack} />
      <div className="row between">
        <span className="pill">Combattant {i + 1} / {team.length}</span>
        <span className="pill green">Équipe imposée</span>
      </div>
      <section className="team-card" style={monCardStyle(m.types)}>
        <div className="row between">
          <span className="pill">Niv. 100</span>
          <button className="iconbtn" onClick={() => next(-1)} aria-label="Précédent"><ChevronLeft size={20} /></button>
          <button className="iconbtn" onClick={() => next(1)} aria-label="Suivant"><ChevronRight size={20} /></button>
        </div>
        <div className="stack" style={{ alignItems: 'center', margin: '8px 0' }}>
          <MonSprite m={m} size={132} />
          <h1 className="title" style={{ marginTop: 6 }}>{spFr(m.species)}</h1>
          <div className="row">{m.types.map((t) => <TypeBadge key={t} type={t} />)}</div>
        </div>
        <div className="stat3">
          <div><div className="l">PV MAX</div><div className="v" style={{ color: 'var(--tertiary)' }}>{m.stats.hp}</div></div>
          <div><div className="l">{String(attack[0]).toUpperCase()}</div><div className="v">{attack[1]}</div></div>
          <div><div className="l">VITESSE</div><div className="v" style={{ color: 'var(--yellow)' }}>{m.stats.spe}</div></div>
        </div>
        <div className="stack" style={{ marginTop: 12, gap: 8 }}>
          {m.moves.map((mv) => (
            <div key={mv.name} className="row between" style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface2)' }}>
              <b>{mvFr(mv.name.replace(/^(Hidden Power) .*/, '$1'))}</b>
              <span className="row" style={{ gap: 8 }}>
                <span className="muted small">{mv.power ? `Puiss. ${mv.power}` : mv.category === 'Status' ? 'Statut' : '—'}</span>
                <TypeBadge type={mv.type} soft />
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="dots">{team.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      <SlideToConfirm label="Glisser pour confirmer" onConfirm={c.onStart} />
      <p className="muted small" style={{ textAlign: 'center' }}>Équipe imposée aujourd’hui · duels 6v6, niveau 100</p>
    </>
  )
}

export function shareText(c: Ctx, rec: DayRecord): string {
  const alive = rec.survivors ?? (rec.result === 'win' ? 1 : 0)
  const kos = rec.kos ?? (rec.result === 'win' ? 6 : 0)
  const row = (n: number, on: string, off: string) => on.repeat(n) + off.repeat(Math.max(0, 6 - n))
  return `Pokédle Battle #${dayNumber(c.today)} ${rec.result === 'win' ? '🏆' : '💀'} ${alive}/6\n${row(alive, '🟩', '🟥')}\n${row(kos, '🟩', '⬛')}`
}

export function Result(c: Ctx) {
  const rec = today$(c)
  const left = useCountdown()
  const [copied, setCopied] = useState(false)
  if (!rec) return null
  const win = rec.result === 'win'
  const alive = rec.survivors ?? (win ? 1 : 0)
  const kos = rec.kos ?? (win ? 6 : 0)
  const prev = computeStats(c.history.filter((r) => r.dayKey !== c.today), c.today).currentStreak
  const text = shareText(c, rec)
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }
    } catch {
      /* partage annulé */
    }
  }
  return (
    <>
      <TopBar
        title={<>Bataille du Jour <span className="pill" style={{ marginLeft: 6 }}>#{dayNumber(c.today)}</span><div className="muted small">Résultat du jour</div></>}
        onBack={() => c.go('home')}
      />
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <span className="orb" style={{ width: 120, height: 120, ['--c1' as string]: win ? '#f7c948' : '#f0716b', ['--c2' as string]: win ? '#e08a1e' : '#7a2a30' }}>
          {win ? <Trophy size={56} /> : <HeartCrack size={56} />}
        </span>
        <div className="big-result" style={{ color: win ? 'var(--yellow)' : 'var(--secondary)' }}>{win ? 'Victoire !' : 'Défaite'}</div>
        <p className="muted">{win ? `${c.challenge.trainer.name} terrassé en beauté.` : 'L’équipe adverse a pris le dessus. Tous tes Pokémon sont K.O.'}</p>
      </div>
      <section className="card stack">
        <div className="row between">
          <span className="pill" style={win ? undefined : { color: 'var(--secondary)' }}>{win ? <><Flame size={14} /> Série en cours</> : <><HeartCrack size={14} /> Série brisée</>}</span>
          <b style={{ fontSize: 28 }}>{c.stats.currentStreak} <small className="muted" style={{ fontSize: 12 }}>JOUR{c.stats.currentStreak > 1 ? 'S' : ''}</small></b>
        </div>
        {!win && prev > 0 && <p className="muted small">Précédente série : <b>{prev} jour{prev > 1 ? 's' : ''}</b> — réinitialisée.</p>}
        {win && c.stats.currentStreak >= c.stats.bestStreak && c.stats.currentStreak > 1 && <p className="small" style={{ color: 'var(--tertiary)' }}>Nouveau record personnel !</p>}
      </section>
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="card"><div className="lab">Tours</div><b style={{ fontSize: 30 }}>{rec.turns}</b></div>
        <div className="card"><div className="lab">Survivants</div><b style={{ fontSize: 30 }}>{alive}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < alive ? 'on' : ''} />)}</div></div>
        <div className="card"><div className="lab">K.O. infligés</div><b style={{ fontSize: 30 }}>{kos}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < kos ? 'on blue' : ''} />)}</div></div>
      </div>
      <section className="card stack">
        <div className="lab" style={{ marginBottom: 0 }}>Aperçu du partage</div>
        <div className="share-grid" style={{ whiteSpace: 'pre-line', fontSize: 18 }}>{text}</div>
        <button className={win ? 'btn' : 'btn red'} onClick={share}><Share2 size={18} /> {copied ? 'Copié dans le presse-papier !' : 'Partager mon résultat'}</button>
      </section>
      <section className="card stack" style={{ textAlign: 'center' }}>
        <div className="lab" style={{ marginBottom: 0 }}><Clock size={13} style={{ verticalAlign: -2 }} /> Prochain défi</div>
        <b style={{ fontSize: 36, color: 'var(--primary)', letterSpacing: 2 }}>{left}</b>
        <p className="muted small">Un nouveau dresseur et une nouvelle équipe imposée chaque jour à minuit UTC.</p>
      </section>
      <button className="btn ghost" onClick={() => c.go('leaderboard')}>Voir le classement mondial</button>
    </>
  )
}
