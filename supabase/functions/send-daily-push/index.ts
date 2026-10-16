// Edge Function : envoie la notification « un combat est disponible » à tous les appareils abonnés.
// Appelée par pg_cron (supabase/double_battles.sql) avec { "slot": 1 } à 04:00 UTC (12h Kuala Lumpur) et { "slot": 2 } à 10:00 UTC (18h KL),
// à partir de la bascule vers 2 combats par jour (17/10/2026 12h KL). Avant la bascule, seul le créneau de 10:00 UTC envoie
// (« le combat du jour », comme avant) ; l'appel de 04:00 UTC est ignoré.
//
// Secrets requis (supabase secrets set …) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:… ou https://…), CRON_SECRET.
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement. Déploiement : supabase functions deploy send-daily-push --no-verify-jwt
// (l'appel est protégé par l'en-tête x-cron-secret, pas par un JWT).
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const DOUBLE_FROM_MS = Date.UTC(2026, 9, 17, 4, 0) // miroir de DOUBLE_FROM_MS dans src/game/rng.ts

const MESSAGES = {
  // Avant la bascule : un seul combat par jour.
  single: {
    fr: { title: 'Le combat du jour est dispo', body: 'Un nouveau dresseur t’attend. Relève le défi et garde ta série !' },
    en: { title: 'Today’s battle is ready', body: 'A new trainer is waiting. Take the challenge and keep your streak alive!' },
  },
  1: {
    fr: { title: 'Combat 1/2 dispo', body: 'Un nouveau dresseur t’attend. Lance le premier combat du jour et garde ta série !' },
    en: { title: 'Battle 1/2 is ready', body: 'A new trainer is waiting. Take the first battle of the day and keep your streak alive!' },
  },
  2: {
    fr: { title: 'Combat 2/2 dispo', body: 'Le deuxième combat du jour est ouvert. Un nouveau dresseur t’attend !' },
    en: { title: 'Battle 2/2 is ready', body: 'The second battle of the day is open. A new trainer is waiting!' },
  },
} as const

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
  const opts = (await req.json().catch(() => ({}))) as { force?: boolean; only_user_id?: string; slot?: number }
  const slot = opts.slot === 2 ? 2 : 1
  const doubled = Date.now() >= DOUBLE_FROM_MS - 5 * 60_000 // le créneau de 04:00 UTC du 17/10 tombe pile sur la bascule (tolérance de 5 min)
  if (!opts.force && !doubled && slot === 1) return json({ skipped: true, reason: 'single battle per day until 2026-10-17 12h KL' })

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
        const msg = MESSAGES[doubled ? slot : 'single'][s.lang === 'fr' ? 'fr' : 'en']
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: msg.title, body: msg.body, url: './', tag: doubled ? `daily-battle-${slot}` : 'daily-battle' }),
            { TTL: 6 * 3600, urgency: 'normal' }, // le service push garde le message tant que l'appareil est éteint ; inutile après quelques heures
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
