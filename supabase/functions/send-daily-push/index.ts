// Edge Function : envoie la notification « le combat du jour est disponible » à tous les appareils abonnés.
// Appelée par pg_cron (supabase/push_cron.sql) à 10h et 11h UTC ; ne s'exécute que lorsqu'il est 12h à Paris (reset du jeu).
//
// Secrets requis (supabase secrets set …) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… ou https://…), CRON_SECRET.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement. Déploiement : supabase functions deploy send-daily-push --no-verify-jwt
// (l'appel est protégé par l'en-tête x-cron-secret, pas par un JWT).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const RESET_HOUR_PARIS = 12 // miroir de RESET_HOUR_PARIS dans src/game/rng.ts

const MESSAGES = {
  fr: { title: 'Le combat du jour est dispo', body: 'Un nouveau dresseur t’attend. Relève le défi et garde ta série !' },
  en: { title: 'Today’s battle is ready', body: 'A new trainer is waiting. Take the challenge and keep your streak alive!' },
} as const

const parisHour = (d = new Date()): number =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(d))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Comparaison à durée constante du secret partagé. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET') ?? ''
  if (!secret || !sameSecret(req.headers.get('x-cron-secret') ?? '', secret)) return json({ error: 'unauthorized' }, 401)

  // Essai manuel : { "force": true } envoie hors horaire (ex. pour tester sur son propre téléphone avec "only_user_id").
  const opts = (await req.json().catch(() => ({}))) as { force?: boolean; only_user_id?: string }
  if (!opts.force && parisHour() !== RESET_HOUR_PARIS) return json({ skipped: true, reason: 'not 12h in Paris' })

  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!pub || !priv) return json({ error: 'VAPID keys missing' }, 500)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@pokebadle.fun', pub, priv)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let query = db.from('push_subscriptions').select('endpoint, p256dh, auth, lang')
  if (opts.only_user_id) query = query.eq('user_id', opts.only_user_id)
  const { data: subs, error } = await query
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  const expired: string[] = []
  const failed: string[] = []
  const queue = [...(subs ?? [])]
  // 20 envois en parallèle : assez pour quelques milliers d'abonnés sans saturer l'Edge Function.
  await Promise.all(
    Array.from({ length: 20 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const msg = MESSAGES[s.lang === 'fr' ? 'fr' : 'en']
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: msg.title, body: msg.body, url: './', tag: 'daily-battle' }),
            { TTL: 12 * 3600, urgency: 'normal' }, // inutile après le reset suivant ; le service push garde le message tant que l'appareil est éteint
          )
          sent++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) expired.push(s.endpoint) // abonnement mort (données du site effacées, permission retirée…)
          else failed.push(`${code ?? 'err'}`)
        }
      }
    }),
  )

  if (expired.length) await db.from('push_subscriptions').delete().in('endpoint', expired)
  return json({ total: subs?.length ?? 0, sent, expired: expired.length, failed: failed.length })
})
