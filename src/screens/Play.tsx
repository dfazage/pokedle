import { PartyList, MonSprite } from './Party'
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Flame, Lock, Share2, Shield, Trophy, HeartCrack, BarChart3, ArrowRight, Star } from 'lucide-react'
import type { Ctx } from './types'
import { classLabel, GEN_INFO, mvName, spName } from '../game/fr'
import { locale, t, tn, useLang } from '../i18n'
import { BATTLE_GEN } from '../game/daily'
import { dayNumber, difficulty } from '../game/info'
import { computeStats } from '../game/history'
import { siteUrl } from '../game/cloud'
import { buildShareText, canNativeShare, copyShare, gridFor, shareResult, type ShareOutcome } from '../game/share'
import { isFormidable } from '../game/scoring'
import { TrainerImg } from '../game/trainerSprites'
import { MonImg } from '../game/officialSprites'
import { MonOrb, SlideToConfirm, TopBar, TypeBadge, monCardStyle, useCountdown } from '../ui/kit'
import { MoveSheet } from '../ui/MoveInfo'
import { PixelHearts, type HeartAnim } from '../ui/PixelHeart'
import type { MoveFacts } from '../game/moves'

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)
const today$ = (c: Ctx) => c.history.find((r) => r.dayKey === c.today)

export function Home(c: Ctx) {
  useLang()
  const { challenge: ch, stats } = c
  const gi = GEN_INFO[ch.gen]
  const diff = difficulty(ch.estimatedWinRate)
  const left = useCountdown()
  const done = c.done
  const fire = isFormidable(ch.gen, ch.trainer.name)
  const rate = stats.played ? Math.round((stats.totalWins / stats.played) * 100) : 0
  const worldRate = c.world && c.world.players ? ((c.world.wins / c.world.players) * 100).toFixed(1) : null
  return (
    <>
      <div className="row">
        <div className="avatar">{(c.username ?? t('guest'))[0].toUpperCase()}</div>
        <div className="grow">
          <div className="eyebrow muted">{t('home.trainer')}</div>
          <div className="h2">{t('home.hello', { name: c.username ?? t('guest') })}</div>
        </div>
        <span className="pill" style={{ padding: '6px 10px' }}><PixelHearts count={c.hearts.count} max={c.hearts.max} size={16} label={tn('hearts.aria', c.hearts.count, { max: c.hearts.max })} /></span>
        <span className="pill yellow"><Flame size={14} /> {stats.currentStreak}{t('unit.day')}</span>
      </div>
      <div className="row between">
        <div>
          <div className="eyebrow">{t('home.daily', { n: dayNumber(c.today) })}</div>
          <h1 className="title">{t('home.title')}</h1>
        </div>
        <span className="pill"><Clock size={14} /> {left}</span>
      </div>

      <section className="hero">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="chip" onClick={() => c.go('guide')}>{t('home.league', { region: gi.region, gen: ch.gen })}</button>
          <span className="chip y">{t('home.difficulty', { stars: stars(diff.stars) })}</span>
        </div>
        <div className="hero-trainer">
          <div className={fire ? 'trainer-stage fire' : 'trainer-stage'}>
            {fire && (
              <span className="aura" aria-hidden>
                <i className="glow" />
                {[1, 2, 3, 4, 5, 6, 7].map((k) => <i key={k} className={`fl f${k}`} />)}
              </span>
            )}
            <TrainerImg
              id={ch.trainer.sprite ?? ch.trainer.id}
              gen={ch.gen}
              className="trainer-sprite xl"
              fallback={<MonOrb types={ch.opponentPreview[0]?.types ?? ['Normal']} size={120} />}
            />
          </div>
          <div className="hero-trainer-txt">
            <h2>{ch.trainer.name}</h2>
            <p>{t('home.blurb', { class: classLabel(ch.trainer), game: gi.game })}</p>
          </div>
        </div>
        <button className="cta" onClick={c.onPlay}>
          {done ? t('home.cta.result') : c.inProgress ? t('home.cta.resume') : t('home.cta.start')} <ArrowRight size={18} />
        </button>
      </section>

      <section className="card" style={{ padding: '12px 14px', display: 'grid', gap: 8 }}>
        <div className="row between">
          <PixelHearts count={c.hearts.count} max={c.hearts.max} size={24} label={tn('hearts.aria', c.hearts.count, { max: c.hearts.max })} />
          <span className="small" style={{ fontWeight: 800, color: 'var(--tertiary)' }}>{c.hearts.attempt === 0 ? t('hearts.free') : t('hearts.attempt', { n: c.hearts.attempt })}</span>
        </div>
        <p className="muted" style={{ fontSize: 11, lineHeight: 1.35, margin: 0 }}>{t('hearts.rule')}</p>
      </section>

      <div className="tiles">
        <div className="tile blue"><span className="l">{t('home.wins')}</span><span className="n">{stats.totalWins}</span><span className="s">{tn('home.games', stats.played)}{stats.played ? ` · ${rate}%` : ''}</span></div>
        <div className="tile yellow"><span className="l">{t('home.streak')}</span><span className="n">{stats.currentStreak}<small style={{ fontSize: 16 }}> {t('unit.day')}</small></span><span className="s">{stats.currentStreak ? t('home.streakOn') : t('home.streakOff')}</span></div>
        <div className="tile green"><span className="l">{t('home.record')}</span><span className="n">{stats.bestStreak}<small style={{ fontSize: 16 }}> {t('unit.day')}</small></span><span className="s">{t('home.bestStreak')}</span></div>
      </div>

      <div className="row between">
        <h2 className="h2">{t('home.team')}</h2>
        <span className="pill">{t('home.teamPill')}</span>
      </div>
      <PartyList team={ch.playerPreview} gen={BATTLE_GEN} locked={c.orderLocked} onMove={c.moveMon} />

      <button className="card row" onClick={() => (c.email ? undefined : c.go('auth'))} style={{ textAlign: 'left' }}>
        <span className="orb" style={{ width: 48, height: 48, ['--c1' as string]: '#8b6cd9', ['--c2' as string]: '#5ba8f0' }}><BarChart3 size={22} /></span>
        <div className="grow">
          <div className="lab" style={{ marginBottom: 2 }}>{t('home.worldRate')}</div>
          {worldRate ? (
            <div><b style={{ fontSize: 24 }}>{worldRate}%</b> <span className="muted small">{tn('home.worldDetail', c.world!.wins, { wins: c.world!.wins, players: c.world!.players })}</span></div>
          ) : (
            <div className="muted small">{c.email ? t('home.noResults') : t('home.loginForWorld')}</div>
          )}
        </div>
        {!c.email && <ChevronRight size={18} className="muted" />}
      </button>
    </>
  )
}

export function Opponent(c: Ctx & { onBack: () => void }) {
  useLang()
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
        <span className="pill"><span style={{ width: 8, height: 8, borderRadius: 9, background: 'var(--primary)' }} /> {t('opp.daily', { n: dayNumber(c.today) })}</span>
        <span className="pill"><Clock size={14} /> {left}</span>
      </div>
      <section className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="pill" style={{ color: 'var(--primary)' }}>{classLabel(ch.trainer)}</span>
          <span className="pill yellow">{t('opp.difficulty', { stars: stars(diff.stars), label: diff.label })}</span>
        </div>
        <TrainerImg
          id={ch.trainer.sprite ?? ch.trainer.id}
          gen={ch.gen}
          className="trainer-sprite lg"
          fallback={<MonOrb types={trainerTypes} size={120} />}
        />
        <h1 className="title">{ch.trainer.name}</h1>
        <p className="muted">{t('opp.sub', { game: gi.game, region: gi.region, gen: ch.gen })}</p>
      </section>
      <section className="card stack">
        <div className="row between">
          <h2 className="h2"><Shield size={18} style={{ verticalAlign: -3 }} /> {t('opp.squad', { n: ch.opponentPreview.length })}</h2>
          <span className="muted small">{t('lv100')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {ch.opponentPreview.map((m, i) => (
            <div key={m.species + i} className="stack" style={{ alignItems: 'center', gap: 6, padding: 10, borderRadius: 18, background: 'var(--surface2)' }}>
              <MonImg spec={m} alt={spName(m.species)} width={64} height={64} draggable={false} style={{ width: 64, height: 64, objectFit: 'contain', imageRendering: 'pixelated' }} />
              <b style={{ fontSize: 13, textAlign: 'center' }}>{spName(m.species)}</b>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                {m.types.map((ty) => <TypeBadge key={ty} type={ty} soft />)}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="card row between">
        <div>
          <div className="lab" style={{ marginBottom: 2 }}>{t('opp.worldWin')}</div>
          <b style={{ fontSize: 24, color: 'var(--yellow)' }}>{worldRate ? `${worldRate}%` : '—'}</b>
        </div>
        <span className="muted small">{c.world ? tn('opp.trainers', c.world.players) : t('opp.needLogin')}</span>
      </div>
      <button className="btn" onClick={() => c.go('team')}>{t('opp.engage')} <ArrowRight size={18} /></button>
      <p className="muted small" style={{ textAlign: 'center' }}><Lock size={13} style={{ verticalAlign: -2 }} /> {t('opp.oneTry')}</p>
    </>
  )
}

export function Team(c: Ctx & { onBack: () => void; onStart: () => void }) {
  useLang()
  const team = c.challenge.playerPreview
  const [i, setI] = useState(0)
  const [info, setInfo] = useState<MoveFacts | null>(null) // attaque dont la fiche est ouverte
  const m = team[i]
  const next = (d: number) => setI((i + d + team.length) % team.length)
  const attack = m.stats.spa > m.stats.atk ? [t('stat.spatk'), m.stats.spa] : [t('stat.atk'), m.stats.atk]
  return (
    <>
      <TopBar title={<><div className="eyebrow" style={{ color: 'var(--primary)' }}>Pokédle Arena</div>{t('team.title')}</>} onBack={c.onBack} />
      <div className="row between">
        <span className="pill">{t('team.fighter', { i: i + 1, n: team.length })}</span>
        <span className="pill green">{t('team.fixed')}</span>
      </div>
      <section className="team-card" style={monCardStyle(m.types)}>
        <div className="row between">
          <span className="pill">{t('lv100')}</span>
          <button className="iconbtn" onClick={() => next(-1)} aria-label={t('team.prev')}><ChevronLeft size={20} /></button>
          <button className="iconbtn" onClick={() => next(1)} aria-label={t('team.next')}><ChevronRight size={20} /></button>
        </div>
        <div className="stack" style={{ alignItems: 'center', margin: '8px 0' }}>
          <MonSprite m={m} size={132} />
          <h1 className="title" style={{ marginTop: 6 }}>{spName(m.species)}</h1>
          <div className="row">{m.types.map((ty) => <TypeBadge key={ty} type={ty} />)}</div>
        </div>
        <div className="stat3">
          <div><div className="l">{t('stat.maxhp')}</div><div className="v" style={{ color: 'var(--tertiary)' }}>{m.stats.hp}</div></div>
          <div><div className="l">{String(attack[0]).toUpperCase()}</div><div className="v">{attack[1]}</div></div>
          <div><div className="l">{t('stat.speed').toUpperCase()}</div><div className="v" style={{ color: 'var(--yellow)' }}>{m.stats.spe}</div></div>
        </div>
        <div className="stack" style={{ marginTop: 12, gap: 8 }}>
          {m.moves.map((mv) => (
            <button key={mv.name} className="row between mv-row" onClick={() => setInfo(mv)} aria-label={t('mv.sheet', { name: mvName(mv.name.replace(/^(Hidden Power) .*/, '$1')) })}>
              <b>{mvName(mv.name.replace(/^(Hidden Power) .*/, '$1'))}</b>
              <span className="row" style={{ gap: 8 }}>
                <span className="muted small">{mv.power ? t('mv.power', { n: mv.power }) : mv.category === 'Status' ? t('mv.status') : '—'}</span>
                <TypeBadge type={mv.type} soft />
                <span className="mv-i" aria-hidden>i</span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <div className="dots">{team.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      <SlideToConfirm label={t('slide.confirm')} onConfirm={c.onStart} />
      <p className="muted small" style={{ textAlign: 'center' }}>{t('team.foot')}</p>
      {info && <MoveSheet m={info} onClose={() => setInfo(null)} />}
    </>
  )
}

export function Result(c: Ctx) {
  useLang()
  const rec = today$(c)
  const left = useCountdown()
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const gainKey = `pokedle:heartGain:${c.today}`
  // Le cœur gagné apparaît en rebondissant, une seule fois (à l'arrivée sur l'écran juste après le combat).
  const [anim, setAnim] = useState<HeartAnim>(() => {
    if (!rec || rec.result !== 'win' || !c.hearts.gained) return null
    try {
      if (sessionStorage.getItem(gainKey)) return null
    } catch {
      /* ignore */
    }
    return { kind: 'gain', index: c.hearts.count - 1 }
  })
  const [breaking, setBreaking] = useState(false)
  useEffect(() => {
    if (anim?.kind !== 'gain') return
    try {
      sessionStorage.setItem(gainKey, '1')
    } catch {
      /* ignore */
    }
    const id = window.setTimeout(() => setAnim(null), 1000)
    return () => window.clearTimeout(id)
  }, [anim, gainKey])
  const replay = () => {
    if (breaking) return
    setBreaking(true)
    setAnim({ kind: 'lose', index: c.hearts.count - 1 }) // le dernier cœur éclate, puis le combat repart
    window.setTimeout(c.onReplay, 950)
  }
  if (!rec) return null
  const win = rec.result === 'win'
  const sc = c.score.byDay.get(rec.dayKey)
  const alive = rec.survivors ?? (win ? 1 : 0)
  const kos = rec.kos ?? (win ? 6 : 0)
  const prev = computeStats(c.history.filter((r) => r.dayKey !== c.today), c.today).currentStreak
  const text = buildShareText({
    rec,
    dayNo: dayNumber(c.today),
    grid: gridFor(c.today, rec),
    streak: c.stats.currentStreak,
    points: sc?.points,
    url: siteUrl().replace(/\/$/, ''),
  })
  const flash = (o: ShareOutcome) => {
    setOutcome(o === 'shared' || o === 'cancelled' ? null : o)
    if (o === 'copied') window.setTimeout(() => setOutcome((cur) => (cur === 'copied' ? null : cur)), 2500)
  }
  const share = async () => flash(await shareResult(text))
  const copy = async () => flash(await copyShare(text))
  return (
    <>
      <TopBar
        title={<>{t('res.title')} <span className="pill" style={{ marginLeft: 6 }}>#{dayNumber(c.today)}</span><div className="muted small">{t('res.sub')}</div></>}
        onBack={() => c.go('home')}
      />
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center', padding: '8px 0' }}>
        <span className="orb" style={{ width: 120, height: 120, ['--c1' as string]: win ? '#f7c948' : '#f0716b', ['--c2' as string]: win ? '#e08a1e' : '#7a2a30' }}>
          {win ? <Trophy size={56} /> : <HeartCrack size={56} />}
        </span>
        <div className="big-result" style={{ color: win ? 'var(--yellow)' : 'var(--secondary)' }}>{win ? t('res.win') : t('res.loss')}</div>
        <p className="muted">{win ? t('res.winMsg', { name: c.challenge.trainer.name }) : t('res.lossMsg')}</p>
      </div>
      <section className="card stack">
        <div className="row between">
          <span className="pill" style={win ? undefined : { color: 'var(--secondary)' }}>{win ? <><Flame size={14} /> {t('res.streakOn')}</> : <><HeartCrack size={14} /> {t('res.streakBroken')}</>}</span>
          <b style={{ fontSize: 28 }}>{c.stats.currentStreak} <small className="muted" style={{ fontSize: 12 }}>{tn('res.daysUpper', c.stats.currentStreak)}</small></b>
        </div>
        {!win && prev > 0 && <p className="muted small">{t('res.prevStreak')} <b>{tn('days', prev)}</b> {t('res.reset')}</p>}
        {win && c.stats.currentStreak >= c.stats.bestStreak && c.stats.currentStreak > 1 && <p className="small" style={{ color: 'var(--tertiary)' }}>{t('res.newRecord')}</p>}
      </section>
      <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className="card"><div className="lab">{t('res.turns')}</div><b style={{ fontSize: 30 }}>{rec.turns}</b></div>
        <div className="card"><div className="lab">{t('res.survivors')}</div><b style={{ fontSize: 30 }}>{alive}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < alive ? 'on' : ''} />)}</div></div>
        <div className="card"><div className="lab">{t('res.kos')}</div><b style={{ fontSize: 30 }}>{kos}</b><span className="muted small"> / 6</span><div className="bar6">{Array.from({ length: 6 }, (_, k) => <i key={k} className={k < kos ? 'on blue' : ''} />)}</div></div>
      </div>
      <section className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div className="lab" style={{ marginBottom: 0 }}>{t('hearts.title')}</div>
        <div className="row" style={{ gap: 12 }}>
          <PixelHearts count={breaking ? c.hearts.count - 1 : c.hearts.count} max={c.hearts.max} size={40} anim={anim} label={tn('hearts.aria', c.hearts.count, { max: c.hearts.max })} />
          {win && c.hearts.gained && <span className="heart-plus">{t('hearts.gainedPlus')}</span>}
        </div>
        {win ? (
          <p className="muted small">{c.hearts.gained ? t('hearts.gained') : t('hearts.full')}{rec.attempts && rec.attempts > 1 ? ` ${t('res.winAttempt', { n: rec.attempts })}.` : ''}</p>
        ) : c.hearts.replayPending ? (
          <p className="muted small">{t('hearts.attempt', { n: c.hearts.attempt })}</p>
        ) : c.hearts.canReplay ? (
          <>
            <p className="muted small">{t('hearts.replayInfo', { left: c.hearts.count - 1 })}</p>
            <button className="btn" onClick={replay} disabled={breaking}>{t('hearts.replay')}</button>
            <button className="btn ghost" onClick={() => c.go('home')} disabled={breaking}>{t('hearts.later')}</button>
          </>
        ) : (
          <p className="muted small">{c.hearts.count > 0 ? t('hearts.offline') : t('hearts.none')}</p>
        )}
      </section>
      {sc && (
        <section className="card stack">
          <div className="row between">
            <span className="lab" style={{ margin: 0 }}><Star size={13} style={{ verticalAlign: -2 }} /> {t('res.pointsDay')}</span>
            <b style={{ fontSize: 28, color: 'var(--yellow)' }}>+{sc.points}</b>
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
          <div className="row between small"><span className="muted">{t('res.total')}</span><b>{t('pts', { n: c.score.total.toLocaleString(locale()) })}</b></div>
        </section>
      )}
      <section className="card stack">
        <div className="lab" style={{ marginBottom: 0 }}>{t('res.sharePreview')}</div>
        <div className="share-grid" style={{ whiteSpace: 'pre-line', fontSize: 16, letterSpacing: 1, lineHeight: 1.6, userSelect: 'text' }}>{text}</div>
        <button className={win ? 'btn' : 'btn red'} onClick={share}><Share2 size={18} /> {outcome === 'copied' ? t('res.copied') : t('res.share')}</button>
        {canNativeShare() && <button className="btn ghost" onClick={copy}>{t('res.copy')}</button>}
        {outcome === 'failed' && <p className="muted small" role="status">{t('res.copyFailed')}</p>}
      </section>
      <section className="card stack" style={{ textAlign: 'center' }}>
        <div className="lab" style={{ marginBottom: 0 }}><Clock size={13} style={{ verticalAlign: -2 }} /> {t('res.next')}</div>
        <b style={{ fontSize: 36, color: 'var(--primary)', letterSpacing: 2 }}>{left}</b>
        <p className="muted small">{t('res.nextText')}</p>
      </section>
      <button className="btn ghost" onClick={() => c.go('leaderboard')}>{t('res.board')}</button>
    </>
  )
}
