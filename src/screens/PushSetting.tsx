import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disablePush, enablePush, pushState, type PushState } from '../game/push'
import { t, useLang } from '../i18n'

/** Carte des réglages : active / désactive la notification quotidienne « le combat du jour est disponible ». */
export function PushSetting() {
  useLang()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    pushState().then((s) => alive && setState(s)).catch(() => alive && setState('unsupported'))
    return () => { alive = false }
  }, [])
  if (!state) return null
  const toggle = async () => {
    setBusy(true)
    setErr(null)
    try {
      setState(state === 'on' ? await disablePush() : await enablePush())
    } catch (e) {
      // Détail technique affiché sous le message (ex. « AbortError: … push service error ») : aide à comprendre pourquoi un navigateur refuse l'abonnement.
      setErr(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
    setBusy(false)
  }
  const note = state === 'denied' ? t('push.denied') : state === 'ios-install' ? t('push.ios') : state === 'unsupported' ? t('push.unsupported') : state === 'on' ? t('push.on') : t('push.sub')
  const canToggle = state === 'on' || state === 'off'
  return (
    <section className="card stack">
      <div className="row">
        {state === 'on' ? <Bell size={22} style={{ color: 'var(--tertiary)' }} /> : <BellOff size={22} className="muted" />}
        <div className="grow">
          <b>{t('push.title')}</b>
          <div className="muted small">{note}</div>
        </div>
      </div>
      {canToggle && (
        <button type="button" className={state === 'on' ? 'btn ghost' : 'btn violet'} disabled={busy} onClick={toggle}>
          {state === 'on' ? t('push.disable') : t('push.enable')}
        </button>
      )}
      {err && (
        <div className="small" style={{ color: 'var(--secondary)' }}>
          {t('push.error')}
          <div className="muted" style={{ marginTop: 4, wordBreak: 'break-word' }}>{err}</div>
        </div>
      )}
    </section>
  )
}
