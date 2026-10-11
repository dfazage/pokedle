import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import type { BattleView, FxKind, MonView, Step } from './game/session'
import '@fontsource/press-start-2p'
import { TYPE_FR, mvFr, spFr } from './game/fr'
import { MonImg } from './game/officialSprites'
import { matchups } from './game/typechart'
import { TypeIcon } from './ui/kit'
import { cueFor, findMon, type Side } from './game/battleCues'
import { isMuted, playCue, preloadCries, setMuted } from './game/audio'
import './Battle.css'

const TYPE_COLORS: Record<string, string> = {
  Normal: '#a8a878', Fire: '#f08030', Water: '#6890f0', Grass: '#78c850', Electric: '#f8d030', Ice: '#98d8d8',
  Fighting: '#c03028', Poison: '#a040a0', Ground: '#e0c068', Flying: '#a890f0', Psychic: '#f85888', Bug: '#a8b820',
  Rock: '#b8a038', Ghost: '#705898', Dragon: '#7038f8', Dark: '#705848', Steel: '#b8b8d0',
}

/** Valeur qui glisse vers `target` en `ms` millisecondes (barre de PV façon DS). Saute directement si `key` change. */
function useTween(target: number, ms: number, key: string | number) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  const lastKey = useRef(key)
  useLayoutEffect(() => {
    if (lastKey.current !== key || ms <= 0) {
      lastKey.current = key
      from.current = target
      setV(target)
      return
    }
    const a = from.current
    const t0 = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      from.current = a + (target - a) * k
      setV(from.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms, key])
  return v
}

/** Badge de statut façon DS : abréviation FR + couleur propre à chaque statut. */
const STATUS_BADGE: Record<string, { label: string; title: string }> = {
  slp: { label: 'SOM', title: 'Endormi' },
  brn: { label: 'BRU', title: 'Brûlé' },
  par: { label: 'PAR', title: 'Paralysé' },
  psn: { label: 'PSN', title: 'Empoisonné' },
  tox: { label: 'PSN', title: 'Gravement empoisonné' },
  frz: { label: 'GEL', title: 'Gelé' },
}
const VOL_BADGE: Record<string, { label: string; title: string }> = {
  confusion: { label: 'CNF', title: 'Confus' },
  leechseed: { label: 'VAM', title: 'Vampigraine' },
  attract: { label: 'AMO', title: 'Amoureux' },
  taunt: { label: 'PRV', title: 'Provoqué' },
  encore: { label: 'ENC', title: 'Encore' },
  yawn: { label: 'SOM?', title: 'Somnolent' },
}
export function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status]
  if (!b) return null
  return <span className={`st st-${status}`} title={b.title}>{b.label}</span>
}

/** Abréviations (ASCII : la police pixel n'a pas tous les accents) des stats modifiables, dans l'ordre d'affichage. */
const STAT_SHORT: [string, string, string][] = [
  ['atk', 'ATQ', 'Attaque'], ['def', 'DEF', 'Défense'], ['spa', 'A.SP', 'Attaque Spéciale'], ['spd', 'D.SP', 'Défense Spéciale'],
  ['spe', 'VIT', 'Vitesse'], ['accuracy', 'PRE', 'Précision'], ['evasion', 'ESQ', 'Esquive'],
]
const MULT_LABEL = (m: number) => (m === 0 ? '0' : m >= 1 ? `×${m}` : m === 0.5 ? '½' : '¼')

/** Au-dessus des PV : modificateurs de stats en cours, puis faiblesses (×2/×4) et résistances/immunités (×½, ×¼, 0) selon les types. */
function InfoPanel({ mon }: { mon: MonView }) {
  const boosts = STAT_SHORT.filter(([k]) => mon.boosts?.[k])
  const { weak, resist } = matchups(mon.types)
  const row = (list: { type: string; mult: number }[], kind: 'weak' | 'resist') =>
    list.length > 0 && (
      <div className={`mxrow ${kind}`} title={kind === 'weak' ? 'Faiblesses' : 'Résistances et immunités'}>
        <i className="mk" aria-hidden />
        {list.map((a) => (
          <span key={a.type} className={`mx m${String(a.mult).replace('.', '_')}`} style={{ ['--tc' as string]: TYPE_COLORS[a.type] }} title={`${TYPE_FR[a.type] ?? a.type} ${MULT_LABEL(a.mult)}`}>
            <span className="ti"><TypeIcon type={a.type} size={10} /></span><b>{MULT_LABEL(a.mult)}</b>
          </span>
        ))}
      </div>
    )
  return (
    <div className="mxpanel">
      {boosts.length > 0 && (
        <div className="bsrow">
          {boosts.map(([k, short, full]) => {
            const v = mon.boosts[k]
            return <span key={k} className={`bs ${v > 0 ? 'up' : 'down'}`} title={`${full} ${v > 0 ? '+' : ''}${v}`}>{short} {v > 0 ? '+' : ''}{v}</span>
          })}
        </div>
      )}
      {row(weak, 'weak')}
      {row(resist, 'resist')}
    </div>
  )
}

function HpBox({ mon, ms, own }: { mon: MonView | null; ms: number; own?: boolean }) {
  const shown = useTween(mon?.hp ?? 0, ms, mon ? `${mon.idx}:${mon.maxhp}` : '')
  if (!mon || mon.fainted) return null
  const pct = Math.max(0, (shown / mon.maxhp) * 100)
  const tone = pct > 50 ? 'ok' : pct > 20 ? 'warn' : 'low'
  return (
    <div className={`hpcol ${own ? 'own' : 'foe'}`}>
      <InfoPanel mon={mon} />
      <div className="hpbox">
        <div className="hrow"><span className="nm">{spFr(mon.name).toUpperCase()}</span><span className="lv">Nv100</span></div>
        {(mon.status || mon.vol.length > 0) && (
          <div className="hrow strow">
            {mon.status && <StatusBadge status={mon.status} />}
            {mon.vol.map((v) => VOL_BADGE[v] && <span key={v} className={`st st-v st-${v}`} title={VOL_BADGE[v].title}>{VOL_BADGE[v].label}</span>)}
          </div>
        )}
        <div className="hrow bar">
          <span className="hplabel">PV</span>
          <div className="track"><div className={`fill ${tone}`} style={{ width: `${pct}%` }} /></div>
        </div>
        {own && <div className="num">{Math.ceil(shown)}/{mon.maxhp}</div>}
      </div>
    </div>
  )
}

/** Part (0-1) de l'image transparente sous le Pokémon : sert à poser les pieds toujours au même endroit, quelle que soit l'image. */
const padCache = new Map<string, number>()
function bottomPad(img: HTMLImageElement): number {
  const hit = padCache.get(img.src)
  if (hit !== undefined) return hit
  let pad = 0
  try {
    const w = img.naturalWidth, h = img.naturalHeight
    if (w && h) {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const g = c.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0)
      const px = g.getImageData(0, 0, w, h).data
      let last = h - 1
      scan: for (; last >= 0; last--) for (let x = 0; x < w; x++) if (px[(last * w + x) * 4 + 3] > 24) break scan
      pad = Math.max(0, (h - 1 - last) / h)
    }
  } catch {
    /* image « tainted » (CORS) : on garde l'alignement par défaut */
  }
  padCache.set(img.src, pad)
  return pad
}

// Le conteneur .spw porte les animations (Web Animations API, rejouables à volonté) ; l'image garde son léger balancement.
const Sprite = ({ mon, back, wrap }: { mon: MonView | null; back?: boolean; wrap: React.Ref<HTMLDivElement> }) => {
  const [pad, setPad] = useState(0)
  if (!mon) return null
  // Sprite de la génération en cours (public/sprites), repli sur le sprite généré par code (game/sprites.ts).
  return (
    <div ref={wrap} className={`spw ${back ? 'back' : 'front'}${mon.status ? ` is-${mon.status}` : ''}${mon.vol.includes('confusion') ? ' is-cnf' : ''}`} style={{ ['--pad' as string]: pad, ...(mon.fainted ? { visibility: 'hidden' } : null) }}>
      <MonImg spec={mon} back={back} className="sprite" alt={spFr(mon.name)} draggable={false} onLoad={(e) => setPad(bottomPad(e.currentTarget))} />
    </div>
  )
}

/** Catégorie de l'attaque (icônes façon DS : physique = éclat orange, spéciale = ondes bleues, statut = ovale gris). */
const CAT_INFO: Record<string, string> = { Physical: 'Physique', Special: 'Spéciale', Status: 'Statut' }
function CatIcon({ cat }: { cat: string }) {
  const title = CAT_INFO[cat] ?? cat
  return (
    <svg className={`cat cat-${cat}`} viewBox="0 0 20 12" role="img" aria-label={title}>
      <title>{title}</title>
      <rect x=".6" y=".6" width="18.8" height="10.8" rx="3" className="cb" />
      {cat === 'Physical' && <path className="cg" d="M10 1.8l1.4 2.7 3-.9-1 2.9 2.5 1.8-3 .4-.6 2.6L10 8.8 7.7 11.3l-.6-2.6-3-.4 2.5-1.8-1-2.9 3 .9z" transform="translate(0 -.8)" />}
      {cat === 'Special' && <g className="cg2"><circle cx="10" cy="6" r="1.6" /><circle cx="10" cy="6" r="3.4" /><circle cx="10" cy="6" r="5.2" /></g>}
      {cat === 'Status' && <g className="cg2"><ellipse cx="10" cy="6" rx="5.6" ry="3" /><path d="M6.5 8.6L13.5 3.4" /></g>}
    </svg>
  )
}

interface Disp {
  player: MonView | null
  opponent: MonView | null
  ms: Record<Side, number> // durée de la descente de barre en cours
}

/** Effets avant/après l'étape sur ce qui est affiché. `pre` à l'arrivée de l'étape, `post` quand elle se termine. */
function applyPre(d: Disp, st: Step, team: (side: Side, name: string) => MonView | undefined): Disp {
  const n: Disp = { ...d, ms: { ...d.ms } }
  if (st.enter) {
    const base = team(st.enter.side, st.enter.name)
    if (base) n[st.enter.side] = { ...base, hp: st.enter.hp, maxhp: st.enter.maxhp, status: st.enter.status, vol: [], boosts: {}, fainted: false, active: true }
    n.ms[st.enter.side] = 0
  }
  if (st.hp) {
    const m = n[st.hp.side]
    if (m) n[st.hp.side] = { ...m, hp: st.hp.hp, maxhp: st.hp.maxhp }
    n.ms[st.hp.side] = st.hp.ms
  }
  if (st.status) {
    const m = n[st.status.side]
    if (m) n[st.status.side] = { ...m, status: st.status.status }
  }
  if (st.boost) {
    const m = n[st.boost.side]
    if (m) n[st.boost.side] = { ...m, boosts: st.boost.boosts }
  }
  if (st.vol) {
    const m = n[st.vol.side]
    if (m) {
      const rest = (m.vol ?? []).filter((v) => v !== st.vol!.id)
      n[st.vol.side] = { ...m, vol: st.vol.on ? [...rest, st.vol.id] : rest }
    }
  }
  return n
}
function applyPost(d: Disp, st: Step): Disp {
  const n: Disp = { ...d }
  if (st.leave) n[st.leave] = null
  if (st.faint && n[st.faint]) n[st.faint] = { ...n[st.faint]!, fainted: true }
  return n
}

/** Joue l'animation d'un sprite. `u` = 1 pixel logique de l'écran DS (256 px de large). */
function playFx(el: HTMLElement | null, side: Side, kind: FxKind, u: number) {
  if (!el || !el.animate) return
  const dir = side === 'player' ? 1 : -1 // le joueur est en bas à gauche, l'adversaire en haut à droite
  const t = (x: number, y: number, extra = '') => `translate(${x * u}px, ${y * u}px) ${extra}`
  switch (kind) {
    case 'enter':
      el.getAnimations().forEach((a) => a.cancel())
      el.animate(
        [
          { transform: 'scale(.15)', opacity: 0, filter: 'brightness(4)' },
          { transform: 'scale(1.12)', opacity: 1, filter: 'brightness(2)', offset: 0.6 },
          { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' },
        ],
        { duration: 520, easing: 'ease-out' },
      )
      break
    case 'attack':
      el.animate(
        [{ transform: t(0, 0) }, { transform: t(16 * dir, -7 * dir), offset: 0.35 }, { transform: t(16 * dir, -7 * dir), offset: 0.5 }, { transform: t(0, 0) }],
        { duration: 380, easing: 'ease-in-out' },
      )
      break
    case 'buff':
      el.animate([{ transform: t(0, 0) }, { transform: t(0, -6), offset: 0.25 }, { transform: t(0, 0), offset: 0.5 }, { transform: t(0, -6), offset: 0.75 }, { transform: t(0, 0) }], { duration: 420 })
      break
    case 'hit':
      // Clignotement du Pokémon touché + petit recul.
      el.animate(
        [
          { opacity: 1, transform: t(0, 0) },
          { opacity: 0, transform: t(3 * -dir, 0), offset: 0.14 },
          { opacity: 1, offset: 0.28 },
          { opacity: 0, transform: t(3 * -dir, 0), offset: 0.42 },
          { opacity: 1, offset: 0.56 },
          { opacity: 0, offset: 0.7 },
          { opacity: 1, transform: t(0, 0) },
        ],
        { duration: 560, easing: 'steps(1, end)' },
      )
      break
    case 'recall':
      el.animate(
        [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(.15)', opacity: 0, filter: 'brightness(4)' }],
        { duration: 380, easing: 'ease-in', fill: 'forwards' },
      )
      break
    case 'faint':
      el.animate([{ transform: t(0, 0), opacity: 1 }, { transform: t(0, 14), opacity: 0 }], { duration: 650, easing: 'ease-in', fill: 'forwards' })
      break
  }
}

interface Props {
  view: BattleView
  queue: Step[]
  onAdvance: () => void
  onMove: (slot: number) => void
  onSwitch: (idx: number) => void
  onForfeit: () => void
}

export default function BattleScreen({ view, queue, onAdvance, onMove, onSwitch, onForfeit }: Props) {
  const [menu, setMenu] = useState<'main' | 'moves' | 'team'>('main')
  const [typed, setTyped] = useState(0)
  const [shownMsg, setShownMsg] = useState('') // dernier message affiché (reste à l'écran pendant les étapes sans texte)
  const [textId, setTextId] = useState(0)
  const [disp, setDisp] = useState<Disp | null>(null) // ce qui est réellement affiché pendant une séquence ; null = l'état de `view`
  const timer = useRef<number | undefined>(undefined)
  const [muted, setMutedState] = useState(isMuted)
  const step: Step | undefined = queue[0]
  const busy = queue.length > 0
  const lastStep = useRef<Step | null>(null)
  const dispRef = useRef<Disp | null>(null)
  const fxRef = useRef<Step['fx']>(undefined)
  const sprites = useRef<Record<Side, HTMLDivElement | null>>({ player: null, opponent: null })
  const fieldRef = useRef<HTMLDivElement>(null)
  const advanceRef = useRef(onAdvance)
  advanceRef.current = onAdvance

  // Cris des deux équipes préchargés dès l'ouverture du combat.
  const nums = [...view.player.team, ...view.opponent.team].map((m) => m.num).join(',')
  useEffect(() => preloadCries(nums.split(',').map(Number)), [nums])

  const monOf = (side: Side, name: string) => findMon(view[side === 'player' ? 'player' : 'opponent'].team, name, (n) => n)

  // Arrivée d'une étape : on applique d'abord la fin de la précédente (rappel, K.O.), puis les changements de celle-ci.
  useLayoutEffect(() => {
    if (!step) {
      if (dispRef.current) {
        dispRef.current = null
        setDisp(null)
      }
      setShownMsg('')
      lastStep.current = null
      return
    }
    if (lastStep.current === step) return
    const prev = lastStep.current
    lastStep.current = step
    let d: Disp = dispRef.current ?? { player: view.player.active, opponent: view.opponent.active, ms: { player: 0, opponent: 0 } }
    if (prev) d = applyPost(d, prev)
    d = applyPre(d, step, monOf)
    dispRef.current = d
    fxRef.current = step.fx
    setDisp(d)
    if (step.text !== undefined) {
      setShownMsg(step.text)
      setTyped(0)
      setTextId((n) => n + 1)
    }
    // Son : celui de l'étape, sinon celui du message.
    const cue = step.cue !== undefined ? step.cue : step.text ? cueFor(step.text) : null
    if (cue) playCue(cue, (side, name) => findMon((side === 'player' ? view.player : view.opponent).team, name, spFr)?.num)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // Animation du sprite : une fois l'affichage mis à jour (le sprite entrant n'existe qu'après le rendu).
  useLayoutEffect(() => {
    const fx = fxRef.current
    fxRef.current = undefined
    if (!fx) return
    const u = (fieldRef.current?.clientWidth ?? 256) / 256
    playFx(sprites.current[fx.side], fx.side, fx.kind, u)
  }, [disp])

  useEffect(() => {
    window.clearInterval(timer.current)
    if (!shownMsg) return
    timer.current = window.setInterval(() => setTyped((t) => t + 1), 22)
    return () => window.clearInterval(timer.current)
  }, [textId, shownMsg])
  useEffect(() => {
    if (typed >= shownMsg.length) window.clearInterval(timer.current)
  }, [typed, shownMsg])
  useEffect(() => setMenu('main'), [view.turn, view.request])

  const typing = !!shownMsg && typed < shownMsg.length

  // Enchaînement automatique : fin du texte, puis la pause prévue par l'étape (animation, descente de barre…).
  useEffect(() => {
    if (!step || typing) return
    const id = window.setTimeout(() => advanceRef.current(), step.wait)
    return () => window.clearTimeout(id)
  }, [step, typing])

  // Toucher l'écran : finit d'écrire le texte, ou passe directement à la suite.
  const tap = () => {
    if (typing) setTyped(shownMsg.length)
    else onAdvance()
  }

  const msg = busy ? shownMsg : ''
  const showMenu = !busy && !view.ended
  const forced = view.request === 'switch'
  const choosingTeam = showMenu && (menu === 'team' || forced)
  const alive = view.player.team.filter((m) => !m.fainted && !m.active)

  let prompt = msg.slice(0, typed)
  if (!busy && !view.ended) {
    prompt = forced ? 'Envoyer quel POKéMON ?' : `Que doit faire ${spFr(view.player.active?.name ?? '').toUpperCase()} ?`
  }
  if (!busy && view.ended) prompt = view.result === 'win' ? 'Tu as gagné le combat !' : 'Tu as perdu le combat…'

  const locked = busy || view.ended
  const teamAll = view.player.team
  const shown: Disp = disp ?? { player: view.player.active, opponent: view.opponent.active, ms: { player: 0, opponent: 0 } }

  return (
    <div className="nds" onClick={busy ? tap : undefined}>
      {/* Écran du haut : terrain, boîtes de PV et texte */}
      <div className="nds-screen">
        <div className="bfield" ref={fieldRef}>
          <div className="sky" /><div className="grass" />
          <div className="plat foe-plat" /><div className="plat own-plat" />
          <Sprite mon={shown.opponent} wrap={(el) => { sprites.current.opponent = el }} />
          <Sprite mon={shown.player} back wrap={(el) => { sprites.current.player = el }} />
          <HpBox mon={shown.opponent} ms={shown.ms.opponent} />
          <HpBox mon={shown.player} ms={shown.ms.player} own />
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
                <span className="mrow">
                  <span className="tchip"><span className="ti"><TypeIcon type={m.type} size={10} /></span>{(TYPE_FR[m.type] ?? m.type).toUpperCase()}</span>
                  <CatIcon cat={m.category} />
                </span>
                <span className="mrow"><span>{m.power > 0 ? `PUI ${m.power}` : 'PUI --'}</span><span>PP {m.pp}/{m.maxpp}</span></span>
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
                  {m.status && <StatusBadge status={m.status} />}
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
