import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Crown, Flame, Globe, Repeat, Shield, Swords, Timer, Users, Zap } from 'lucide-react'
import type { Ctx } from './types'
import { GEN_INFO } from '../game/fr'

type Item = { icon: ReactNode; title: string; text: string }
interface Slide {
  eyebrow: string
  title: string
  lead: string
  /** Couleurs de l'orbe / de l'anneau, puis des trois halos d'arrière-plan. */
  c: [string, string]
  halos: [string, string, string]
  items: Item[]
  foot?: string
}

const S = 18
const SLIDES: Slide[] = [
  {
    eyebrow: 'Le principe',
    title: 'Un combat par jour, le même pour tous',
    lead: 'Comme un Wordle, mais en duel Pokémon. Un dresseur à battre, une équipe confiée pour la journée.',
    c: ['#5ba8f0', '#8b6cd9'],
    halos: ['#5ba8f0', '#8b6cd9', '#4ec9a0'],
    items: [
      { icon: <Swords size={S} />, title: 'Ton objectif', text: 'Battre le dresseur du jour, avec style, et enchaîner les jours.' },
      { icon: <Timer size={S} />, title: 'Une seule tentative', text: 'Fuir compte comme une défaite. Pas de seconde chance.' },
      { icon: <Repeat size={S} />, title: 'Un nouveau défi chaque jour', text: 'Nouveau dresseur, nouvelle équipe. Ta série continue tant que tu gagnes.' },
    ],
  },
  {
    eyebrow: 'Le tirage',
    title: 'D’où vient le défi du jour ?',
    lead: 'Il est tiré à la date du jour : tous les dresseurs affrontent exactement le même.',
    c: ['#4ec9a0', '#5ba8f0'],
    halos: ['#4ec9a0', '#5ba8f0', '#f7c948'],
    items: [
      { icon: <Globe size={S} />, title: 'Une ligue au hasard', text: 'Chaque jour, un des quatre jeux ci-dessous donne le ton.' },
      { icon: <Crown size={S} />, title: 'Un vrai dresseur de la saga', text: 'Champions d’arène, Conseil des 4, Maîtres, et des visages moins attendus.' },
      { icon: <Users size={S} />, title: 'Une équipe pour toi', text: 'Confiée pour la journée, pensée pour que le duel reste indécis.' },
    ],
  },
  {
    eyebrow: 'Les points',
    title: 'Score et classement',
    lead: 'Gagner rapporte des points, bien gagner en rapporte davantage. Une défaite n’en donne pas.',
    c: ['#f7c948', '#f0716b'],
    halos: ['#f7c948', '#f0716b', '#8b6cd9'],
    items: [
      { icon: <Zap size={S} />, title: 'Du style', text: 'Un duel plié vite, avec une équipe en forme, vaut plus qu’une victoire de justesse.' },
      { icon: <Shield size={S} />, title: 'Un adversaire à la hauteur', text: 'Plus le dresseur est redoutable, plus la victoire compte.' },
      { icon: <Flame size={S} />, title: 'De la régularité', text: 'Enchaîner les victoires d’un jour à l’autre fait grimper ton score.' },
    ],
    foot: 'Tes points s’additionnent et te placent au classement : celui du jour, celui des séries et le général.',
  },
]
const GEN_COLORS: Record<number, string> = { 1: '#f0716b', 2: '#f7c948', 3: '#4ec9a0', 4: '#8fa8f0' }

export function Guide(c: Ctx & { onBack: () => void }) {
  const [i, setI] = useState(0)
  const x0 = useRef<number | null>(null)
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)))
  const last = i === SLIDES.length - 1
  const h = SLIDES[i].halos
  return (
    <div className="guide">
      <div className="guide-bg" aria-hidden>
        {h.map((col, k) => <i key={k} style={{ background: col, transform: `translate(${(i - 1) * (k % 2 ? -24 : 24)}px, ${(i - 1) * 14}px)` }} />)}
      </div>
      <div className="guide-in">
        <div className="topbar">
          <button className="iconbtn glass" onClick={c.onBack} aria-label="Retour"><ArrowLeft size={20} /></button>
          <div className="t">Guide du jeu</div>
          <span className="pill glass">{i + 1} / {SLIDES.length}</span>
        </div>

        <div
          className="g-viewport"
          onPointerDown={(e) => { x0.current = e.clientX }}
          onPointerUp={(e) => {
            if (x0.current === null) return
            const d = e.clientX - x0.current
            if (Math.abs(d) > 40) go(i + (d < 0 ? 1 : -1))
            x0.current = null
          }}
        >
          <div className="g-track" style={{ transform: `translateX(${-100 * i}%)` }}>
            {SLIDES.map((s, n) => (
              <section key={n} className="g-slide" aria-hidden={n !== i} style={{ ['--c1' as string]: s.c[0], ['--c2' as string]: s.c[1] }}>
                <div className="g-card glass">
                  <div className="g-head">
                    <div className="eyebrow" style={{ color: s.c[0] }}>{s.eyebrow}</div>
                    <h1>{s.title}</h1>
                    <p className="g-lead">{s.lead}</p>
                  </div>
                  <div className="g-list">
                    {s.items.map((it) => (
                      <div key={it.title} className="g-row">
                        <div className="orb" style={{ width: 44, height: 44 }}>{it.icon}</div>
                        <div><b>{it.title}</b><span>{it.text}</span></div>
                      </div>
                    ))}
                  </div>
                  {n === 1 && (
                    <div className="g-gens">
                      {[1, 2, 3, 4].map((g) => (
                        <div key={g} className="g-gen" style={{ ['--g' as string]: GEN_COLORS[g] }}>
                          <i />
                          <div>
                            <b>{GEN_INFO[g].game}</b>
                            <small>Gen {GEN_INFO[g].roman} · {GEN_INFO[g].region}</small>
                          </div>
                          {c.challenge.gen === g && <em>Aujourd’hui</em>}
                        </div>
                      ))}
                    </div>
                  )}
                  {s.foot && <p className="g-foot">{s.foot}</p>}
                  <div className="g-num">{String(n + 1).padStart(2, '0')}</div>
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="dots" role="tablist">
          {SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}
        </div>
        <div className="g-nav">
          <button className="g-btn glass" onClick={() => go(i - 1)} disabled={i === 0}>Précédent</button>
          <button className="g-btn main" onClick={() => (last ? c.onBack() : go(i + 1))}>{last ? 'Terminé' : 'Suivant'}</button>
        </div>
      </div>
    </div>
  )
}
