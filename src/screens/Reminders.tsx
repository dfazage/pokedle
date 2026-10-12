import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Bell, ChevronRight, Download, Lock, PlusSquare, Share } from 'lucide-react'
import type { Ctx } from './types'
import { canPromptInstall, disablePush, enablePush, isIos, isStandalone, nextReminder, onInstallChange, promptInstall, pushState, sendTestNotification, type PushState } from '../game/push'
import { TopBar } from '../ui/kit'
import { locale, t, useLang } from '../i18n'

/** État de la checklist « Rappels » : compte, installation de la PWA, notifications. Chaque étape se coche d'elle-même. */
export function useReminders(email: string | null | undefined) {
  const [push, setPush] = useState<PushState | null>(null)
  const [standalone, setStandalone] = useState(isStandalone)
  const refresh = useCallback(() => {
    setStandalone(isStandalone())
    pushState().then(setPush).catch(() => setPush('unsupported'))
  }, [])
  useEffect(() => {
    refresh()
    const mq = window.matchMedia('(display-mode: standalone)')
    const onVis = () => document.visibilityState === 'visible' && refresh()
    mq.addEventListener('change', refresh)
    document.addEventListener('visibilitychange', onVis)
    return () => { mq.removeEventListener('change', refresh); document.removeEventListener('visibilitychange', onVis) }
  }, [refresh])
  const ios = isIos()
  const account = !!email
  const notifOn = push === 'on'
  // Sur iPhone l'installation est indispensable aux notifications ; ailleurs elle est facultative.
  const done = Number(account) + Number(standalone) + Number(notifOn)
  const ready = account && notifOn && (!ios || standalone)
  return { push, setPush, standalone, ios, account, notifOn, done, total: 3, ready, loaded: push !== null }
}

function Step({ checked, disabled, locked, active, onChange, children, tag, label }: { checked: boolean; disabled?: boolean; locked?: boolean; active?: boolean; onChange?: () => void; children?: ReactNode; tag?: ReactNode; label: string }) {
  return (
    <div className="card rem-step" style={active ? { borderColor: 'var(--violet)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--violet) 18%, transparent)' } : undefined}>
      <label className="row" style={{ alignItems: 'flex-start', gap: 14, opacity: locked && !checked ? 0.6 : 1 }}>
        <input type="checkbox" className="rem-ck" checked={checked} disabled={disabled} onChange={onChange} aria-label={label} />
        <span className="grow">{tag}{children}</span>
      </label>
    </div>
  )
}

const Tag = ({ children, hot }: { children: ReactNode; hot?: boolean }) => <span className={hot ? 'rem-tag hot' : 'rem-tag'}>{children}</span>

export function Reminders(c: Ctx & { onBack: () => void }) {
  useLang()
  const r = useReminders(c.email)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [, bump] = useState(0)
  useEffect(() => onInstallChange(() => bump((n) => n + 1)), [])

  const toggleNotif = async () => {
    setBusy(true)
    setErr(null)
    try {
      r.setPush(r.notifOn ? await disablePush() : await enablePush())
    } catch (e) {
      setErr(e instanceof Error ? `${e.name}: ${e.message}` : String(e))
    }
    setBusy(false)
  }
  const [showHow, setShowHow] = useState(false)
  const install = async () => {
    // Pas de boîte d'installation (déjà installée, ou navigateur qui ne la propose pas) : on affiche les explications.
    if (!(await promptInstall())) setShowHow(true)
    bump((n) => n + 1)
  }
  const test = async () => {
    setErr(null)
    try { await sendTestNotification(t('rem.test.title'), t('rem.test.body')) } catch (e) { setErr(e instanceof Error ? `${e.name}: ${e.message}` : String(e)) }
  }

  const notifLocked = !r.account || (r.ios && !r.standalone) || r.push === 'unsupported'
  const notifBlocked = r.push === 'denied'
  // Première étape non terminée = « étape suivante » mise en avant.
  const next: 'account' | 'install' | 'notif' | null = !r.account ? 'account' : r.ios && !r.standalone ? 'install' : !r.notifOn ? 'notif' : null
  const when = nextReminder().toLocaleString(locale(), { weekday: 'long', hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <TopBar title={t('rem.title')} onBack={c.onBack} />
      <section className="card stack" style={r.ready ? { borderColor: 'var(--tertiary)' } : undefined}>
        <h2 className="h2" style={{ margin: 0 }}>{r.ready ? t('rem.ready') : t('set.reminders')}</h2>
        <p className="muted" style={{ margin: 0 }}>{r.ready ? t('rem.ready.sub') : r.ios && !r.standalone ? t('rem.hero.ios') : t('rem.hero.sub')}</p>
        <div className="row" style={{ gap: 10 }}>
          {[0, 1, 2].map((i) => <span key={i} className="rem-seg" style={{ background: i < r.done ? 'var(--tertiary)' : undefined }} />)}
          <b className="small">{r.done}/{r.total}</b>
        </div>
      </section>

      <Step checked={r.account} disabled active={next === 'account'} label={t('rem.s.account')} tag={next === 'account' ? <Tag hot>{t('rem.next')}</Tag> : undefined}>
        <b style={{ display: 'block', fontSize: 17 }}>{t('rem.s.account')}</b>
        <span className="muted small">{r.account ? t('rem.s.account.ok', { name: c.username ?? c.email }) : t('rem.s.account.todo')}</span>
        {!r.account && <button type="button" className="btn violet" style={{ marginTop: 12 }} onClick={() => c.go('auth')}>{t('rem.s.account.cta')}</button>}
      </Step>

      <Step checked={r.standalone} disabled active={next === 'install'} label={t('rem.s.install')} tag={next === 'install' ? <Tag hot>{t('rem.next')}</Tag> : !r.ios && !r.standalone ? <Tag>{t('rem.optional')}</Tag> : undefined}>
        <b style={{ display: 'block', fontSize: 17 }}>{t('rem.s.install')}</b>
        {r.standalone ? (
          <span className="muted small">{t('rem.s.install.ok')}</span>
        ) : r.ios ? (
          <ol className="rem-how">
            <li><span>1</span><p>{t('rem.ios.1')}</p><Share size={22} style={{ color: 'var(--primary)' }} /></li>
            <li><span>2</span><p>{t('rem.ios.2')}</p><PlusSquare size={22} /></li>
            <li><span>3</span><p>{t('rem.ios.3')}</p></li>
          </ol>
        ) : (
          <>
            <span className="muted small">{canPromptInstall() || !showHow ? t('rem.s.install.sub') : t('rem.s.install.manual')}</span>
            {showHow && !canPromptInstall() && <span className="muted small" style={{ display: 'block', marginTop: 6 }}>{t('rem.s.install.already')}</span>}
            <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={install}><Download size={18} /> {t('rem.s.install.cta')}</button>
          </>
        )}
      </Step>

      <Step checked={r.notifOn} disabled={busy || notifLocked || notifBlocked} locked={notifLocked} onChange={toggleNotif} active={next === 'notif'} label={t('rem.s.notif')} tag={next === 'notif' ? <Tag hot>{t('rem.next')}</Tag> : undefined}>
        <b style={{ display: 'block', fontSize: 17 }}>{r.notifOn ? t('rem.s.notif.ok') : t('rem.s.notif')}</b>
        <span className="muted small row" style={{ gap: 6, alignItems: 'flex-start' }}>
          {notifLocked && r.push !== 'unsupported' && <Lock size={15} style={{ flex: 'none', marginTop: 2 }} />}
          <span>
            {r.push === 'unsupported' ? t('push.unsupported')
              : notifBlocked ? t('push.denied')
              : !r.account ? t('rem.s.notif.lockedAccount')
              : notifLocked ? t('rem.s.notif.lockedIos')
              : r.notifOn ? t('rem.s.notif.off') : t('rem.s.notif.sub')}
          </span>
        </span>
        {next === 'notif' && !notifLocked && !notifBlocked && (
          <button type="button" className="btn violet" style={{ marginTop: 12 }} disabled={busy} onClick={toggleNotif}><Bell size={18} /> {t('push.enable')}</button>
        )}
        {err && (
          <div className="small" style={{ color: 'var(--secondary)', marginTop: 8 }}>
            {t('push.error')}
            <div className="muted" style={{ marginTop: 4, wordBreak: 'break-word' }}>{err}</div>
          </div>
        )}
      </Step>

      {r.notifOn && (
        <div className="stack" style={{ gap: 10 }}>
          <button type="button" className="btn violet" onClick={test}>{t('rem.test')}</button>
          <div className="muted small" style={{ textAlign: 'center' }}>{t('rem.nextRun', { when })}</div>
        </div>
      )}
      <p className="muted small" style={{ textAlign: 'center' }}>{t('rem.foot')}</p>
    </>
  )
}

/** Carte d'entrée dans les Paramètres : montre l'avancement et mène à la page. */
export function RemindersEntry(c: Ctx) {
  useLang()
  const r = useReminders(c.email)
  if (!r.loaded) return null
  return (
    <button type="button" className="card rem-entry" onClick={() => c.go('reminders')} style={r.ready ? undefined : { borderColor: 'var(--violet)' }}>
      <div className="row" style={{ gap: 14 }}>
        <span className="rem-ico" style={r.ready ? { background: 'var(--tertiary)' } : undefined}><Bell size={24} /></span>
        <div className="grow" style={{ textAlign: 'left' }}>
          <b style={{ fontSize: 18 }}>{t('set.reminders')}</b>
          <div className="muted small">{r.ready ? t('rem.entry.done') : t('rem.entry.todo', { done: r.done, total: r.total })}</div>
        </div>
        <ChevronRight size={20} className="muted" />
      </div>
      {!r.ready && (
        <div className="row" style={{ gap: 10, marginTop: 14 }}>
          {[0, 1, 2].map((i) => <span key={i} className="rem-seg" style={{ background: i < r.done ? 'var(--tertiary)' : undefined }} />)}
          <b className="small">{r.done}/{r.total}</b>
        </div>
      )}
    </button>
  )
}
