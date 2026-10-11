import { useEffect, useRef, useState } from 'react'
import type { BattleView, MonView } from './game/session'
import type { MonPatch, Step } from './game/patch'
import '@fontsource/press-start-2p'
import { TYPE_FR, mvFr, spFr } from './game/fr'
import { MonImg } from './game/officialSprites'
import './Battle.css'

const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Grass: '#78c850', Electric: '#f8d030', Ice: '#98d8d8',
  Fighting: '#c03028', Poison: '#a040a0', Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
  Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#b8b8d0',
}

// Press Start 2P : chaque glyphe fait 1 em de large → on réduit la police pour que le texte tienne dans `avail` unités.
const fit = (len: number, avail: number, max: number, min: number) => Math.max(min, Math.min(max, avail / Math.max(1, len)))
const fitStyle = (text: string, avail: number, max: number, min: number): React.CSSProperties => ({ fontSize: `calc(var(--u) * ${fit(text.length, avail, max, min).toFixed(2)})` })

/** Fait défiler un nombre vers sa nouvelle valeur (le compteur de PV s'écoule comme la barre). */
function useTween(target: number, ms = 600) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const a = from.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      from.current = Math.round(a + (target - a) * k)
      setV(from.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function HpBox({ mon, own }: { mon: MonView | null; own?: boolean }) {
  const shownHp = useTween(mon?.hp ?? 0)
  if (!mon) return null
  const pct = Math.max(0, (mon.hp / mon.maxhp) * 100)
  const tone = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'low'
  const name = spFr(mon.name).toUpperCase()
  return (
    <div className={`hpbox ${own ? 'own' : 'foe'}`}>
      <div className="hrow"><span className="nm" style={fitStyle(name, 66, 7, 4)}>{name}</span><span className="lv">Nv100</span></div>
      <div className="hrow bar">
        <span className="hplabel">PV</span>
        <div className="track"><div className={`fill ${tone}`} style={{ width: `${pct}%` }} /></div>
      </div>
      {own && <div className="num">{shownHp}/{mon.maxhp}</div>}
      {mon.status && <span className="st">{mon.status.toUpperCase()}</span>}
    </div>
  )
}

function Sprite({ mon, back }: { mon: MonView | null; back?: boolean }) {
  if (!mon || mon.fainted) return null
  // Sprite de la génération en cours (public/sprites), repli sur le sprite généré par code (game/sprites.ts).
  return <MonImg spec={mon} back={back} className={`sprite ${back ? 'back' : 'front'}`} alt={spFr(mon.name)} draggable={false} />
}

interface Props {
  view: BattleView
  queue: Step[]
  onAdvance: () => void
  /** Applique les changements d'affichage liés à un message (PV, statut, K.O., entrée en jeu). */
  onPatch: (patch: MonPatch[]) => void
  onMove: (slot: number) => void
  onSwitch: (idx: number) => void
  onForfeit: () => void
}

export default function BattleScreen({ view, queue, onAdvance, onPatch, onMove, onSwitch, onForfeit }: Props) {
  const [menu, setMenu] = useState<'main' | 'moves' | 'team'>('main')
  // Progression de la machine à écrire, rattachée au message qu'elle concerne : changer de message repart
  // toujours de 0, sans état périmé d'un message précédent (c'est ce qui laissait la boîte de texte vide).
  const [typedState, setTypedState] = useState<{ step: Step | undefined; n: number }>({ step: undefined, n: 0 })
  const step = queue[0]
  const msg = step?.text ?? ''
  const typed = typedState.step === step ? typedState.n : 0

  useEffect(() => {
    if (!step || !step.text) return
    let k = 0
    const id = window.setInterval(() => {
      k += 1
      setTypedState((t) => ({ step, n: t.step === step ? Math.max(t.n, k) : k }))
      if (k >= step.text.length) window.clearInterval(id)
    }, 22)
    return () => window.clearInterval(id)
  }, [step])
  useEffect(() => setMenu('main'), [view.turn, view.request])

  const typing = !!msg && typed < msg.length
  const typingDone = !!step && !typing

  // PV, statuts, K.O. : `before` quand le message apparaît, `after` quand il a fini de s'écrire.
  const appliedBefore = useRef<Step | null>(null)
  const appliedAfter = useRef<Step | null>(null)
  useEffect(() => {
    if (step?.before && appliedBefore.current !== step) {
      appliedBefore.current = step
      onPatch(step.before)
    }
  }, [step, onPatch])
  useEffect(() => {
    if (step?.after && typingDone && appliedAfter.current !== step) {
      appliedAfter.current = step
      onPatch(step.after)
    }
  }, [step, typingDone, onPatch])

  const tap = () => {
    if (!msg) return
    if (typing) setTypedState({ step, n: msg.length })
    else onAdvance()
  }

  const showMenu = !msg && !view.ended
  const forced = view.request === 'switch'
  const choosingTeam = showMenu && (menu === 'team' || forced)
  const alive = view.player.team.filter((m) => !m.fainted && !m.active)

  let prompt = msg.slice(0, typed)
  if (!msg && !view.ended) {
    prompt = forced ? 'Envoyer quel POKéMON ?' : `Que doit faire ${spFr(view.player.active?.name ?? '').toUpperCase()} ?`
  }
  if (!msg && view.ended) prompt = view.result === 'win' ? 'Tu as gagné le combat !' : 'Tu as perdu le combat…'

  const nameOf = (n: string) => spFr(n).toUpperCase()
  const moveName = (n: string) => mvFr(n.replace(/^(Hidden Power) .*/, '$1')).toUpperCase()
  const uniform = (texts: string[]): React.CSSProperties => ({ fontSize: `calc(var(--u) * ${Math.min(7, ...texts.map((t) => fit(t.length, 104, 7, 4.5))).toFixed(2)})` })

  return (
    <div className="gba" onClick={msg ? tap : undefined}>
      <div className="ds">
        {/* Écran du haut : la scène de combat */}
        <div className="screen top">
          <div className="bfield">
            <div className="sky" /><div className="grass" />
            <div className="plat foe-plat" /><div className="plat own-plat" />
            <Sprite mon={view.opponent.active} />
            <Sprite mon={view.player.active} back />
            <HpBox key={`foe${view.opponent.active?.idx}`} mon={view.opponent.active} />
            <HpBox key={`own${view.player.active?.idx}`} mon={view.player.active} own />
          </div>
        </div>
        <div className="hinge" />
        {/* Écran du bas (tactile) : texte + menus */}
        <div className="screen bot">
          <div className="textbox">
            <span>{prompt}</span>
            {msg && !typing && <i className="more">▼</i>}
          </div>
          {showMenu && !choosingTeam && menu === 'main' && (
            <div className="menu main">
              <button className="b-fight" onClick={() => setMenu('moves')}>COMBAT</button>
              <button className="b-bag" disabled>SAC</button>
              <button className="b-team" disabled={view.player.trapped} onClick={() => setMenu('team')}>POKéMON</button>
              <button className="b-run" onClick={onForfeit}>FUITE</button>
            </div>
          )}
          {showMenu && !choosingTeam && menu === 'moves' && (
            <div className="menu moves">
              {view.player.moves.map((m) => {
                const mname = moveName(m.name)
                return (
                  <button key={m.slot} disabled={m.disabled} style={{ ['--tc' as string]: TYPE_COLORS[m.type] ?? '#a8a878' }} onClick={() => onMove(m.slot)}>
                    <b style={uniform(view.player.moves.map((x) => moveName(x.name)))}>{mname}</b>
                    <small>{(TYPE_FR[m.type] ?? m.type).toUpperCase()} {m.pp}/{m.maxpp}</small>
                  </button>
                )
              })}
              <button className="back-btn" aria-label="Retour" onClick={() => setMenu('main')}>◀ RETOUR</button>
            </div>
          )}
          {choosingTeam && (
            <div className="menu team">
              {alive.map((m) => {
                const tname = nameOf(m.name)
                return (
                  <button key={m.idx} onClick={() => onSwitch(m.idx)}>
                    <b style={uniform(alive.map((x) => nameOf(x.name)))}>{tname}</b>
                    <small>PV {m.hp}/{m.maxhp}</small>
                  </button>
                )
              })}
              {!forced && <button className="back-btn" aria-label="Retour" onClick={() => setMenu('main')}>◀ RETOUR</button>}
            </div>
          )}
          {!showMenu && (
            <div className="menu-idle" aria-hidden>
              <button tabIndex={-1}>COMBAT</button><button tabIndex={-1}>SAC</button>
              <button tabIndex={-1}>POKéMON</button><button tabIndex={-1}>FUITE</button>
              {msg && <span className="tapnote">TOUCHE POUR CONTINUER</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
