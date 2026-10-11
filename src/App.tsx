import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './ui/theme.css'
import type { DailyChallenge } from './game/daily'
import type { BattleSession, BattleView } from './game/session'
import { computeStats, getRecord, loadHistory, removeRecord, saveRecord, type DayRecord } from './game/history'
import { dayKeyUTC } from './game/rng'
import { CLASS_FR, GEN_INFO, spFr } from './game/fr'
import { dayNumber } from './game/info'
import { supabase, ensureProfile, fetchHistory, submitResult, fetchLeaderboard, fetchWorldStats, fetchIsAdmin, adminResetToday, type LeaderRow } from './game/cloud'
import BattleScreen from './BattleScreen'
import { BottomNav, MonOrb, TopBar, useLocalState, type Screen } from './ui/kit'
import { Home, Opponent, Team, Result } from './screens/Play'
import { History, Leaderboard, Settings } from './screens/Social'
import { Admin, Auth, Generations, Onboarding } from './screens/Account'
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

const orderKey = (day: string) => `pokedle:order:${day}`
function loadOrder(day: string): number[] | null {
  try {
    const o = JSON.parse(localStorage.getItem(orderKey(day)) ?? 'null')
    return Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

type Engine = { BattleSession: typeof import('./game/session').BattleSession; formatLog: typeof import('./game/session').formatLog }
const NAV_SCREENS: Screen[] = ['home', 'history', 'leaderboard', 'settings', 'result', 'generations']

export default function App() {
  const today = useMemo(() => dayKeyUTC(), [])
  const [theme, setTheme] = useLocalState<'auto' | 'light' | 'dark'>('pokedle:theme', 'auto')
  const [onboarded, setOnboarded] = useLocalState<'0' | '1'>('pokedle:onboarded', '0')
  const [screen, setScreen] = useState<Screen>(onboarded === '1' ? 'home' : 'onboarding')
  const [baseChallenge, setChallenge] = useState<DailyChallenge | null>(null)
  const [order, setOrder] = useState<number[] | null>(() => loadOrder(today))
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [history, setHistory] = useState<DayRecord[]>(() => loadHistory())
  const [email, setEmail] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [rows, setRows] = useState<LeaderRow[]>([])
  const [world, setWorld] = useState<{ players: number; wins: number } | null>(null)
  const [view, setView] = useState<BattleView | null>(null)
  const [queue, setQueue] = useState<string[]>([])
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
        setHistory(loadHistory())
        return
      }
      setUsername(await ensureProfile(user as never))
      setIsAdmin(await fetchIsAdmin())
      // Résultat joué en invité aujourd'hui : on le rattache au compte s'il n'existe pas encore en ligne.
      const cloud = await fetchHistory()
      const local = getRecord(today)
      if (local && !cloud.some((r) => r.dayKey === today)) await submitResult(local, loadChoices(today))
      await refreshCloud()
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setTimeout(() => load(sess?.user ?? null), 0))
    return () => sub.subscription.unsubscribe()
  }, [today, refreshCloud])

  // Calcul du défi du jour (quelques secondes sur mobile) : on laisse l'écran se dessiner avant.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [daily, sess] = await Promise.all([import('./game/daily'), import('./game/session')])
      engine.current = { BattleSession: sess.BattleSession, formatLog: sess.formatLog }
      await new Promise((r) => setTimeout(r, 30))
      if (!cancelled) {
        setCounts(daily.TRAINER_COUNTS)
        setChallenge(daily.buildDaily(today))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [today])

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
      }
      if (!getRecord(today)) saveRecord(rec) // copie locale (invité / hors ligne)
      if (signedIn.current) submitResult(rec, choices.current).then(refreshCloud)
      else setHistory(loadHistory())
    },
    [today, refreshCloud],
  )

  const startBattle = useCallback(() => {
    if (!challenge || !engine.current) return
    const { BattleSession, formatLog } = engine.current
    const s = new BattleSession(challenge)
    session.current = s
    const saved = loadChoices(today)
    choices.current = []
    const intro = formatLog(s.drainLog())
    for (const c of saved) {
      choices.current.push(c)
      s.choose(c)
    }
    s.drainLog()
    setQueue(saved.length ? [] : intro.filter((l) => !l.startsWith('—')))
    setPending(null)
    setView(s.view())
    setScreen('battle')
    finish(s)
  }, [challenge, today, finish])

  const act = (choice: string) => {
    const s = session.current
    if (!s) return
    choices.current.push(choice)
    saveChoices(today, choices.current)
    const lines = engine.current!.formatLog(s.choose(choice)).filter((l) => !l.startsWith('—'))
    setQueue(lines)
    setPending(s.view()) // l'écran se met à jour une fois le texte lu
    finish(s)
    bump((n) => n + 1)
  }

  const forfeit = () => {
    const s = session.current
    if (!s || s.view().ended) return
    if (!window.confirm('Fuir compte comme une défaite pour aujourd’hui. Continuer ?')) return
    s.forfeit()
    setQueue(['Tu as pris la fuite… (défaite)'])
    setPending(s.view())
    finish(s)
  }

  const adminReset = async () => {
    if (!isAdmin) return
    if (!window.confirm('Réinitialiser le combat du jour (résultat, progression, ordre de l’équipe) ?')) return
    if (!(await adminResetToday())) {
      window.alert('Reset impossible (droits admin ou connexion).')
      return
    }
    try {
      localStorage.removeItem(progressKey(today))
      localStorage.removeItem(orderKey(today))
    } catch {
      /* ignore */
    }
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
  const done = history.some((r) => r.dayKey === today)
  const inProgress = !done && loadChoices(today).length > 0
  const onPlay = () => {
    if (done) setScreen('result')
    else if (inProgress) startBattle()
    else setScreen('opponent')
  }

  if (screen === 'onboarding')
    return (
      <main className="app">
        <Onboarding done={() => { setOnboarded('1'); setScreen('home') }} login={() => { setOnboarded('1'); setScreen('auth') }} />
      </main>
    )

  if (!challenge)
    return (
      <main className="app center">
        <div className="splash-orb" />
        <h1 className="title">Pokédle Battle</h1>
        <p className="muted">Préparation du combat du jour…</p>
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
  const ctx: Ctx = { today, challenge, history, stats, username, email, world, inProgress, go: setScreen, onPlay, moveMon, orderLocked: inProgress || done, isAdmin, onAdminReset: adminReset }
  const back = () => setScreen('home')

  if (screen === 'battle' && view) {
    const over = view.ended && !queue.length && !pending
    const gi = GEN_INFO[challenge.gen]
    return (
      <div className="arena" data-theme="dark">
        <main className="app nonav">
          <TopBar
            title={<>{challenge.trainer.name}<div className="muted small">{CLASS_FR[challenge.trainer.class] ?? challenge.trainer.class} · {gi.game}</div></>}
            right={<span className="pill">Tour {view.turn}</span>}
          />
          <BattleScreen view={view} queue={queue} onAdvance={advance} onMove={(slot) => act(`move ${slot}`)} onSwitch={(idx) => act(`switch ${idx + 1}`)} onForfeit={forfeit} />
          <div className="stack" style={{ gap: 8 }}>
            {([['Toi', view.player.team], [challenge.trainer.name, view.opponent.team]] as const).map(([who, team]) => (
              <div key={who} className="squad">
                <span className="muted small" style={{ width: 72, fontWeight: 700 }}>{who}</span>
                {team.map((m) => <span key={m.idx} className={m.fainted ? 'ko' : undefined} title={spFr(m.name)} style={{ display: 'contents' }}><MonOrb types={m.types} size={26} /></span>)}
              </div>
            ))}
          </div>
          {over && <button className="btn" onClick={() => setScreen('result')}>Voir mon résultat</button>}
        </main>
      </div>
    )
  }

  const showNav = NAV_SCREENS.includes(screen)
  return (
    <main className={showNav ? 'app' : 'app nonav'}>
      {screen === 'home' && <Home {...ctx} />}
      {screen === 'opponent' && <Opponent {...ctx} onBack={back} />}
      {screen === 'team' && <Team {...ctx} onBack={() => setScreen('opponent')} onStart={startBattle} />}
      {screen === 'result' && <Result {...ctx} />}
      {screen === 'history' && <History {...ctx} />}
      {screen === 'leaderboard' && <Leaderboard {...ctx} rows={rows} />}
      {screen === 'settings' && <Settings {...ctx} theme={theme} setTheme={setTheme} version="1.0" />}
      {screen === 'auth' && <Auth {...ctx} onBack={back} />}
      {screen === 'admin' && isAdmin && <Admin {...ctx} onBack={() => setScreen('settings')} />}
      {screen === 'generations' && <Generations {...ctx} counts={counts} onBack={back} />}
      {showNav && <BottomNav screen={screen} go={setScreen} onPlay={onPlay} />}
      <span hidden>{dayNumber(today)}</span>
    </main>
  )
}
