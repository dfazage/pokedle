import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { BattleView, MonView } from './game/session'
import '@fontsource/press-start-2p'
import { TYPE_FR, mvFr, spFr } from './game/fr'
import { MonImg } from './game/officialSprites'
import { cueFor, findMon, stripMarks } from './game/battleCues'
import { isMuted, playCue, preloadCries, setMuted } from './game/audio'
import './Battle.css'

const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Grass: '#78c850', Electric: '#f8d030', Ice: '#98d8d8',
  Fighting: '#c03028', Poison: '#a040a0', Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
  Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#b8b8d0',
}

function HpBox({ mon, own }: { mon: MonView | null; own?: boolean }) {
  if (!mon) return null
  const pct = Math.max(0, (mon.hp / mon.maxhp) * 100)
  const tone = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'low'
  return (
    <div className={`hpbox ${own ? 'own' : 'foe'}`}>
      <div className="hrow"><span className="nm">{spFr(mon.name).toUpperCase()}</span><span className="lv">Nv100</span></div>
      <div className="hrow bar">
        <span className="hplabel">PV</span>
        <div className="track"><div className={`fill ${tone}`} style={{ width: `${pct}%` }} /></div>
      </div>
      {own && <div className="num">{mon.hp}/{mon.maxhp}</div>}
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
  queue: string[]
  onAdvance: () => void
  onMove: (slot: number) => void
  onSwitch: (idx: number) => void
  onForfeit: () => void
}

export default function BattleScreen({ view, queue, onAdvance, onMove, onSwitch, onForfeit }: Props) {
  const [menu, setMenu] = useState<'main' | 'moves' | 'team'>('main')
  const [typed, setTyped] = useState(0)
  const msg = stripMarks(queue[0] ?? '')
  const timer = useRef<number | undefined>(undefined)
  const [muted, setMutedState] = useState(isMuted)
  const lastQueue = useRef<string[] | null>(null)

  // Cris des deux équipes préchargés dès l'ouverture du combat.
  const nums = [...view.player.team, ...view.opponent.team].map((m) => m.num).join(',')
  useEffect(() => preloadCries(nums.split(',').map(Number)), [nums])

  // Un son par message affiché (cri à l'entrée en jeu, coup, K.O., jingle de fin…).
  useEffect(() => {
    if (lastQueue.current === queue) return
    lastQueue.current = queue
    const cue = queue[0] ? cueFor(queue[0]) : null
    if (cue) playCue(cue, (side, name) => findMon((side === 'player' ? view.player : view.opponent).team, name, spFr)?.num)
  }, [queue, view])

  useEffect(() => {
    setTyped(0)
    window.clearInterval(timer.current)
    if (!msg) return
    timer.current = window.setInterval(() => setTyped((t) => t + 1), 22)
    return () => window.clearInterval(timer.current)
  }, [msg])
  useEffect(() => {
    if (typed >= msg.length) window.clearInterval(timer.current)
  }, [typed, msg])
  useEffect(() => setMenu('main'), [view.turn, view.request])

  const typing = !!msg && typed < msg.length
  const tap = () => {
    if (!msg) return
    if (typing) setTyped(msg.length)
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

  const locked = !!msg || view.ended
  const teamAll = view.player.team

  return (
    <div className="nds" onClick={msg ? tap : undefined}>
      {/* Écran du haut : terrain, boîtes de PV et texte */}
      <div className="nds-screen">
        <div className="bfield">
          <div className="sky" /><div className="grass" />
          <div className="plat foe-plat" /><div className="plat own-plat" />
          <Sprite mon={view.opponent.active} />
          <Sprite mon={view.player.active} back />
          <HpBox mon={view.opponent.active} />
          <HpBox mon={view.player.active} own />
          <button
            className="mutebtn"
            aria-label={muted ? 'Activer le son' : 'Couper le son'}
            onClick={(e) => {
              e.stopPropagation()
              setMuted(!muted)
              setMutedState(!muted)
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </button>
        </div>
        <div className="textbox">
          <span>{prompt}</span>
          {msg && !typing && <i className="more">▼</i>}
        </div>
      </div>

      {/* Écran du bas (tactile) : menus */}
      <div className={`nds-screen touch${locked ? ' locked' : ''}`}>
        <div className="balls" aria-hidden>
          {teamAll.map((m) => <span key={m.idx} className={`ball${m.fainted ? ' ko' : ''}`} />)}
        </div>
        {!choosingTeam && menu === 'main' && (
          <div className="tmenu main">
            <button className="tbtn fight" disabled={!showMenu} onClick={() => setMenu('moves')}>COMBAT</button>
            <button className="tbtn bag" disabled>SAC</button>
            <button className="tbtn run" disabled={!showMenu} onClick={onForfeit}>FUITE</button>
            <button className="tbtn mons" disabled={!showMenu || view.player.trapped} onClick={() => setMenu('team')}>POKéMON</button>
          </div>
        )}
        {!choosingTeam && menu === 'moves' && (
          <div className="tmenu moves">
            {view.player.moves.map((m) => (
              <button key={m.slot} className="tbtn move" style={{ ['--tc' as string]: TYPE_COLORS[m.type] ?? '#888' }} disabled={m.disabled || !showMenu} onClick={() => onMove(m.slot)}>
                <b>{mvFr(m.name.replace(/^(Hidden Power) .*/, '$1')).toUpperCase()}</b>
                <span className="mrow"><span className="tchip">{(TYPE_FR[m.type] ?? m.type).toUpperCase()}</span><span>PP {m.pp}/{m.maxpp}</span></span>
              </button>
            ))}
            <button className="tbtn cancel" onClick={() => setMenu('main')}>ANNULER</button>
          </div>
        )}
        {choosingTeam && (
          <>
            <div className={`tmenu team${!forced ? ' has-cancel' : ''}`}>
              {alive.map((m) => (
                <button key={m.idx} className="tbtn mon" onClick={() => onSwitch(m.idx)}>
                  <b>{spFr(m.name).toUpperCase()}</b>
                  <small>PV {m.hp}/{m.maxhp}</small>
                </button>
              ))}
            </div>
            {!forced && <button className="tbtn cancel tcancel" onClick={() => setMenu('main')}>ANNULER</button>}
          </>
        )}
      </div>
    </div>
  )
}
