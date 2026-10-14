import { useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Crown, Flame, Globe, Repeat, Shield, Swords, Timer, Users, Zap } from 'lucide-react'
import type { Ctx } from './types'
import { GEN_INFO } from '../game/fr'
import { t, useLang } from '../i18n'

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
const ICONS: ReactNode[][] = [
  [<Swords size={S} />, <Timer size={S} />, <Repeat size={S} />],
  [<Globe size={S} />, <Crown size={S} />, <Users size={S} />],
  [<Zap size={S} />, <Shield size={S} />, <Flame size={S} />],
]
const COLORS: Pick<Slide, 'c' | 'halos'>[] = [
  { c: ['#5ba8f0', '#8b6cd9'], halos: ['#5ba8f0', '#8b6cd9', '#4ec9a0'] },
  { c: ['#4ec9a0', '#5ba8f0'], halos: ['#4ec9a0', '#5ba8f0', '#f7c948'] },
  { c: ['#f7c948', '#f0716b'], halos: ['#f7c948', '#f0716b', '#8b6cd9'] },
]
/** Les diapositives sont construites au rendu : les textes suivent la langue courante. */
function slides(): Slide[] {
  return COLORS.map((col, k) => {
    const n = (k + 1) as 1 | 2 | 3
    return {
      eyebrow: t(`guide.${n}.eyebrow` as const),
      title: t(`guide.${n}.title` as const),
      lead: t(`guide.${n}.lead` as const),
      ...col,
      items: ([1, 2, 3] as const).map((j) => ({
        icon: ICONS[k][j - 1],
        title: t(`guide.${n}.i${j}.t` as const),
        text: t(`guide.${n}.i${j}.x` as const),
      })),
      foot: n === 3 ? t('guide.3.foot') : undefined,
    }
  })
}
const GEN_COLORS: Record<number, string> = { 1: '#f0716b', 2: '#f7c948', 3: '#4ec9a0', 4: '#8fa8f0', 5: '#b58cf0' }

export function Guide(c: Ctx & { onBack: () => void }) {
  useLang()
  const SLIDES = slides()
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
          <button className="iconbtn glass" onClick={c.onBack} aria-label={t('back')}><ArrowLeft size={20} /></button>
          <div className="t">{t('guide.title')}</div>
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
                      {[1, 2, 3, 4, 5].map((g) => (
                        <div key={g} className="g-gen" style={{ ['--g' as string]: GEN_COLORS[g] }}>
                          <i />
                          <div>
                            <b>{GEN_INFO[g].game}</b>
                            <small>{t('guide.gen', { roman: GEN_INFO[g].roman, region: GEN_INFO[g].region })}</small>
                          </div>
                          {c.challenge.gen === g && <em>{t('guide.today')}</em>}
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
          <button className="g-btn glass" onClick={() => go(i - 1)} disabled={i === 0}>{t('guide.prev')}</button>
          <button className="g-btn main" onClick={() => (last ? c.onBack() : go(i + 1))}>{last ? t('guide.done') : t('guide.next')}</button>
        </div>
      </div>
    </div>
  )
}
