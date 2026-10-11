import { useEffect, useMemo, useRef, useState } from 'react'
import type { BattleView, MonView } from './game/session'
import '@fontsource/press-start-2p'
import { TYPE_FR, mvFr, spFr } from './game/fr'
import { spriteUrl } from './game/sprites'
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
  const url = useMemo(() => (mon ? spriteUrl(mon, back) : ''), [mon?.num, mon?.types.join('/'), back]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!mon || mon.fainted) return null
  // Sprite 100 % original généré par code (voir game/sprites.ts) : aucun asset officiel.
  return <img className={`sprite ${back ? 'back' : 'front'}`} src={url} alt={spFr(mon.name)} draggable={false} />
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
  const msg = queue[0] ?? ''
  const timer = useRef<number | undefined>(undefined)

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

  return (
    <div className="gba" onClick={msg ? tap : undefined}>
      <div className="gba-in">
        <div className="bfield">
          <div className="sky" /><div className="grass" />
          <div className="plat foe-plat" /><div className="plat own-plat" />
          <Sprite mon={view.opponent.active} />
          <Sprite mon={view.player.active} back />
          <HpBox mon={view.opponent.active} />
          <HpBox mon={view.player.active} own />
        </div>
        <div className="bottom">
          {!(showMenu && (menu === 'moves' || choosingTeam)) && (
            <div className="textbox">
              <span>{prompt}</span>
              {msg && !typing && <i className="more">▼</i>}
            </div>
          )}
          {showMenu && !choosingTeam && menu === 'main' && (
            <div className="menu grid">
              <button onClick={() => setMenu('moves')}>COMBAT</button>
              <button disabled>SAC</button>
              <button disabled={view.player.trapped} onClick={() => setMenu('team')}>POKéMON</button>
              <button onClick={onForfeit}>FUITE</button>
            </div>
          )}
          {showMenu && !choosingTeam && menu === 'moves' && (
            <div className="menu list">
              {view.player.moves.map((m) => (
                <button key={m.slot} disabled={m.disabled} onClick={() => onMove(m.slot)}>
                  <b>{mvFr(m.name.replace(/^(Hidden Power) .*/, '$1')).toUpperCase()}</b>
                  <small style={{ color: TYPE_COLORS[m.type] }}>{(TYPE_FR[m.type] ?? m.type).toUpperCase()} {m.pp}/{m.maxpp}</small>
                </button>
              ))}
              <button className="back-btn" aria-label="Retour" onClick={() => setMenu('main')}>✕</button>
            </div>
          )}
          {choosingTeam && (
            <div className="menu list">
              {alive.map((m) => (
                <button key={m.idx} onClick={() => onSwitch(m.idx)}>
                  <b>{spFr(m.name).toUpperCase()}</b>
                  <small>{m.hp}/{m.maxhp}</small>
                </button>
              ))}
              {!forced && <button className="back-btn" aria-label="Retour" onClick={() => setMenu('main')}>✕</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
