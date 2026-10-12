import { useEffect } from 'react'
import { moveDesc, targetLabel, type MoveFacts } from '../game/moves'
import { mvName, spName } from '../game/fr'
import { t, useLang } from '../i18n'
import { typeMultiplier } from '../game/typechart'
import { TYPE_COLORS } from '../game/info'
import { TypeBadge } from './kit'

const nameOf = (m: MoveFacts) => mvName(m.name.replace(/^(Hidden Power) .*/, '$1'))

/** Efficacité de l'attaque contre les types donnés (attaques qui infligent des dégâts uniquement). */
function effectiveness(m: MoveFacts, foe?: { name: string; types: string[] } | null): { text: string; tone: 'good' | 'bad' } | null {
  if (!foe || m.power <= 0) return null
  const x = typeMultiplier(m.type, foe.types)
  if (x === 0) return { text: t('mi.noEffect', { name: spName(foe.name) }), tone: 'bad' }
  if (x > 1) return { text: t(x >= 4 ? 'mi.super4' : 'mi.super', { name: spName(foe.name) }), tone: 'good' }
  if (x < 1) return { text: t(x <= 0.25 ? 'mi.resist4' : 'mi.resist', { name: spName(foe.name) }), tone: 'bad' }
  return null
}

/** Contenu de la fiche : nom, type, catégorie, chiffres, description, cible et efficacité. */
export function MoveBody({ m, foe }: { m: MoveFacts; foe?: { name: string; types: string[] } | null }) {
  useLang()
  const eff = effectiveness(m, foe)
  const d = moveDesc(m.name)
  return (
    <>
      <div className="mi-head">
        <h2>{nameOf(m)}</h2>
        <TypeBadge type={m.type} />
        <span className={`mi-cat c-${m.category}`}><i />{m.category === 'Physical' || m.category === 'Special' || m.category === 'Status' ? t(`cat.${m.category}`) : m.category}</span>
      </div>
      <div className="mi-stats">
        <div><small>{t('mi.power')}</small><b>{m.power > 0 ? m.power : '—'}</b></div>
        <div><small>{t('mi.acc')}</small><b>{m.acc > 0 ? `${m.acc}%` : '—'}</b></div>
        <div><small>{t('mi.pp')}</small><b>{m.ppLeft !== undefined ? `${m.ppLeft}/${m.pp}` : m.pp}</b></div>
        <div><small>{t('mi.prio')}</small><b>{m.priority > 0 ? `+${m.priority}` : m.priority}</b></div>
      </div>
      {d && <p className="mi-desc">{d}</p>}
      <div className="mi-tags">
        <span className="mi-tag">{t('mi.target', { v: targetLabel(m.target) })}</span>
        {eff && <span className={`mi-tag ${eff.tone}`}>{eff.text}</span>}
      </div>
    </>
  )
}

/** Popup (menu équipe) : s'ouvre au toucher d'une attaque, se ferme sur le fond, « Fermer » ou Échap. */
export function MoveSheet({ m, onClose }: { m: MoveFacts; onClose: () => void }) {
  useLang()
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="mi-scrim" onClick={onClose} />
      <div className="mi-sheet" role="dialog" aria-label={nameOf(m)}>
        <div className="mi-in glass" style={{ ['--tc' as string]: TYPE_COLORS[m.type] ?? '#888' }}>
          <div className="mi-grab" />
          <MoveBody m={m} />
          <button className="mi-close" onClick={onClose}>{t('mi.close')}</button>
        </div>
      </div>
    </>
  )
}
