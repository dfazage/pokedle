import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft, BarChart3, Bug, CalendarDays, Circle, Droplet, Flame, Gem, Ghost, House, Leaf, Moon, Mountain,
  Shield, Skull, Snowflake, Sparkles, Swords, User, Wind, Zap, Brain, ChevronsRight,
} from 'lucide-react'
import { TYPE_COLORS, fmtCountdown, msToNextDay } from '../game/info'
import { TYPE_FR } from '../game/fr'

export type Screen =
  | 'onboarding' | 'home' | 'opponent' | 'team' | 'battle' | 'result'
  | 'history' | 'leaderboard' | 'settings' | 'auth' | 'generations' | 'admin'

const ICONS: Record<string, typeof Flame> = {
  Normal: Circle, Fire: Flame, Water: Droplet, Grass: Leaf, Electric: Zap, Ice: Snowflake, Fighting: Swords,
  Poison: Skull, Ground: Mountain, Flying: Wind, Psychic: Brain, Bug, Rock: Gem, Ghost, Dragon: Sparkles,
  Dark: Moon, Steel: Shield,
}

export function TypeIcon({ type, size = 20 }: { type: string; size?: number }) {
  const I = ICONS[type] ?? Circle
  return <I size={size} strokeWidth={2.4} aria-hidden />
}

const shade = (hex: string) => `color-mix(in srgb, ${hex} 70%, #000)`
const typeVars = (types: string[]) => {
  const c1 = TYPE_COLORS[types[0]] ?? '#888'
  const c2 = types[1] ? TYPE_COLORS[types[1]] : shade(c1)
  return { ['--c1' as string]: c1, ['--c2' as string]: c2 } as React.CSSProperties
}

export function MonOrb({ types, size = 56 }: { types: string[]; size?: number }) {
  return (
    <span className="orb" style={{ ...typeVars(types), width: size, height: size }}>
      <TypeIcon type={types[0]} size={Math.round(size * 0.46)} />
    </span>
  )
}

export function TypeBadge({ type, soft }: { type: string; soft?: boolean }) {
  return (
    <span className={soft ? 'badge soft' : 'badge'} style={typeVars([type])}>
      {TYPE_FR[type] ?? type}
    </span>
  )
}

export const monCardStyle = typeVars

export function TopBar({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="topbar">
      {onBack ? (
        <button className="iconbtn" onClick={onBack} aria-label="Retour"><ArrowLeft size={20} /></button>
      ) : (
        <span style={{ width: 40 }} />
      )}
      <div className="t">{title}</div>
      {right ?? <span style={{ width: 40 }} />}
    </div>
  )
}

export function BottomNav({ screen, go, onPlay }: { screen: Screen; go: (s: Screen) => void; onPlay: () => void }) {
  const item = (s: Screen, label: string, I: typeof House) => (
    <button className={screen === s ? 'on' : ''} onClick={() => go(s)} aria-label={label}>
      <I size={22} />
      {label}
    </button>
  )
  return (
    <nav className="nav" aria-label="Navigation">
      {item('home', 'Accueil', House)}
      {item('history', 'Historique', CalendarDays)}
      <button className="go" onClick={onPlay} aria-label="Combat du jour" />
      {item('leaderboard', 'Classement', BarChart3)}
      {item('settings', 'Profil', User)}
    </nav>
  )
}

export function SlideToConfirm({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const track = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [x, setX] = useState(0)
  const max = () => (track.current?.clientWidth ?? 320) - 64
  return (
    <div className="slide" ref={track} role="group" aria-label={label}>
      <div className="lbl" style={{ opacity: 1 - Math.min(1, x / (max() || 1)) }}>
        {label} <ChevronsRight size={16} style={{ marginLeft: 6 }} />
      </div>
      <button
        className="knob"
        style={{ transform: `translateX(${x}px)`, transition: start.current === null ? 'transform .25s' : 'none' }}
        aria-label={label}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onConfirm()}
        onPointerDown={(e) => {
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          start.current = e.clientX - x
        }}
        onPointerMove={(e) => {
          if (start.current !== null) setX(Math.max(0, Math.min(max(), e.clientX - start.current)))
        }}
        onPointerUp={() => {
          const ok = x > max() * 0.85
          start.current = null
          if (ok) {
            setX(max())
            onConfirm()
          } else setX(0)
        }}
      />
    </div>
  )
}

export function useCountdown() {
  const [s, setS] = useState(() => fmtCountdown(msToNextDay()))
  useEffect(() => {
    const t = setInterval(() => setS(fmtCountdown(msToNextDay())), 1000)
    return () => clearInterval(t)
  }, [])
  return s
}

export function useLocalState<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T) ?? initial
    } catch {
      return initial
    }
  })
  const set = (n: T) => {
    setV(n)
    try {
      localStorage.setItem(key, n)
    } catch {
      /* stockage indisponible */
    }
  }
  return [v, set]
}
