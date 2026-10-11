import { useState } from 'react'
import { ArrowRight, RotateCcw, Eye, EyeOff, Lock, LogIn, Mail, User } from 'lucide-react'
import type { Ctx } from './types'
import { supabase } from '../game/cloud'
import { GEN_INFO } from '../game/fr'
import { dayNumber } from '../game/info'
import { MonOrb, TopBar } from '../ui/kit'

export function Auth(c: Ctx & { onBack: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [mail, setMail] = useState('')
  const [pass, setPass] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [show, setShow] = useState(false)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMsg('')
    if (mode === 'up') {
      const { data, error } = await supabase.auth.signUp({ email: mail, password: pass, options: { data: { username: pseudo.trim() } } })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg('Compte créé : confirme ton adresse e-mail, puis connecte-toi.')
      else c.go('home')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password: pass })
      if (error) setMsg(error.message)
      else c.go('home')
    }
    setBusy(false)
  }
  return (
    <>
      <div className="purple-head">
        <div className="row between"><button className="iconbtn" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', border: 0 }} onClick={c.onBack} aria-label="Retour"><ArrowRight size={20} style={{ transform: 'rotate(180deg)' }} /></button><span className="pill" style={{ background: 'rgba(0,0,0,.2)', color: '#ffd76a', border: 0 }}>Série : {c.stats.currentStreak}j</span><span style={{ width: 40 }} /></div>
        <div className="eyebrow" style={{ color: "#fff", opacity: 0.85, marginTop: 20 }}>Pokédle Battle #{dayNumber(c.today)}</div>
        <h1 className="title" style={{ marginTop: 6 }}>Connecte-toi pour sauvegarder ta série</h1>
        <p style={{ opacity: 0.9, marginTop: 8, lineHeight: 1.4 }}>Synchronise tes victoires, tes records et ta place au classement.</p>
      </div>
      <div className="sheet stack">
        {!supabase && <p className="muted">La connexion en ligne n’est pas configurée sur cette version.</p>}
        <div className="tabs">
          <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Connexion</button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Inscription</button>
        </div>
        <form onSubmit={submit} className="stack">
          {mode === 'up' && (
            <div><div className="lab">Pseudo</div><label className="field"><User size={18} className="muted" /><input placeholder="3 à 20 caractères" minLength={3} maxLength={20} required value={pseudo} onChange={(e) => setPseudo(e.target.value)} /></label></div>
          )}
          <div><div className="lab">Adresse e-mail</div><label className="field"><Mail size={18} className="muted" /><input type="email" placeholder="dresseur@exemple.com" autoComplete="email" required value={mail} onChange={(e) => setMail(e.target.value)} /></label></div>
          <div><div className="lab">Mot de passe</div><label className="field"><Lock size={18} className="muted" /><input type={show ? 'text' : 'password'} placeholder="6 caractères minimum" minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required value={pass} onChange={(e) => setPass(e.target.value)} /><button type="button" onClick={() => setShow(!show)} aria-label="Afficher le mot de passe">{show ? <EyeOff size={18} className="muted" /> : <Eye size={18} className="muted" />}</button></label></div>
          <button className="btn violet" disabled={busy || !supabase}><LogIn size={18} /> {mode === 'in' ? 'Se connecter' : 'Créer le compte'}</button>
          {msg && <p className="small" style={{ color: 'var(--secondary)', textAlign: 'center' }}>{msg}</p>}
        </form>
        <button className="link" style={{ alignSelf: 'center' }} onClick={c.onBack}>Jouer en invité <span className="muted small">(partie non synchronisée)</span></button>
      </div>
    </>
  )
}

const SLIDES = [
  { tag: 'Étape 01 · Règle d’or', a: 'Un combat par jour.', b: 'Le même pour tous.', text: 'Chaque jour à minuit UTC, un nouveau dresseur se présente. Mesure ta stratégie à armes égales contre les joueurs du monde entier.', c1: '#6ad7b4', c2: '#3fb48e', types: ['Grass'] },
  { tag: 'Étape 02 · Équipe imposée', a: 'Six Pokémon, niveau 100.', b: 'Une seule tentative.', text: 'Ton équipe est tirée au sort et identique pour tous. Choisis tes attaques et tes changements : pas de seconde chance avant demain.', c1: '#8fb8f6', c2: '#5ba8f0', types: ['Water'] },
  { tag: 'Étape 03 · Progression', a: 'Garde ta série.', b: 'Grimpe au classement.', text: 'Enchaîne les victoires jour après jour, partage ta grille et compare-toi aux meilleurs dresseurs.', c1: '#f7c948', c2: '#f0716b', types: ['Fire'] },
]
export function Onboarding(c: { done: () => void; login: () => void }) {
  const [i, setI] = useState(0)
  const s = SLIDES[i]
  return (
    <>
      <div className="row between">
        <div className="row"><span className="orb" style={{ width: 44, height: 44, ['--c1' as string]: '#8b6cd9', ['--c2' as string]: '#5a3fb0' }}><User size={22} /></span><div><div className="eyebrow" style={{ color: 'var(--violet)' }}>Défi quotidien</div><b style={{ fontSize: 18 }}>Pokédle Battle</b></div></div>
        <button className="pill" onClick={c.done}>Passer</button>
      </div>
      <div className="ob-art" style={{ background: `linear-gradient(150deg, ${s.c1}, ${s.c2})` }}>
        <span className="pill" style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,.28)', border: 0, color: '#fff' }}>{s.tag}</span>
        <div className="row" style={{ gap: 20, zIndex: 1 }}><MonOrb types={['Dark']} size={92} /><span className="pill" style={{ background: '#fff', color: s.c2 }}>VS</span><MonOrb types={s.types} size={92} /></div>
      </div>
      <div>
        <h1 className="title" style={{ fontSize: 34 }}>{s.a}<br /><span style={{ color: s.c2 }}>{s.b}</span></h1>
        <p className="muted" style={{ marginTop: 12, lineHeight: 1.5 }}>{s.text}</p>
      </div>
      <div className="dots">{SLIDES.map((_, k) => <i key={k} className={k === i ? 'on' : ''} style={k === i ? { background: 'var(--violet)' } : undefined} />)}</div>
      <button className="btn violet" onClick={() => (i < SLIDES.length - 1 ? setI(i + 1) : c.done())}>{i < SLIDES.length - 1 ? 'Continuer' : 'Commencer'} <ArrowRight size={18} /></button>
      <button className="link" style={{ alignSelf: 'center' }} onClick={c.login}>J’ai déjà un compte</button>
    </>
  )
}

export function Generations(c: Ctx & { onBack: () => void; counts: Record<number, number> }) {
  return (
    <>
      <TopBar title="Générations" onBack={c.onBack} />
      <p className="muted">Chaque jour, une génération est tirée au sort parmi les jeux ci-dessous.</p>
      {[1, 2, 3, 4].map((g) => {
        const gi = GEN_INFO[g]
        const active = c.challenge.gen === g
        return (
          <section key={g} className="card stack" style={active ? { borderColor: 'var(--tertiary)' } : undefined}>
            <div className="row between">
              <span className="eyebrow" style={{ color: 'var(--tertiary)' }}>Gen {gi.roman} · {gi.region}</span>
              <span className={active ? 'pill green' : 'pill'}>{active ? 'Actif aujourd’hui' : 'Dans la rotation'}</span>
            </div>
            <h2 className="h2">Pokémon {gi.game}</h2>
            <p className="muted small">{c.counts[g] ?? 0} dresseurs · espèces {gi.species}</p>
          </section>
        )
      })}
    </>
  )
}

export function Admin(c: Ctx & { onBack: () => void }) {
  return (
    <>
      <TopBar title="Options admin" onBack={c.onBack} />
      <p className="muted">Outils de test réservés aux comptes administrateurs{c.username ? ` (connecté : ${c.username})` : ''}.</p>
      <div className="lab">Combat du jour · {c.today}</div>
      <button className="card row" onClick={c.onAdminReset} style={{ textAlign: 'left' }}>
        <RotateCcw size={22} style={{ color: 'var(--secondary)' }} />
        <div className="grow"><b>Réinitialiser le combat du jour</b><div className="muted small">Efface ton résultat, ta progression et l’ordre de l’équipe pour rejouer</div></div>
      </button>
    </>
  )
}
