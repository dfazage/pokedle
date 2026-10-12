import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './ui/theme.css'
import type { DailyChallenge } from './game/daily'
import type { BattleSession, BattleView, Step } from './game/session'
import { computeStats, getRecord, loadHistory, removeRecord, saveRecord, type DayRecord } from './game/history'
import { gridFromTeams, saveGrid } from './game/share'
import { clearAttempt, heartsInfo, loadAttempt, saveAttempt } from './game/hearts'
import { gameDayKey } from './game/rng'
import { classLabel, GEN_INFO, spName } from './game/fr'
import { t, useLang } from './i18n'
import { dayNumber } from './game/info'
import { isFormidable, scoreHistory } from './game/scoring'
import { isAvatar, loadLocalAvatar, saveLocalAvatar } from './game/avatars'
import { supabase, ensureProfile, fetchHistory, submitResult, fetchLeaderboard, fetchWorldStats, fetchAvatar, updateAvatar, fetchIsAdmin, adminResetToday, fetchDailySalt, adminRerollToday, updateUsername, adminResetTodayAll, fetchDailyResetN, serverSupportsReplay, type LeaderRow } from './game/cloud'
import { syncPush } from './game/push'
import BattleScreen from './BattleScreen'
import { musicFor, playVictory, startMusic, stopMusic } from './game/music'
import { BottomNav, LangNotch, MonOrb, ScoreBadge, TopBar, useLocalState, type Screen } from './ui/kit'
import { Home, Opponent, Team, Result } from './screens/Play'
import { History, Leaderboard, Settings } from './screens/Social'
import { Admin, Auth, Onboarding, ResetPassword } from './screens/Account'
import { Guide } from './screens/Guide'
import { Reminders } from './screens/Reminders'
import { BattleIntro } from './screens/BattleIntro'
import type { Ctx } from './screens/types'

const progressKey = (day: string) => `pokedle:progress:${day}`
function loadChoices(day: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(progressKey(day)) ?? '[]')
  } catch {
    return []
  }
}
function saveChoices(day: string, choices: string[]) {
  try {
    localStorage.setItem(progressKey(day), JSON.stringify(choices))
  } catch {
    /* ignore */
  }
}

const resetKey = (day: string) => `pokedle:reset:${day}`
const orderKey = (day: string) => `pokedle:order:${day}`
function loadOrder(day: string): number[] | null {
  try {
    const o = JSON.parse(localStorage.getItem(orderKey(day)) ?? 'null')
    return Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

type Engine = { BattleSession: typeof import('./game/session').BattleSession; formatLog: typeof import('./game/session').formatLog; formatSteps: typeof import('./game/session').formatSteps }
const NAV_SCREENS: Screen[] = ['home', 'history', 'leaderboard', 'settings', 'result']

/** Racine : l'encoche de langue est affichée une seule fois, au-dessus de tous les écrans. */
export default function App() {
  return (
    <>
      <LangNotch />
      <AppScreens />
    </>
  )
}

function AppScreens() {
  useLang() // re-rendu complet de l'app au changement de langue
  const today = useMemo(() => gameDayKey(), [])
  const [theme, setTheme] = useLocalState<'auto' | 'light' | 'dark'>('pokedle:theme', 'auto')
  // Accès à l'app : il faut être connecté.
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [authReady, setAuthReady] = useState(!supabase) // session Supabase restaurée ?
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [baseChallenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [rerollTick, setRerollTick] = useState(0)
  const [order, setOrder] = useState<number[] | null>(() => loadOrder(today))
  const [history, setHistory] = useState<DayRecord[]>(() => loadHistory())
  const [attemptNo, setAttemptNo] = useState(() => loadAttempt(today)) // essais commencés aujourd'hui (1 = essai offert)
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(loadLocalAvatar)
  const [isAdmin, setIsAdmin] = useState(false)
  const [replayOk, setReplayOk] = useState(true) // le serveur sait enregistrer un rejeu (supabase/results_attempts.sql appliqué)
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [world, setWorld] = useState<{ players: number; wins: number } | null>(null)
  const [view, setView] = useState<BattleView | null>(null)
  const [queue, setQueue] = useState<Step[]>([])
  const [pending, setPending] = useState<BattleView | null>(null)
  const [, bump] = useState(0)
  const signedIn = useRef(false)
  const session = useRef<BattleSession | null>(null)
  const choices = useRef<string[]>([])
  const engine = useRef<Engine | null>(null)

  // Équipe dans l'ordre choisi par le joueur (permutation valide, sinon ordre d'origine).
  const challenge = useMemo(() => {
    if (!baseChallenge) return null
    const n = baseChallenge.playerTeam.length
    const valid = order && order.length === n && [...order].sort((a, b) => a - b).every((v, i) => v === i)
    if (!valid) return baseChallenge
    return {
      ...baseChallenge,
      playerTeam: order.map((i) => baseChallenge.playerTeam[i]),
      playerPreview: order.map((i) => baseChallenge.playerPreview[i]),
    }
  }, [baseChallenge, order])

  // Thème : clair / sombre / auto (suit le système).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = theme === 'auto' ? (mq.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = t
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b0b0f' : '#f4f6fb')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  // Compte en ligne : l'historique affiché vient du serveur quand on est connecté.
  const refreshCloud = useCallback(async () => {
    setHistory(await fetchHistory())
    setReplayOk(serverSupportsReplay())
    setRows(await fetchLeaderboard())
    setWorld(await fetchWorldStats(today))
  }, [today])
  useEffect(() => {
    if (!supabase) return
    const load = async (user: { id: string; email?: string } | null) => {
      signedIn.current = !!user
      setEmail(user?.email ?? null)
      if (!user) {
        setUsername(null)
        setIsAdmin(false)
        setRows([])
        setWorld(null)
        setHistory([])
        return
      }
      setUsername(await ensureProfile(user as never))
      const cloudAvatar = await fetchAvatar()
      if (isAvatar(cloudAvatar)) {
        setAvatar(cloudAvatar)
        saveLocalAvatar(cloudAvatar)
      }
      setIsAdmin(await fetchIsAdmin())
      void syncPush()
      await refreshCloud()
    }
    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(!!data.session)
      setAuthReady(true)
      load(data.session?.user ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((e, sess) => {
      setIsSignedIn(!!sess) // synchrone : la garde d'accès s'ouvre dès la connexion
      setAuthReady(true)
      if (e === 'PASSWORD_RECOVERY') setScreen('reset') // lien « mot de passe oublié » ouvert
      setTimeout(() => load(sess?.user ?? null), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [today, refreshCloud])

  // Reset « pour tous » décidé par un admin : on vide l'état local du jour si le numéro de reset a changé.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const n = await fetchDailyResetN(today)
      if (cancelled) return
      let seen = 0
      try {
        seen = Number(localStorage.getItem(resetKey(today)) ?? 0)
      } catch {
        /* ignore */
      }
      if (n === seen) return
      try {
        localStorage.setItem(resetKey(today), String(n))
      } catch {
        /* ignore */
      }
      if (n > seen) {
        resetLocalToday()
        await refreshCloud()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, refreshCloud])

  // Calcul du défi du jour (quelques secondes sur mobile) : on laisse l'écran se dessiner avant.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [daily, sess] = await Promise.all([import('./game/daily'), import('./game/session')])
      engine.current = { BattleSession: sess.BattleSession, formatLog: sess.formatLog, formatSteps: sess.formatSteps }
      await new Promise((r) => setTimeout(r, 30))
      if (!cancelled) {
        const salt = await fetchDailySalt(today)
        if (!cancelled) setChallenge(daily.buildDaily(today, { salt }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [today, rerollTick])

  const finish = useCallback(
    (s: BattleSession) => {
      const v = s.view()
      if (!v.ended || !v.result) return
      const rec: DayRecord = {
        dayKey: today,
        trainer: s.challenge.trainer.name,
        gen: s.challenge.gen,
        result: v.result,
        turns: v.turn,
        survivors: v.player.team.filter((m) => !m.fainted).length,
        kos: v.opponent.team.filter((m) => m.fainted).length,
        hpLeft: Math.round((100 * v.player.team.reduce((a, m) => a + Math.max(0, m.hp), 0)) / Math.max(1, v.player.team.reduce((a, m) => a + m.maxhp, 0))),
        attempts: Math.max(1, loadAttempt(today)),
      }
      // Copie locale (invité / hors ligne) : un rejeu remplace la défaite du jour, jamais une victoire.
      const ex = getRecord(today)
      if (!ex || (ex.result === 'loss' && (ex.attempts ?? 1) < (rec.attempts ?? 1))) {
        saveRecord(rec)
        saveGrid(today, gridFromTeams(v.player.team, v.opponent.team)) // détail par Pokémon pour la grille de partage
      }
      if (signedIn.current) submitResult(rec, choices.current).then(refreshCloud)
      else setHistory(loadHistory())
    },
    [today, refreshCloud],
  )

  const startBattle = useCallback(() => {
    if (!challenge || !engine.current) return
    const { BattleSession, formatSteps } = engine.current
    const s = new BattleSession(challenge)
    session.current = s
    if (!loadAttempt(today)) {
      saveAttempt(today, 1) // 1er essai du jour : offert
      setAttemptNo(1)
    }
    const saved = loadChoices(today)
    choices.current = []
    const intro = formatSteps(s.drainLog())
    for (const c of saved) {
      choices.current.push(c)
      s.choose(c)
    }
    s.drainLog()
    const v = s.view()
    if (saved.length) {
      setQueue([])
      setPending(null)
      setView(v)
    } else {
      // Nouveau combat : le terrain est vide, les Pokémon entrent en scène un par un.
      setQueue(intro)
      setPending(v)
      setView({ ...v, player: { ...v.player, active: null }, opponent: { ...v.opponent, active: null } })
    }
    setScreen(saved.length ? 'battle' : 'intro') // nouveau combat : petite intro avant l'arène
    startMusic(musicFor(challenge.trainer.class, challenge.gen, isFormidable(challenge.gen, challenge.trainer.name))) // lancé par le clic sur « Lancer le combat »
    finish(s)
  }, [challenge, today, finish])

  // La musique s'arrête quand on quitte le combat, et en fondu une fois le dernier message lu.
  const battleOver = !!view?.ended && !queue.length && !pending
  // Victoire : le morceau de victoire démarre et continue sur l'écran de résultat ; défaite : fondu simple.
  useEffect(() => { if (screen !== 'intro' && screen !== 'battle' && screen !== 'result') stopMusic(0.6) }, [screen])
  useEffect(() => {
    if (!battleOver || !challenge) return
    if (view?.result === 'win') playVictory(musicFor(challenge.trainer.class, challenge.gen, isFormidable(challenge.gen, challenge.trainer.name)))
    else stopMusic(1.5)
  }, [battleOver]) // eslint-disable-line react-hooks/exhaustive-deps

  const act = (choice: string) => {
    const s = session.current
    if (!s) return
    choices.current.push(choice)
    saveChoices(today, choices.current)
    const before = s.view()
    setQueue(engine.current!.formatSteps(s.choose(choice), before))
    setPending(s.view()) // l'écran se met à jour une fois le texte lu
    finish(s)
    bump((n) => n + 1)
  }

  const forfeit = () => {
    const s = session.current
    if (!s || s.view().ended) return
    if (!window.confirm(t('battle.forfeitConfirm'))) return
    s.forfeit()
    setQueue([{ text: t('b.fled'), wait: 1000 }])
    setPending(s.view())
    finish(s)
  }

  /** Rejouer le combat du jour après une défaite : le cœur est dépensé tout de suite, les choix repartent de zéro. */
  const onReplay = () => {
    const info = hearts
    if (!info.canReplay) return
    saveAttempt(today, info.attempt + 1)
    setAttemptNo(info.attempt + 1)
    saveChoices(today, [])
    choices.current = []
    session.current = null
    setView(null)
    setQueue([])
    setPending(null)
    setScreen('team')
  }

  const rename = async (name: string) => {
    const r = await updateUsername(name)
    if (r === 'ok') {
      setUsername(name.trim())
      setRows(await fetchLeaderboard()) // le classement affiche le nouveau pseudo
    }
    return r
  }

  const chooseAvatar = async (id: string) => {
    if (!isAvatar(id)) return
    setAvatar(id)
    saveLocalAvatar(id)
    if ((await updateAvatar(id)) === 'ok') setRows(await fetchLeaderboard()) // le classement affiche la nouvelle icône
  }

  const adminReroll = async () => {
    if (!isAdmin) return
    if (!window.confirm(t('adm.confirmReroll'))) return
    if ((await adminRerollToday()) === null) {
      window.alert(t('adm.rerollFail'))
      return
    }
    try {
      localStorage.removeItem(progressKey(today))
      localStorage.removeItem(orderKey(today))
    } catch {
      /* ignore */
    }
    clearAttempt(today)
    setAttemptNo(0)
    session.current = null
    choices.current = []
    setOrder(null)
    setView(null)
    setQueue([])
    setPending(null)
    setChallenge(null)
    setRerollTick((n) => n + 1)
    setScreen('home')
  }

  const resetLocalToday = () => {
    try {
      localStorage.removeItem(progressKey(today))
      localStorage.removeItem(orderKey(today))
    } catch {
      /* ignore */
    }
    clearAttempt(today)
    setAttemptNo(0)
    removeRecord(today)
    session.current = null
    choices.current = []
    setOrder(null)
    setView(null)
    setQueue([])
    setPending(null)
  }

  const adminResetAll = async () => {
    if (!isAdmin) return
    if (!window.confirm(t('adm.confirmResetAll'))) return
    const n = await adminResetTodayAll()
    if (n === null) {
      window.alert(t('adm.resetFail'))
      return
    }
    try {
      localStorage.setItem(resetKey(today), String(n))
    } catch {
      /* ignore */
    }
    resetLocalToday()
    await refreshCloud()
    setScreen('home')
  }

  const adminReset = async () => {
    if (!isAdmin) return
    if (!window.confirm(t('adm.confirmReset'))) return
    if (!(await adminResetToday())) {
      window.alert(t('adm.resetFail'))
      return
    }
    try {
      localStorage.removeItem(progressKey(today))
      localStorage.removeItem(orderKey(today))
    } catch {
      /* ignore */
    }
    clearAttempt(today)
    setAttemptNo(0)
    removeRecord(today)
    session.current = null
    choices.current = []
    setOrder(null)
    setView(null)
    setQueue([])
    setPending(null)
    await refreshCloud()
    setScreen('home')
  }

  const advance = () => {
    const rest = queue.slice(1)
    setQueue(rest)
    if (!rest.length && pending) {
      setView(pending)
      setPending(null)
    }
  }

  const stats = computeStats(history, today)
  const score = useMemo(() => scoreHistory(history), [history])
  const baseHearts = heartsInfo(history, today, attemptNo)
  // Connecté mais serveur sans la colonne `attempts` : un rejeu ne pourrait pas être enregistré, on le désactive.
  const hearts = isSignedIn && !replayOk ? { ...baseHearts, canReplay: false } : baseHearts
  // Une défaite suivie d'un rejeu payé n'est plus « terminée » tant que le rejeu n'est pas fini.
  const done = history.some((r) => r.dayKey === today) && !hearts.replayPending
  const inProgress = !done && loadChoices(today).length > 0
  const onPlay = () => {
    if (done) setScreen('result')
    else if (inProgress) startBattle()
    else setScreen('opponent')
  }

  // Garde d'accès : pas connecté → on reste sur l'accueil/onboarding (ou la connexion).
  const entered = isSignedIn
  const PUBLIC_SCREENS: Screen[] = ['onboarding', 'auth', 'reset']
  if (!authReady && !entered)
    return (
      <main className="app center">
        <div className="splash-orb" />
      </main>
    )
  if (!entered && !PUBLIC_SCREENS.includes(screen)) {
    setScreen('onboarding')
    return null
  }
  // Une fois connecté, on quitte l'accueil/onboarding.
  if (entered && screen === 'onboarding') {
    setScreen('home')
    return null
  }

  if (screen === 'onboarding')
    return (
      <main className="app">
        <Onboarding done={() => setScreen('auth')} login={() => setScreen('auth')} />
      </main>
    )

  if (!challenge)
    return (
      <main className="app center">
        <div className="splash-orb" />
        <h1 className="title">Pokédle Battle</h1>
        <p className="muted">{t('app.preparing')}</p>
      </main>
    )

  const moveMon = (from: number, to: number) => {
    const cur = order && order.length === challenge.playerTeam.length ? [...order] : challenge.playerTeam.map((_, i) => i)
    ;[cur[from], cur[to]] = [cur[to], cur[from]]
    setOrder(cur)
    try {
      localStorage.setItem(orderKey(today), JSON.stringify(cur))
    } catch {
      /* ignore */
    }
  }
  const ctx: Ctx = { today, challenge, history, stats, score, username, avatar, onAvatar: chooseAvatar, onRename: rename, email, world, inProgress, go: setScreen, onPlay, moveMon, orderLocked: inProgress || done, done, hearts, onReplay, isAdmin, onAdminReset: adminReset, onAdminReroll: adminReroll, onAdminResetAll: adminResetAll }
  const back = () => setScreen(entered ? 'home' : 'onboarding')

  if (screen === 'intro')
    return <BattleIntro challenge={challenge} boosted={isFormidable(challenge.gen, challenge.trainer.name)} onDone={() => setScreen('battle')} />

  if (screen === 'battle' && view) {
    const over = view.ended && !queue.length && !pending
    const gi = GEN_INFO[challenge.gen]
    return (
      <div className="arena" data-theme="dark">
        <main className="app nonav">
          <TopBar
            title={<>{challenge.trainer.name}<div className="muted small">{classLabel(challenge.trainer)} · {gi.game}</div></>}
            right={<span className="pill">{t('battle.turn', { n: view.turn })}</span>}
          />
          <BattleScreen view={view} queue={queue} onAdvance={advance} onMove={(slot) => act(`move ${slot}`)} onSwitch={(idx) => act(`switch ${idx + 1}`)} onForfeit={forfeit} />
          <div className="stack" style={{ gap: 8 }}>
            {([[t('battle.you'), view.player.team], [challenge.trainer.name, view.opponent.team]] as const).map(([who, team]) => (
              <div key={who} className="squad">
                <span className="muted small" style={{ width: 72, fontWeight: 700 }}>{who}</span>
                {team.map((m) => <span key={m.idx} className={m.fainted ? 'ko' : undefined} title={spName(m.name)} style={{ display: 'contents' }}><MonOrb types={m.types} size={26} /></span>)}
              </div>
            ))}
          </div>
          {over && <button className="btn" onClick={() => setScreen('result')}>{t('battle.seeResult')}</button>}
        </main>
      </div>
    )
  }

  if (screen === 'guide') return <Guide {...ctx} onBack={() => setScreen('settings')} />

  const showNav = NAV_SCREENS.includes(screen)
  return (
    <main className={showNav ? 'app' : 'app nonav'}>
      {showNav && <div className="scorebar"><ScoreBadge points={score.total} /></div>}
      {screen === 'home' && <Home {...ctx} />}
      {screen === 'opponent' && <Opponent {...ctx} onBack={back} />}
      {screen === 'team' && <Team {...ctx} onBack={() => setScreen('opponent')} onStart={startBattle} />}
      {screen === 'result' && <Result {...ctx} />}
      {screen === 'history' && <History {...ctx} />}
      {screen === 'leaderboard' && <Leaderboard {...ctx} rows={rows} />}
      {screen === 'settings' && <Settings {...ctx} theme={theme} setTheme={setTheme} version={`1.0 · ${__BUILD__}`} />}
      {screen === 'auth' && <Auth {...ctx} onBack={back} />}
      {screen === 'reset' && <ResetPassword {...ctx} onDone={() => setScreen('home')} />}
      {screen === 'reminders' && <Reminders {...ctx} onBack={() => setScreen('settings')} />}
      {screen === 'admin' && isAdmin && <Admin {...ctx} onBack={() => setScreen('settings')} />}
      {showNav && <BottomNav screen={screen} go={setScreen} onPlay={onPlay} />}
      <span hidden>{dayNumber(today)}</span>
    </main>
  )
}
