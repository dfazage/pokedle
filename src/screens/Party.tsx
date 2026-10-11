import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react'
import type { PreviewMon } from '../game/daily'
import { MonImg } from '../game/officialSprites'
import { abFr, itemFr, mvFr, natureFr, spFr, TYPE_FR } from '../game/fr'
import { TypeBadge, monCardStyle } from '../ui/kit'
import { GEN_INFO } from '../game/fr'

const CAT_FR: Record<string, string> = { Physical: 'Physique', Special: 'Spéciale', Status: 'Statut' }
const STAT_LABELS: [keyof PreviewMon['stats'], string][] = [
  ['hp', 'PV'], ['atk', 'Attaque'], ['def', 'Défense'], ['spa', 'Atq. Spé.'], ['spd', 'Déf. Spé.'], ['spe', 'Vitesse'],
]

export function MonSprite({ m, back = false, size = 64 }: { m: PreviewMon; back?: boolean; size?: number }) {
  const art = size >= 100 && !back // grandes cartes : artwork officiel ; petites : sprite pixel de la génération
  return <MonImg spec={m} back={back} artwork={art} alt={spFr(m.species)} width={size} height={size} draggable={false} style={{ imageRendering: art ? 'auto' : 'pixelated', width: size, height: size, objectFit: 'contain' }} />
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
  const stats = gen <= 2 ? STAT_LABELS.filter(([k]) => k !== 'spd').map(([k, l]) => [k, k === 'spa' ? 'Spécial' : l] as [keyof PreviewMon['stats'], string]) : STAT_LABELS
  return (
    <div className="sheet-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={spFr(m.species)}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <button className="iconbtn sheet-x" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        <div className="sheet-hero" style={monCardStyle(m.types)}>
          <MonSprite m={m} size={164} />
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <h2 className="h2" style={{ margin: 0 }}>{spFr(m.species)}</h2>
          <span className="pill">Niv. 100</span>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {m.types.map((t) => <TypeBadge key={t} type={t} />)}
          {m.ability && <span className="pill">Talent : {abFr(m.ability)}</span>}
          {m.item && <span className="pill">Objet : {itemFr(m.item)}</span>}
          {m.nature && <span className="pill">Nature : {natureFr(m.nature)}</span>}
        </div>

        <div className="lab" style={{ margin: '14px 0 6px' }}>Statistiques</div>
        <div className="stack" style={{ gap: 6 }}>
          {stats.map(([k, l]) => (
            <div key={k} className="statrow">
              <span className="sl">{l}</span>
              <span className="sv">{m.stats[k]}</span>
              <div className="sbar"><div style={{ width: `${Math.min(100, (m.stats[k] / 450) * 100)}%`, background: statColor(m.stats[k]) }} /></div>
            </div>
          ))}
        </div>

        <div className="lab" style={{ margin: '16px 0 6px' }}>Attaques</div>
        <div className="stack" style={{ gap: 8 }}>
          {m.moves.map((mv) => (
            <div key={mv.name} className="row between" style={{ padding: '8px 12px', borderRadius: 14, background: 'var(--surface2)' }}>
              <span>
                <b>{mvFr(mv.name.replace(/^(Hidden Power) .*/, '$1'))}</b>
                <div className="muted small">{CAT_FR[mv.category] ?? mv.category}{mv.power ? ` · Puiss. ${mv.power}` : ''}</div>
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
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <div className="party">
        {team.map((m, i) => (
          <div key={m.species + i} className={i === 0 ? 'slot lead' : 'slot'} style={monCardStyle(m.types)}>
            <button className="slot-main" onClick={() => setOpen(i)} aria-label={`Détails de ${spFr(m.species)}`}>
              <span className="slot-top">
                <span className="slot-sprite"><MonSprite m={m} size={48} /></span>
                <span className="slot-id">
                  <b className="slot-name">{spFr(m.species)}</b>
                  <span className="row" style={{ gap: 5 }}>
                    <span className="slot-lv">Nv100</span>
                    {i === 0 && <span className="slot-tag">En tête</span>}
                  </span>
                </span>
              </span>
              <span className="slot-hp"><span className="hplbl">PV</span><span className="hpbar"><span /></span></span>
              <span className="slot-foot">
                <span className="row" style={{ gap: 3, flexWrap: 'wrap' }}>{m.types.map((t) => <span key={t} className="badge">{TYPE_FR[t]}</span>)}</span>
                <span className="slot-hpnum">{m.stats.hp}/{m.stats.hp}</span>
              </span>
            </button>
            {!locked && (
              <span className="slot-move">
                <button className="iconbtn sm" disabled={i === 0} onClick={() => onMove(i, i - 1)} aria-label="Avancer dans l'ordre"><ChevronLeft size={16} /></button>
                <span className="slot-rank">{i + 1}</span>
                <button className="iconbtn sm" disabled={i === team.length - 1} onClick={() => onMove(i, i + 1)} aria-label="Reculer dans l'ordre"><ChevronRight size={16} /></button>
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="muted small" style={{ margin: '4px 2px 0' }}>
        {locked
          ? <><Lock size={12} style={{ verticalAlign: -2 }} /> Ordre verrouillé : le combat a commencé.</>
          : 'Touche un Pokémon pour voir ses stats et ses attaques. Le premier de la liste ouvre le combat.'}
      </p>
      {open !== null && team[open] && <MonSheet m={team[open]} gen={gen} onClose={() => setOpen(null)} />}
      <span hidden>{GEN_INFO[gen]?.game}</span>
    </>
  )
}
