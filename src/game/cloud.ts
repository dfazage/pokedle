import { createClient, type User } from '@supabase/supabase-js'
import type { DayRecord } from './history'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** null si les variables d'environnement manquent : le jeu reste jouable en local. */
export const supabase = url && key ? createClient(url, key) : null

/** URL publique de l'app (sous-chemin inclus, ex. https://user.github.io/pokedle/), utilisée dans les liens des e-mails
 *  (confirmation, mot de passe oublié). VITE_SITE_URL force une URL ; sinon origine courante + base de Vite. */
export const siteUrl = (): string => {
  const forced = import.meta.env.VITE_SITE_URL as string | undefined
  return forced || window.location.origin + import.meta.env.BASE_URL
}

export interface LeaderRow {
  username: string
  wins: number
  best_streak: number
  current_streak: number
  won_today: boolean
  /** Points cumulés et points du jour : absents tant que supabase/leaderboard_points.sql n'est pas appliqué. */
  points?: number
  points_today?: number
}

/** Pseudo valide (3 à 20 caractères, lettres/chiffres/_ - .) tiré d'une chaîne quelconque ; null si inexploitable. */
function cleanName(raw: string): string | null {
  const n = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '').slice(0, 20)
  return n.length >= 3 ? n : null
}

export async function ensureProfile(user: User): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
  if (data?.username) return data.username
  const meta = user.user_metadata ?? {}
  const wanted = String(meta.username ?? '').trim()
  if (wanted.length >= 3) {
    const { error } = await supabase.from('profiles').insert({ id: user.id, username: wanted })
    return error ? null : wanted
  }
  // Connexion Google (ou autre OAuth) : pas de pseudo saisi, on le déduit du nom du compte, puis on désambiguïse si pris.
  const base = cleanName(String(meta.full_name ?? meta.name ?? '')) ?? cleanName(String(user.email ?? '').split('@')[0]) ?? 'Dresseur'
  for (let i = 0; i < 6; i++) {
    const suffix = i === 0 ? '' : String(Math.floor(Math.random() * 9000) + 1000)
    const name = base.slice(0, 20 - suffix.length) + suffix
    const { error } = await supabase.from('profiles').insert({ id: user.id, username: name })
    if (!error) return name
    if (error.code !== '23505') return null // autre erreur que « pseudo déjà pris »
  }
  return null
}

/** La colonne `hp_left` est ajoutée par supabase/results_hp_left.sql ; tant qu'elle n'existe pas, on s'en passe. */
const missingColumn = (e: { code?: string } | null) => e?.code === '42703' || e?.code === 'PGRST204'

export type RenameResult = 'ok' | 'taken' | 'invalid' | 'error'

/** Change (ou crée, si le profil n'existe pas encore) le pseudo du compte connecté. 3 à 20 caractères, unique. */
export async function updateUsername(raw: string): Promise<RenameResult> {
  if (!supabase) return 'error'
  const name = raw.trim()
  if (name.length < 3 || name.length > 20) return 'invalid'
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 'error'
  const { error } = await supabase.from('profiles').upsert({ id: u.user.id, username: name }, { onConflict: 'id' })
  if (!error) return 'ok'
  return error.code === '23505' ? 'taken' : 'error'
}

/** Colonnes optionnelles de `results` (supabase/results_hp_left.sql et results_attempts.sql). Tant qu'une colonne n'existe pas
 *  côté serveur, on s'en passe ; la détection est mémorisée pour la session. */
const optional = { hp_left: true, attempts: true }
const optionalSets = (): ('hp_left' | 'attempts')[][] => {
  const both = (['hp_left', 'attempts'] as const).filter((c) => optional[c])
  const sets: ('hp_left' | 'attempts')[][] = [both]
  if (both.length === 2) sets.push(['hp_left'], ['attempts'])
  if (both.length) sets.push([])
  return sets
}
/** Exécute `run` avec le plus de colonnes optionnelles possible, en retirant celles que le serveur ne connaît pas. */
async function withOptionalColumns<T extends { error: { code?: string } | null }>(run: (cols: ('hp_left' | 'attempts')[]) => PromiseLike<T>): Promise<T> {
  let res = await run(optionalSets()[0])
  for (const set of optionalSets().slice(1)) {
    if (!missingColumn(res.error)) break
    res = await run(set)
    if (!missingColumn(res.error)) {
      for (const c of ['hp_left', 'attempts'] as const) if (!set.includes(c)) optional[c] = false
    }
  }
  return res
}

/** Faux une fois constaté que le serveur n'a pas la colonne `attempts` : les rejeux ne pourraient pas y être enregistrés. */
export const serverSupportsReplay = () => optional.attempts

export async function fetchHistory(): Promise<DayRecord[]> {
  if (!supabase) return []
  const { data, error } = await withOptionalColumns((cols) =>
    supabase!.from('results').select(['day_key', 'result', 'turns', 'trainer', 'gen', 'survivors', 'kos', ...cols].join(', ')).order('day_key', { ascending: true }),
  )
  if (error || !data) return []
  return (data as unknown as Record<string, any>[]).map((r) => ({
    dayKey: r.day_key, result: r.result, turns: r.turns, trainer: r.trainer, gen: r.gen,
    survivors: r.survivors ?? undefined, kos: r.kos ?? undefined, hpLeft: r.hp_left ?? undefined, attempts: r.attempts ?? undefined,
  }))
}

/** Enregistre le résultat du jour. Le serveur refuse tout autre jour que le jour UTC courant. Un doublon est refusé, sauf pour un rejeu
 *  (attempts > 1) qui remplace une défaite du même jour par le nouveau résultat (politique SQL dans supabase/results_attempts.sql). */
export async function submitResult(rec: DayRecord, choices: string[]): Promise<'ok' | 'duplicate' | 'error'> {
  if (!supabase) return 'error'
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 'error'
  const row = {
    result: rec.result,
    turns: rec.turns,
    trainer: rec.trainer,
    gen: rec.gen,
    survivors: rec.survivors ?? null,
    kos: rec.kos ?? null,
    choices,
  }
  const extra = (cols: ('hp_left' | 'attempts')[]) => ({
    ...(cols.includes('hp_left') ? { hp_left: rec.hpLeft ?? null } : {}),
    ...(cols.includes('attempts') ? { attempts: rec.attempts ?? 1 } : {}),
  })
  const ins = await withOptionalColumns((cols) => supabase!.from('results').insert({ user_id: u.user!.id, day_key: rec.dayKey, ...row, ...extra(cols) }))
  if (!ins.error) return 'ok'
  if (ins.error.code !== '23505') return 'error'
  if ((rec.attempts ?? 1) <= 1) return 'duplicate'
  // Rejeu : on remplace la défaite enregistrée plus tôt dans la journée (jamais une victoire).
  const upd = await withOptionalColumns((cols) =>
    supabase!.from('results').update({ ...row, ...extra(cols) }).eq('user_id', u.user!.id).eq('day_key', rec.dayKey).eq('result', 'loss').select('day_key'),
  )
  return !upd.error && (upd.data?.length ?? 0) > 0 ? 'ok' : upd.error ? 'error' : 'duplicate'
}

/** Vrai si le compte connecté figure dans la table `admins` (contrôle réel côté serveur). */
export async function fetchIsAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('is_admin')
  return !error && data === true
}

/** Sel de re-roll du jour (0 par défaut ; incrémenté par un admin). Lisible par tous pour que le défi reste identique. */
export async function fetchDailySalt(day: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc('daily_salt', { p_day: day })
  return error || typeof data !== 'number' ? 0 : data
}

/** Admin uniquement : re-tire le dresseur et la team du jour pour tout le monde. Renvoie le nouveau sel, ou null. */
export async function adminRerollToday(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_reroll_today')
  return error || typeof data !== 'number' ? null : data
}

/** Admin uniquement : supprime le résultat du jour (UTC) du compte connecté pour pouvoir rejouer. */
export async function adminResetToday(): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.rpc('admin_reset_today')
  return !error
}

/** Admin uniquement : efface le combat du jour de TOUS les joueurs. Renvoie le nouveau numéro de reset, ou null. */
export async function adminResetTodayAll(): Promise<number | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_reset_today_all')
  return error || typeof data !== 'number' ? null : data
}

/** Numéro de reset du jour (0 par défaut ; incrémenté quand un admin réinitialise pour tous). */
export async function fetchDailyResetN(day: string): Promise<number> {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc('daily_reset_n', { p_day: day })
  return error || typeof data !== 'number' ? 0 : data
}

export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  if (!supabase) return []
  // v3 = avec les points (supabase/leaderboard_points.sql) ; repli sur v2 (victoires et séries seulement) si absent.
  const v3 = await supabase.rpc('leaderboard_v3', { limit_n: 50 })
  if (!v3.error && v3.data) return (v3.data as LeaderRow[]).map((r) => ({ ...r, points: Number(r.points ?? 0), points_today: Number(r.points_today ?? 0) }))
  const { data, error } = await supabase.rpc('leaderboard_v2', { limit_n: 50 })
  return error || !data ? [] : (data as LeaderRow[])
}

export async function fetchWorldStats(day: string): Promise<{ players: number; wins: number } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('daily_stats', { p_day: day })
  const row = Array.isArray(data) ? data[0] : null
  return error || !row ? null : { players: Number(row.players), wins: Number(row.wins) }
}
