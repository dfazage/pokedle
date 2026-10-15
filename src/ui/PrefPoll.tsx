import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { fetchMyBattlePref, submitBattlePref } from '../game/cloud'
import { ASK_DELAY_MS, loadPref, savePref, type PrefChoice } from '../game/prefPoll'
import { t, useLang } from '../i18n'

/**
 * Notif ponctuelle qui remonte par le bas : « 1 ou 2 combats par jour ? ». Une seule fois par compte (le serveur retient le vote).
 * `hold` la masque sans la perdre (autre écran que l'accueil, bandeau de mise à jour affiché).
 */
export function PrefPoll({ userId, hold }: { userId: string | null; hold: boolean }) {
  return <PrefPollFor key={userId ?? 'anon'} userId={userId} hold={hold} /> // autre compte = état neuf (une question par compte)
}

function PrefPollFor({ userId, hold }: { userId: string | null; hold: boolean }) {
  useLang()
  const [step, setStep] = useState<'idle' | 'ask' | 'thanks'>('idle')
  const [choice, setChoice] = useState<PrefChoice>(1)

  useEffect(() => {
    if (!userId || loadPref(userId)) return
    let alive = true
    let timer = 0
    void fetchMyBattlePref().then((mine) => {
      if (!alive || mine === undefined) return // serveur injoignable ou script SQL non appliqué : on ne pose pas la question
      if (mine) {
        savePref(userId, mine) // déjà répondu (autre appareil)
        return
      }
      timer = window.setTimeout(() => alive && setStep('ask'), ASK_DELAY_MS)
    })
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [userId])

  useEffect(() => {
    if (step !== 'thanks') return
    const id = window.setTimeout(() => setStep('idle'), 3200)
    return () => window.clearTimeout(id)
  }, [step])

  if (hold || step === 'idle') return null

  const vote = (c: PrefChoice) => {
    setChoice(c)
    setStep('thanks')
    // Le drapeau local n'est posé que si le serveur a bien enregistré : sinon la question revient au prochain lancement.
    void submitBattlePref(c).then((ok) => {
      if (ok && userId) savePref(userId, c)
    })
  }

  if (step === 'thanks')
    return (
      <div className="prefpoll prefpoll-thanks" role="status" aria-live="polite">
        <span className="prefpoll-ok" aria-hidden><Check size={22} strokeWidth={3} /></span>
        <div className="grow">
          <div className="prefpoll-title">{t('prefs.poll.thanks.title')}</div>
          <div className="prefpoll-body muted">{t(choice === 1 ? 'prefs.poll.thanks.one' : 'prefs.poll.thanks.two')}</div>
        </div>
      </div>
    )

  return (
    <section className="prefpoll" aria-labelledby="prefpoll-title">
      <div>
        <div className="prefpoll-eyebrow">{t('prefs.poll.eyebrow')}</div>
        <h2 id="prefpoll-title" className="prefpoll-title">{t('prefs.poll.title')}</h2>
        <p className="prefpoll-body muted">{t('prefs.poll.body')}</p>
      </div>
      <div className="prefpoll-opts">
        <button type="button" className="prefpoll-opt" onClick={() => vote(1)}>
          <b>1</b>
          <span>{t('prefs.poll.one')}</span>
        </button>
        <button type="button" className="prefpoll-opt" onClick={() => vote(2)}>
          <b>2</b>
          <span>{t('prefs.poll.two')}</span>
        </button>
      </div>
    </section>
  )
}
