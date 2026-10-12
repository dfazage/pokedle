import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import type { DailyChallenge } from '../game/daily'
import { classLabel, GEN_INFO } from '../game/fr'
import { TrainerImg } from '../game/trainerSprites'
import { MonOrb } from '../ui/kit'
import { t, useLang } from '../i18n'

/** Durée totale de l'intro (ms) : transition, entrée des dresseurs, VS, texte, fondu. */
export const INTRO_MS = 3950

const BALLS = [0, 1, 2, 3, 4, 5]
const Balls = () => <div className="bi-balls">{BALLS.map((k) => <i key={k} style={{ ['--k' as string]: k } as CSSProperties} />)}</div>

/** Petite animation jouée à la confirmation du combat, avant l'arène. Un appui l'abrège. */
export function BattleIntro({ challenge, boosted, onDone }: { challenge: DailyChallenge; boosted: boolean; onDone: () => void }) {
  useLang()
  const tr = challenge.trainer
  const text = t('bi.wants', { name: tr.name })
  const done = useRef(onDone)
  useEffect(() => { done.current = onDone }) // le minuteur ne repart pas quand le parent se redessine
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => done.current(), reduce ? 0 : INTRO_MS)
    return () => window.clearTimeout(id)
  }, [])
  const bars = useMemo(() => Array.from({ length: 14 }, (_, n) => n), [])
  return (
    <div className="bi" onClick={onDone} role="presentation">
      <div className={boosted ? 'bi-stage boost' : 'bi-stage'}>
        <div className="bi-layer bi-back" />
        <div className="bi-layer bi-rays" />

        <div className="bi-side bi-foe">
          <div className="bi-sprite">
            {boosted && (
              <span className="bi-aura" aria-hidden>
                <i className="glow" />
                {[1, 2, 3, 4, 5, 6, 7].map((k) => <i key={k} className={`fl f${k}`} />)}
              </span>
            )}
            <TrainerImg
              id={tr.sprite ?? tr.id}
              gen={challenge.gen}
              fallback={<MonOrb types={challenge.opponentPreview[0]?.types ?? ['Normal']} size={110} />}
            />
          </div>
          <div className="bi-name">{tr.name}</div>
          <div className="bi-cls">{t('bi.cls', { class: classLabel(tr), game: GEN_INFO[challenge.gen].game })}</div>
          <Balls />
        </div>

        <div className="bi-side bi-me">
          <div className="bi-sprite">
            <TrainerImg id="lucas" gen={4} className="flip" fallback={<MonOrb types={challenge.playerPreview[0]?.types ?? ['Normal']} size={90} />} />
          </div>
          <div className="bi-tag">{t('battle.you')}</div>
          <Balls />
        </div>

        <div className="bi-slash" />
        <div className="bi-vs">VS</div>
        <div className="bi-cta"><span style={{ ['--n' as string]: text.length } as CSSProperties}>{text}</span></div>

        <div className="bi-layer bi-flash" />
        <div className="bi-layer bi-bars">
          {bars.map((n) => <i key={n} style={{ ['--n' as string]: n, ['--from' as string]: n % 2 ? '-105%' : '105%' } as CSSProperties} />)}
        </div>
        <div className="bi-layer bi-fade" />
      </div>
    </div>
  )
}
