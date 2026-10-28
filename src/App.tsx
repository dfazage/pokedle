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
import { computeStats, getRecord, loadHistory, recordFor, removeRecord, saveRecord, slotOf, type DayRecord } from './game/history'
import { gridFromTeams, saveGrid } from './game/share'
import { clearAttempt, heartsInfo, loadAttempt, saveAttempt } from './game/hearts'
import { battleId, gameDayKey, openSlots, slotsPerDay } from './game/rng'
import { classLabel, GEN_INFO, spName, trainerName } from './game/fr'
import { t, useLang } from './i18n'
import { autoUpdate, staleBuild, useUpdateAvailable } from './game/update'
import { UpdateBanner } from './ui/UpdateBanner'
import { Announce } from './ui/Announce'
import { dayNumber } from './game/info'
import { isFormidable, scoreHistory } from './game/scoring'
import { isAvatar, loadLocalAvatar, saveLocalAvatar } from './game/avatars'
import { supabase, ensureProfile, fetchHistory, submitResult, fetchLeaderboard, fetchWorldStats, fetchAvatar, updateAvatar, fetchIsAdmin, adminResetToday, fetchDailySalt, adminRerollToday, updateUsername, adminResetTodayAll, fetchDailyResetN, serverSupportsReplay, type LeaderRow } from './game/cloud'
import { syncPush } from './game/push'
import BattleScreen from './BattleScreen'
import { musicFor, playVictory, setMusicLowHp, startMusic, stopMusic } from './game/music'
import { BottomNav, LangNotch, MonOrb, ScoreBadge, TopBar, useLocalState, type Screen } from './ui/kit'
import { Home, Opponent, Team, Result } from './screens/Play'
import { History, Leaderboard, Settings } from './screens/Social'
import { Admin, Auth, Onboarding, ResetPassword } from './screens/Account'
import { Guide } from './screens/Guide'
import { Reminders } from './screens/Reminders'
import { BattleIntro } from './screens/BattleIntro'
import type { Ctx } from './screens/types'
import { syncLocalOwner } from './game/localOwner'

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
  const today = useMemo(() => gameDayKey(), []) // jour de jeu au chargement ; le changement de jour recharge l'app (voir plus bas)
  const slots = slotsPerDay(today) // combats du jour (2 à partir du 18/10 clé, soit le 17/10 à 12h KL)
  const openAtLoad = useMemo(() => openSlots(), []) // combats déjà publiés au chargement ; la publication du suivant recharge l'app
  const [theme, setTheme] = useLocalState<'auto' | 'light' | 'dark'>('pokedle:theme', 'auto')
  // Accès à l'app : il faut être connecté.
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [authReady, setAuthReady] = useState(!supabase) // session Supabase restaurée ?
  const [screen, setScreen] = useState<Screen>('onboarding')
  // Changement de jour de jeu (12h KL) ou publication du combat n°2 (18h KL) app ouverte : on recharge pour repartir proprement (défi, essais, historique),
  // sauf pendant un combat ou son résultat (la progression est sauvegardée par jour, rien n'est perdu). Contrôle au retour au premier plan et chaque minute.
  useEffect(() => {
    if (['intro', 'battle', 'result', 'reset'].includes(screen)) return
    const check = () => { if (gameDayKey() !== today || openSlots() !== openAtLoad) location.reload() }
    check()
    const id = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', check) }
  }, [screen, today, openAtLoad])
  // Combat affiché (1 ou 2) : suit l'état du jour tant qu'on est sur l'accueil, reste fixe pendant un combat / un résultat.
  const [slot, setSlot] = useState(() => (slots === 2 && loadHistory().some((r) => r.dayKey === today && slotOf(r) === 1) ? 2 : 1))
  const bid = battleId(today, slot) // identifiant du combat affiché (clés de stockage local)
  const locked = slot > openAtLoad // combat pas encore publié
  const buildSlot = locked ? 1 : slot
  const [challenges, setChallenges] = useState<Record<number, DailyChallenge>>({})
  const baseChallenge = challenges[buildSlot] ?? null
  const [rerollTick, setRerollTick] = useState(0)
  const [order, setOrder] = useState<number[] | null>(() => loadOrder(bid))
  const [history, setHistory] = useState<DayRecord[]>(() => loadHistory())
  const [attemptNo, setAttemptNo] = useState(() => loadAttempt(bid)) // essais commencés pour ce combat (1 = essai offert)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(loadLocalAvatar)
  const [isAdmin, setIsAdmin] = useState(false)
  const [replayOk, setReplayOk] = useState(true) // le serveur sait enregistrer un rejeu (supabase/results_attempts.sql appliqué)
  const [rows, setRows] = useState<LeaderRow[]>([])
  const slotRef = useRef(slot)
  slotRef.current = slot
  const [world, setWorld] = useState<{ players: number; wins: number } | null>(null)
  const [view, setView] = useState<BattleView | null>(null)
  const [queue, setQueue] = useState<Step[]>([])
  const [pending, setPending] = useState<BattleView | null>(null)
  const [, bump] = useState(0)
  const signedIn = useRef(false)
  const session = useRef<BattleSession | null>(null)
  const choices = useRef<string[]>([])
  const engine = useRef<Engine | null>(null)
  // Mode entraînement : défi d'un jour passé rejoué depuis l'Historique. Rien n'est enregistré (ni résultat, ni cœurs, ni points, ni série).
  const [practice, setPractice] = useState<DailyChallenge | null>(null)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const practiceRef = useRef<DailyChallenge | null>(null)
  practiceRef.current = practice
  const { available: updateAvailable } = useUpdateAvailable() // le serveur publie une autre version que celle qui tourne
  const [updateLater, setUpdateLater] = useState(false)

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
    setWorld(await fetchWorldStats(today, slotRef.current))
  }, [today])
  useEffect(() => {
    if (!supabase) return
    const load = async (user: { id: string; email?: string } | null) => {
      signedIn.current = !!user
      setEmail(user?.email ?? null)
      setUserId(user?.id ?? null)
      if (syncLocalOwner(user?.id ?? null)) {
        // Autre compte (ou déconnexion) : on oublie le combat, l'ordre, les essais et l'avatar de l'ancien compte.
        session.current = null
        choices.current = []
        setOrder(null)
        setAttemptNo(0)
        setView(null)
        setQueue([])
        setPending(null)
        setPractice(null)
        setAvatar(null)
        setHistory(loadHistory())
        setScreen((s) => (s === 'battle' || s === 'intro' || s === 'result' || s === 'team' || s === 'opponent' ? 'home' : s))
      }
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

  // Autre combat affiché : ordre d'équipe, essais et statistiques mondiales de ce combat.
  useEffect(() => {
    setOrder(loadOrder(bid))
    setAttemptNo(loadAttempt(bid))
    if (supabase) void fetchWorldStats(today, slot).then(setWorld)
  }, [bid, today, slot])

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

  // Calcul du défi du combat affiché (quelques secondes sur mobile) : on laisse l'écran se dessiner avant. Un défi déjà calculé est conservé.
  useEffect(() => {
    if (challenges[buildSlot]) return
    let cancelled = false
    ;(async () => {
      const [daily, sess, stale] = await Promise.all([import('./game/daily'), import('./game/session'), staleBuild()])
      // Bundle périmé : on recharge AVANT de tirer le dresseur, sinon ce client pourrait en tirer un autre que les autres joueurs.
      if (!cancelled && stale && !session.current && autoUpdate(stale)) return
      engine.current = { BattleSession: sess.BattleSession, formatLog: sess.formatLog, formatSteps: sess.formatSteps }
      await new Promise((r) => setTimeout(r, 30))
      if (!cancelled) {
        const salt = await fetchDailySalt(today)
        if (!cancelled) setChallenges((cur) => ({ ...cur, [buildSlot]: daily.buildDaily(today, { salt, slot: buildSlot }) }))
      }
    })()
    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, rerollTick, buildSlot])

  const finish = useCallback(
    (s: BattleSession) => {
      const v = s.view()
      if (!v.ended || !v.result) return
      const rec: DayRecord = {
        dayKey: today,
        ...(slot > 1 ? { slot } : {}),
        trainer: s.challenge.trainer.name,
        gen: s.challenge.gen,
        result: v.result,
        turns: v.turn,
        survivors: v.player.team.filter((m) => !m.fainted).length,
        kos: v.opponent.team.filter((m) => m.fainted).length,
        hpLeft: Math.round((100 * v.player.team.reduce((a, m) => a + Math.max(0, m.hp), 0)) / Math.max(1, v.player.team.reduce((a, m) => a + m.maxhp, 0))),
        attempts: Math.max(1, loadAttempt(bid)),
      }
      // Copie locale (invité / hors ligne) : un rejeu remplace la défaite du jour, jamais une victoire.
      const ex = getRecord(today, slot)
      if (!ex || (ex.result === 'loss' && (ex.attempts ?? 1) < (rec.attempts ?? 1))) {
        saveRecord(rec)
        saveGrid(bid, gridFromTeams(v.player.team, v.opponent.team)) // détail par Pokémon pour la grille de partage
      }
      if (signedIn.current) submitResult(rec, choices.current).then(refreshCloud)
      else setHistory(loadHistory())
    },
    [today, slot, bid, refreshCloud],
  )

  /** Lance un combat sur `ch` en rejouant les choix `saved` (reprise d'un combat en cours). */
  const launch = useCallback((ch: DailyChallenge, saved: string[]) => {
    const { BattleSession, formatSteps } = engine.current!
    const s = new BattleSession(ch)
    session.current = s
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
    startMusic(musicFor(ch.trainer.class, ch.gen, isFormidable(ch.gen, ch.trainer.name), ch.trainer.id)) // lancé par le clic sur « Lancer le combat »
    return s
  }, [])

  const startBattle = useCallback(() => {
    if (!challenge || !engine.current) return
    setPractice(null)
    if (!loadAttempt(bid)) {
      saveAttempt(bid, 1) // 1er essai du combat : offert
      setAttemptNo(1)
    }
    finish(launch(challenge, loadChoices(bid)))
  }, [challenge, bid, finish, launch])

  /** Entraînement : rejoue le combat `slot` d'un jour passé (même dresseur et mêmes équipes que ce jour-là, re-tirage admin compris). */
  const onPractice = useCallback(async (dayKey: string, n: number) => {
    if (dayKey >= today || practiceLoading) return
    setPracticeLoading(true)
    try {
      const [daily, sess] = await Promise.all([import('./game/daily'), import('./game/session')])
      engine.current ??= { BattleSession: sess.BattleSession, formatLog: sess.formatLog, formatSteps: sess.formatSteps }
      const salt = await fetchDailySalt(dayKey)
      await new Promise((r) => setTimeout(r, 30)) // laisse l'écran de préparation se dessiner (calcul de quelques secondes sur mobile)
      const ch = daily.buildDaily(dayKey, { salt, slot: n })
      setPractice(ch)
      practiceRef.current = ch
      launch(ch, [])
    } finally {
      setPracticeLoading(false)
    }
  }, [today, practiceLoading, launch])

  /** Fin de l'entraînement : retour à l'Historique, le combat du jour n'est pas touché. */
  const exitPractice = () => {
    session.current = null
    choices.current = []
    setPractice(null)
    setView(null)
    setQueue([])
    setPending(null)
    setScreen('history')
  }

  // La musique s'arrête quand on quitte le combat, et en fondu une fois le dernier message lu.
  const battleOver = !!view?.ended && !queue.length && !pending
  // Victoire : le morceau de victoire démarre et continue sur l'écran de résultat ; défaite : fondu simple.
  useEffect(() => { if (screen !== 'intro' && screen !== 'battle' && screen !== 'result') stopMusic(0.6) }, [screen])
  useEffect(() => {
    const ch = practiceRef.current ?? challenge
    if (!battleOver || !ch) return
    if (view?.result === 'win') playVictory(musicFor(ch.trainer.class, ch.gen, isFormidable(ch.gen, ch.trainer.name), ch.trainer.id))
    else stopMusic(1.5)
  }, [battleOver]) // eslint-disable-line react-hooks/exhaustive-deps

  // Thème « K.O. imminent » : dernier Pokémon en vie, ou moins d'un quart des PV de l'équipe (sans effet si le thème n'a pas de variante).
  const lowHp = useMemo(() => {
    if (!view || view.ended) return false
    const team = view.player.team
    const hp = team.reduce((a, m) => a + Math.max(0, m.hp), 0)
    const max = team.reduce((a, m) => a + m.maxhp, 0)
    return team.filter((m) => m.hp > 0).length <= 1 || hp / Math.max(1, max) <= 0.25
  }, [view])
  useEffect(() => { if (queue.length === 0 && !pending) setMusicLowHp(lowHp) }, [lowHp, queue.length, pending])

  const act = (choice: string) => {
    const s = session.current
    if (!s) return
    choices.current.push(choice)
    if (!practiceRef.current) saveChoices(bid, choices.current) // entraînement : rien n'est sauvegardé
    const before = s.view()
    setQueue(engine.current!.formatSteps(s.choose(choice), before))
    setPending(s.view()) // l'écran se met à jour une fois le texte lu
    if (!practiceRef.current) finish(s)
    bump((n) => n + 1)
  }

  const forfeit = () => {
    const s = session.current
    if (!s || s.view().ended) return
    if (practiceRef.current) {
      exitPractice() // entraînement : quitter sans rien compter
      return
    }
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
    saveAttempt(bid, info.attempt + 1)
    setAttemptNo(info.attempt + 1)
    saveChoices(bid, [])
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

  /** Efface l'état local (progression, ordre, essais) des deux combats du jour. */
  const clearLocalBattles = () => {
    for (let n = 1; n <= 2; n++) {
      const id = battleId(today, n)
      try {
        localStorage.removeItem(progressKey(id))
        localStorage.removeItem(orderKey(id))
      } catch {
        /* ignore */
      }
      clearAttempt(id)
    }
  }

  const adminReroll = async () => {
    if (!isAdmin) return
    if (!window.confirm(t('adm.confirmReroll'))) return
    if ((await adminRerollToday()) === null) {
      window.alert(t('adm.rerollFail'))
      return
    }
    clearLocalBattles()
    setAttemptNo(0)
    session.current = null
    choices.current = []
    setOrder(null)
    setView(null)
    setQueue([])
    setPending(null)
    setChallenges({})
    setRerollTick((n) => n + 1)
    setScreen('home')
  }

  const resetLocalToday = () => {
    clearLocalBattles()
    setAttemptNo(0)
    removeRecord(today)
    setSlot(1)
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
    clearLocalBattles()
    setAttemptNo(0)
    removeRecord(today)
    setSlot(1)
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

  const stats = computeStats(history, today, slots)
  const score = useMemo(() => scoreHistory(history), [history])
  const baseHearts = heartsInfo(history, today, attemptNo, slot)
  // Connecté mais serveur sans la colonne `attempts` : un rejeu ne pourrait pas être enregistré, on le désactive.
  const hearts = isSignedIn && !replayOk ? { ...baseHearts, canReplay: false } : baseHearts
  // Une défaite suivie d'un rejeu payé n'est plus « terminée » tant que le rejeu n'est pas fini.
  const done = !!recordFor(history, today, slot) && !hearts.replayPending
  const inProgress = !done && !locked && loadChoices(bid).length > 0
  // Combat à afficher sur l'accueil : le n°2 dès que le n°1 est terminé (le n°1 en rejeu en cours reste le n°1).
  const h1 = heartsInfo(history, today, slot === 1 ? attemptNo : loadAttempt(battleId(today, 1)), 1)
  const activeSlot = slots === 2 && !!recordFor(history, today, 1) && !h1.replayPending ? 2 : 1
  useEffect(() => {
    if (screen === 'home' && slot !== activeSlot) setSlot(activeSlot)
  }, [screen, slot, activeSlot])
  const viewResult = (n: number) => {
    setSlot(n)
    setScreen('result')
  }
  const onPlay = () => {
    if (locked) viewResult(1)
    else if (done) setScreen('result')
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
      <main className="app nonav">
        <Onboarding done={() => setScreen('auth')} login={() => setScreen('auth')} />
      </main>
    )

  if (!challenge)
    return (
      <main className="app center">
        <div className="splash-orb" />
        <h1 className="title">Pokébadle Battle</h1>
        <p className="muted">{t('app.preparing')}</p>
      </main>
    )

  const moveMon = (from: number, to: number) => {
    const cur = order && order.length === challenge.playerTeam.length ? [...order] : challenge.playerTeam.map((_, i) => i)
    ;[cur[from], cur[to]] = [cur[to], cur[from]]
    setOrder(cur)
    try {
      localStorage.setItem(orderKey(bid), JSON.stringify(cur))
    } catch {
      /* ignore */
    }
  }
  const ctx: Ctx = { today, slot, slots, locked, onViewResult: viewResult, challenge, history, stats, score, username, avatar, onAvatar: chooseAvatar, onRename: rename, email, world, inProgress, go: setScreen, onPlay, moveMon, orderLocked: inProgress || done || locked, done, hearts, onReplay, isAdmin, onAdminReset: adminReset, onAdminReroll: adminReroll, onAdminResetAll: adminResetAll, onPractice: (d, n) => void onPractice(d, n) }
  const back = () => setScreen(entered ? 'home' : 'onboarding')
  const bc = practice ?? challenge // défi du combat affiché (entraînement ou combat du jour)

  if (practiceLoading)
    return (
      <main className="app center">
        <div className="splash-orb" />
        <p className="muted">{t('practice.preparing')}</p>
      </main>
    )

  if (screen === 'intro')
    return <BattleIntro challenge={bc} boosted={isFormidable(bc.gen, bc.trainer.name)} onDone={() => setScreen('battle')} />

  if (screen === 'battle' && view) {
    const over = view.ended && !queue.length && !pending
    const gi = GEN_INFO[bc.gen]
    return (
      <div className="arena" data-theme="dark">
        <main className="app nonav">
          <TopBar
            title={<>{trainerName(bc.trainer.name)}<div className="muted small">{classLabel(bc.trainer)} · {gi.game}</div></>}
            right={<span className="pill">{t('battle.turn', { n: view.turn })}</span>}
          />
          {practice && <div className="practice-banner">{t('practice.banner', { d: dayNumber(practice.dayKey) })}</div>}
          <BattleScreen view={view} queue={queue} onAdvance={advance} onMove={(slot) => act(`move ${slot}`)} onSwitch={(idx) => act(`switch ${idx + 1}`)} onForfeit={forfeit} />
          <div className="stack" style={{ gap: 8 }}>
            {([[t('battle.you'), view.player.team], [trainerName(bc.trainer.name), view.opponent.team]] as const).map(([who, team]) => (
              <div key={who} className="squad">
                <span className="muted small" style={{ width: 72, fontWeight: 700 }}>{who}</span>
                {team.map((m) => <span key={m.idx} className={m.fainted ? 'ko' : undefined} title={spName(m.name)} style={{ display: 'contents' }}><MonOrb types={m.types} size={26} /></span>)}
              </div>
            ))}
          </div>
          {over && (practice
            ? <button className="btn" onClick={exitPractice}>{t('practice.back')}</button>
            : <button className="btn" onClick={() => setScreen('result')}>{t('battle.seeResult')}</button>)}
        </main>
      </div>
    )
  }

  if (screen === 'guide') return <Guide {...ctx} onBack={() => setScreen('settings')} />

  const showNav = NAV_SCREENS.includes(screen)
  const showUpdate = updateAvailable && !updateLater && (showNav || screen === 'opponent' || screen === 'team')
  return (
    <main className={showNav ? 'app' : 'app nonav'}>
      {screen !== 'leaderboard' && <div className="app-glow" aria-hidden="true"><i /><i /><i /><i /></div>}
      {showUpdate && <UpdateBanner onLater={() => setUpdateLater(true)} />}
      {showNav && <div className="scorebar"><ScoreBadge points={score.total} /></div>}
      {screen === 'home' && <Home {...ctx} />}
      {screen === 'opponent' && <Opponent {...ctx} onBack={back} />}
      {screen === 'team' && <Team {...ctx} onBack={() => setScreen('opponent')} onStart={startBattle} />}
      {screen === 'result' && <Result {...ctx} />}
      {screen === 'history' && <History {...ctx} />}
      {screen === 'leaderboard' && <Leaderboard {...ctx} rows={rows} />}
      {screen === 'settings' && <Settings {...ctx} theme={theme} setTheme={setTheme} version={`${__APP_VERSION__} · ${__BUILD__}`} />}
      {screen === 'auth' && <Auth {...ctx} onBack={back} />}
      {screen === 'reset' && <ResetPassword {...ctx} onDone={() => setScreen('home')} />}
      {screen === 'reminders' && <Reminders {...ctx} onBack={() => setScreen('settings')} />}
      {screen === 'admin' && isAdmin && <Admin {...ctx} onBack={() => setScreen('settings')} />}
      {showNav && <BottomNav screen={screen} go={setScreen} onPlay={onPlay} />}
      <Announce userId={userId} hold={screen !== 'home' || showUpdate} />
      <span hidden>{dayNumber(today)}</span>
    </main>
  )
}
