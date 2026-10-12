import { useEffect, useRef, useState } from 'react'
import { ArrowRight, RotateCcw, Shuffle, Eye, EyeOff, Lock, LogIn, Mail, User } from 'lucide-react'
import type { Ctx } from './types'
import { supabase, siteUrl } from '../game/cloud'
import { dayNumber } from '../game/info'
import { MonOrb, TopBar } from '../ui/kit'
import { renderGoogleButton } from '../game/googleSignIn'
import { t, useLang } from '../i18n'
import { displayDay } from '../game/rng'

export function Auth(c: Ctx & { onBack: () => void }) {
  const { lang } = useLang()
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in')
  const [mail, setMail] = useState('')
  const [pass, setPass] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  // Bouton Google Identity Services (affiche pokebadle.fun au lieu de supabase.co) ; sinon repli sur le flux OAuth classique.
  const gisRef = useRef<HTMLDivElement>(null)
  const [gis, setGis] = useState(false)
  useEffect(() => {
    const el = gisRef.current
    if (!el) return
    let alive = true
    renderGoogleButton(el, {
      locale: lang,
      width: Math.min(el.clientWidth || 320, 400),
      onStart: () => { setBusy(true); setMsg('') },
      onError: (m) => { setMsg(m); setBusy(false) },
      onDone: () => c.go('home'),
    }).then((ok) => alive && setGis(ok))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg('')
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: siteUrl() })
      setMsg(error ? error.message : t('auth.msgForgot'))
    } else if (mode === 'up') {
      const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { data: { username: pseudo.trim() }, emailRedirectTo: siteUrl() } })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg(t('auth.msgCreated'))
      else c.go('home')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass })
      if (error) setMsg(error.message)
      else c.go('home')
    }
    setBusy(false)
  }
  const google = async () => {
    if (!supabase) return
    setBusy(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl() } })
    if (error) {
      setMsg(error.message)
      setBusy(false)
    } // sinon : redirection vers Google, puis retour sur l'app avec la session
  }
  return (
    <>
      <div className="purple-head">
        <div className="row between"><button className="iconbtn" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: 0 }} onClick={c.onBack} aria-label={t('back')}><ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} /></button><span className="pill" style={{ background: 'rgba(0,0,0,.2)', color: '#ffd76a', border: 0 }}>{t('auth.streak', { n: c.stats.currentStreak })}</span><span style={{ width: 40 }} /></div>
        <div className="eyebrow" style={{ color: "#fff", opacity: 0.85, marginTop: 20 }}>Pokédle Battle #{dayNumber(c.today)}</div>
        <h1 className="title" style={{ marginTop: 6 }}>{t('auth.title')}</h1>
        <p style={{ opacity: 0.9, marginTop: 8, lineHeight: 1.4 }}>{t('auth.sub')}</p>
      </div>
      <div className="sheet stack">
        {!supabase && <p className="muted">{t('auth.noCloud')}</p>}
        <div ref={gisRef} style={{ display: gis ? 'flex' : 'none', justifyContent: 'center', minHeight: 44, opacity: busy ? 0.5 : 1, pointerEvents: busy ? 'none' : 'auto' }} />
        <button type="button" className="btn ghost" style={{ display: gis ? 'none' : undefined }} disabled={busy || !supabase} onClick={google}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 12-2.1 16-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
          {t('auth.google')}
        </button>
        <div className="muted small" style={{ textAlign: 'center' }}>{t('auth.or')}</div>
        <div className="tabs">
          <button className={mode !== 'up' ? 'on' : ''} onClick={() => { setMode('in'); setMsg('') }}>{t('auth.tabIn')}</button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setMsg('') }}>{t('auth.tabUp')}</button>
        </div>
        <form onSubmit={submit} className="stack">
          {mode === 'up' && (
            <div><div className="lab">{t('auth.pseudo')}</div><label className="field"><User size={18} className="muted" /><input placeholder={t('auth.pseudoPh')} minLength={3} maxLength={20} required value={pseudo} onChange={(e) => setPseudo(e.target.value)} /></label></div>
          )}
          <div><div className="lab">{t('auth.email')}</div><label className="field"><Mail size={18} className="muted" /><input type="email" placeholder={t('auth.emailPh')} autoComplete="email" required value={mail} onChange={(e) => setMail(e.target.value)} /></label></div>
          {mode !== 'forgot' && <div><div className="lab">{t('auth.pass')}</div><label className="field"><Lock size={18} className="muted" /><input type={show ? 'text' : 'password'} placeholder={t('auth.passPh')} minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required value={pass} onChange={(e) => setPass(e.target.value)} /><button type="button" onClick={() => setShow(!show)} aria-label={t('auth.showPass')}>{show ? <EyeOff size={18} className="muted" /> : <Eye size={18} className="muted" />}</button></label></div>}
          {mode === 'in' && <button type="button" className="link" style={{ alignSelf: 'flex-end' }} onClick={() => { setMode('forgot'); setMsg('') }}>{t('auth.forgot')}</button>}
          <button className="btn violet" disabled={busy || !supabase}><LogIn size={18} /> {mode === 'in' ? t('auth.submitIn') : mode === 'up' ? t('auth.submitUp') : t('auth.submitForgot')}</button>
          {mode === 'forgot' && <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={() => { setMode('in'); setMsg('') }}>{t('auth.backToLogin')}</button>}
          {msg && <p className="small" style={{ color: 'var(--secondary)', textAlign: 'center' }}>{msg}</p>}
        </form>
      </div>
    </>
  )
}

/** Affiché quand le joueur arrive via le lien « mot de passe oublié » : session de récupération active. */
export function ResetPassword(c: { onDone: () => void }) {
  useLang()
  const [pass, setPass] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pass })
    setBusy(false)
    if (error) setMsg(error.message)
    else c.onDone()
  }
  return (
    <>
      <div className="purple-head">
        <h1 className="title" style={{ marginTop: 6 }}>{t('reset.title')}</h1>
        <p style={{ opacity: 0.9, marginTop: 8, lineHeight: 1.4 }}>{t('reset.sub')}</p>
      </div>
      <div className="sheet stack">
        <form onSubmit={submit} className="stack">
          <div><div className="lab">{t('reset.title')}</div><label className="field"><Lock size={18} className="muted" /><input type={show ? 'text' : 'password'} placeholder={t('auth.passPh')} minLength={6} autoComplete="new-password" required value={pass} onChange={(e) => setPass(e.target.value)} /><button type="button" onClick={() => setShow(!show)} aria-label={t('auth.showPass')}>{show ? <EyeOff size={18} className="muted" /> : <Eye size={18} className="muted" />}</button></label></div>
          <button className="btn violet" disabled={busy}><LogIn size={18} /> {t('reset.save')}</button>
          {msg && <p className="small" style={{ color: 'var(--secondary)', textAlign: 'center' }}>{msg}</p>}
        </form>
      </div>
    </>
  )
}

const SLIDES = [
  { n: 1, c1: '#6ad7b4', c2: '#3fb48e', types: ['Grass'] },
  { n: 2, c1: '#8fb8f6', c2: '#5ba8f0', types: ['Water'] },
  { n: 3, c1: '#f7c948', c2: '#f0716b', types: ['Fire'] },
] as const
export function Onboarding(c: { done: () => void; login: () => void }) {
  useLang()
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  const tx = (k: 'tag' | 'a' | 'b' | 'text') => t(`ob.${s.n}.${k}` as const)
  return (
    <>
      <div className="row between">
        <div className="row"><span className="orb" style={{ width: 44, height: 44, ['--c1' as string]: '#8b6cd9', ['--c2' as string]: '#5a3fb0' }}><User size={22} /></span><div><div className="eyebrow" style={{ color: 'var(--violet)' }}>{t('ob.eyebrow')}</div><b style={{ fontSize: 18 }}>Pokédle Battle</b></div></div>
        <button className="pill" onClick={c.done}>{t('ob.skip')}</button>
      </div>
      <div className="ob-art" style={{ background: `linear-gradient(150deg, ${s.c1}, ${s.c2})` }}>
        <span className="pill" style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,.28)', border: 0, color: '#fff' }}>{tx('tag')}</span>
        <div className="row" style={{ gap: 20, zIndex: 1 }}><MonOrb types={['Dark']} size={92} /><span className="pill" style={{ background: '#fff', color: s.c2 }}>VS</span><MonOrb types={[...s.types]} size={92} /></div>
      </div>
      <div>
        <h1 className="title" style={{ fontSize: 34 }}>{tx('a')}<br /><span style={{ color: s.c2 }}>{tx('b')}</span></h1>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>{tx('text')}</p>
      </div>
      <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} style={k === i ? { background: 'var(--violet)' } : undefined} />)}</div>
      <button className="btn violet" onClick={() => (i < SLIDES.length - 1 ? setI(i + 1) : c.done())}>{i < SLIDES.length - 1 ? t('ob.continue') : t('ob.start')} <ArrowRight size={18} /></button>
      <button className="link" style={{ alignSelf: 'center' }} onClick={c.login}>{t('ob.haveAccount')}</button>
    </>
  )
}

export function Admin(c: Ctx & { onBack: () => void }) {
  useLang()
  return (
    <>
      <TopBar title={t('adm.title')} onBack={c.onBack} />
      <p className="muted">{t('adm.sub')}{c.username ? t('adm.subUser', { name: c.username }) : ''}.</p>
      <div className="lab">{t('adm.today', { day: displayDay(c.today) })}</div>
      <button className="card row" onClick={c.onAdminReset} style={{ textAlign: 'left' }}>
        <RotateCcw size={22} style={{ color: 'var(--secondary)' }} />
        <div className="grow"><b>{t('adm.reset')}</b><div className="muted small">{t('adm.resetSub')}</div></div>
      </button>
      <button className="card row" onClick={c.onAdminResetAll} style={{ textAlign: 'left' }}>
        <RotateCcw size={22} style={{ color: 'var(--danger, #e5484d)' }} />
        <div className="grow"><b>{t('adm.resetAll')}</b><div className="muted small">{t('adm.resetAllSub')}</div></div>
      </button>
      <button className="card row" onClick={c.onAdminReroll} style={{ textAlign: 'left' }}>
        <Shuffle size={22} style={{ color: 'var(--violet)' }} />
        <div className="grow"><b>{t('adm.reroll')}</b><div className="muted small">{t('adm.rerollSub')}</div></div>
      </button>
    </>
  )
}
