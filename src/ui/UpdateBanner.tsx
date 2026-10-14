import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { applyUpdate } from '../game/update'
import { t } from '../i18n'

/** Bandeau « nouvelle version disponible » : « Mettre à jour » purge le précache du service worker et recharge l'app. */
export function UpdateBanner({ onLater }: { onLater: () => void }) {
  const [busy, setBusy] = useState(false)
  const go = () => {
    setBusy(true)
    void applyUpdate()
  }
  return (
    <div className="updatebar" role="status" aria-live="polite">
      <div className="updatebar-head">
        <span className="updatebar-ico"><RefreshCw size={20} strokeWidth={2.4} className={busy ? 'spin' : undefined} aria-hidden /></span>
        <div className="grow">
          <div className="updatebar-title">{busy ? t('update.busy.title') : t('update.title')}</div>
          <div className="updatebar-body muted">{busy ? t('update.busy.body') : t('update.body')}</div>
        </div>
      </div>
      <div className="updatebar-actions">
        <button className="btn" onClick={go} disabled={busy}>{busy ? t('update.busy') : t('update.cta')}</button>
        {!busy && <button className="btn ghost" onClick={onLater}>{t('update.later')}</button>}
      </div>
    </div>
  )
}
