import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react'
import type { PreviewMon } from '../game/daily'
import { MonImg } from '../game/officialSprites'
import { abName, itemName, mvName, natureName, spName, typeName } from '../game/fr'
import { t, useLang } from '../i18n'
import { TypeBadge, monCardStyle } from '../ui/kit'
import { GEN_INFO } from '../game/fr'

const STAT_KEYS: (keyof PreviewMon['stats'])[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']

export function MonSprite({ m, back = false, size = 64, animated = false }: { m: PreviewMon; back?: boolean; size?: number; animated?: boolean }) {
  // `animated` : GIF animé BW/BW2 (repli sur le sprite Platine) ; sinon grandes cartes : artwork officiel, petites : sprite pixel.
  const art = size >= 100 && !back && !animated
  return <MonImg spec={m} back={back} artwork={art} animated={animated} alt={spName(m.species)} width={size} height={size} draggable={false} style={{ imageRendering: art ? 'auto' : 'pixelated', width: size, height: size, objectFit: 'contain' }} />
}

function statColor(v: number) {
  return v >= 300 ? 'var(--tertiary)' : v >= 220 ? 'var(--primary)' : v >= 150 ? 'var(--yellow)' : 'var(--secondary)'
}

export function MonSheet({ m, gen, onClose }: { m: PreviewMon; gen: number; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  useLang()
  const stats = (gen <= 2 ? STAT_KEYS.filter((k) => k !== 'spd') : STAT_KEYS).map((k) => [k, t(gen <= 2 && k === 'spa' ? 'stats.spc' : `stats.${k}`)] as const)
  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={spName(m.species)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn sheet-x" onClick={onClose} aria-label={t('party.close')}><X size={20} /></button>
        <div className="sheet-hero" style={monCardStyle(m.types)}>
          <MonSprite m={m} size={164} animated />
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <h2 className="h2" style={{ margin: 0 }}>{spName(m.species)}</h2>
          <span className="pill">{t('lv100')}</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {m.types.map((ty) => <TypeBadge key={ty} type={ty} />)}
          {m.ability && <span className="pill">{t('party.ability', { v: abName(m.ability) })}</span>}
          {m.item && <span className="pill">{t('party.item', { v: itemName(m.item) })}</span>}
          {m.nature && <span className="pill">{t('party.nature', { v: natureName(m.nature) })}</span>}
        </div>

        <div className="lab" style={{ margin: '14px 0 6px' }}>{t('party.stats')}</div>
        <div className="stack" style={{ gap: 6 }}>
          {stats.map(([k, l]) => (
            <div key={k} className="statrow">
              <span className="sl">{l}</span>
              <span className="sv">{m.stats[k]}</span>
              <div className="sbar"><div style={{ width: `${Math.min(100, (m.stats[k] / 450) * 100)}%`, background: statColor(m.stats[k]) }} /></div>
            </div>
          ))}
        </div>

        <div className="lab" style={{ margin: '16px 0 6px' }}>{t('party.moves')}</div>
        <div className="stack" style={{ gap: 8 }}>
          {m.moves.map((mv) => (
            <div key={mv.name} className="row between" style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface2)' }}>
              <span>
                <b>{mvName(mv.name.replace(/^(Hidden Power) .*/, '$1'))}</b>
                <div className="muted small">{mv.category === 'Physical' || mv.category === 'Special' || mv.category === 'Status' ? t(`cat.${mv.category}`) : mv.category}{mv.power ? ` · ${t('mv.power', { n: mv.power })}` : ''}</div>
              </span>
              <TypeBadge type={mv.type} soft />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Équipe façon écran Pokémon : un emplacement par Pokémon, tête de liste en premier, détails au toucher, ordre modifiable. */
export function PartyList({
  team, gen, locked, onMove,
}: { team: PreviewMon[]; gen: number; locked: boolean; onMove: (from: number, to: number) => void }) {
  useLang()
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="party">
        {team.map((m, i) => (
          <div key={m.species + i} className={i === 0 ? 'slot lead' : 'slot'} style={monCardStyle(m.types)}>
            <button className="slot-main" onClick={() => setOpen(i)} aria-label={t('party.details', { name: spName(m.species) })}>
              <span className="slot-top">
                <span className="slot-sprite"><MonSprite m={m} size={48} /></span>
                <span className="slot-id">
                  <b className="slot-name">{spName(m.species)}</b>
                  <span className="row" style={{ gap: 5 }}>
                    <span className="slot-lv">{t('party.lv')}</span>
                    {i === 0 && <span className="slot-tag">{t('party.lead')}</span>}
                  </span>
                </span>
              </span>
              <span className="slot-hp"><span className="hplbl">{t('party.hp')}</span><span className="hpbar"><span /></span></span>
              <span className="slot-foot">
                <span className="row" style={{ gap: 3, flexWrap: 'wrap' }}>{m.types.map((ty) => <span key={ty} className="badge">{typeName(ty)}</span>)}</span>
                <span className="slot-hpnum">{m.stats.hp}/{m.stats.hp}</span>
              </span>
            </button>
            {!locked && (
              <span className="slot-move">
                <button className="iconbtn sm" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label={t('party.forward')}><ChevronLeft size={16} /></button>
                <span className="slot-rank">{i + 1}</span>
                <button className="iconbtn sm" disabled={i === team.length - 1} onClick={() => onMove(i, i + 1)} aria-label={t('party.backward')}><ChevronRight size={16} /></button>
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 2px 0' }}>
        {locked
          ? <><Lock size={12} style={{ verticalAlign: -2 }} /> {t('party.locked')}</>
          : t('party.hint')}
      </p>
      {open !== null && team[open] && <MonSheet m={team[open]} gen={gen} onClose={() => setOpen(null)} />}
      <span hidden>{GEN_INFO[gen]?.game}</span>
    </>
  )
}
