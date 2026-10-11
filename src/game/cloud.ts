import { createClient, type User } from '@supabase/supabase-js'
import type { DayRecord } from './history'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** null si les variables d'environnement manquent : le jeu reste jouable en local. */
export const supabase = url && key ? createClient(url, key) : null

export interface LeaderRow {
  username: string
  wins: number
  best_streak: number
  current_streak: number
  won_today: boolean
}

export async function ensureProfile(user: User): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
  if (data?.username) return data.username
  const wanted = String(user.user_metadata?.username ?? '').trim()
  if (wanted.length < 3) return null
  const { error } = await supabase.from('profiles').insert({ id: user.id, username: wanted })
  return error ? null : wanted
}

export async function fetchHistory(): Promise<DayRecord[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('results')
    .select('day_key, result, turns, trainer, gen, survivors, kos')
    .order('day_key', { ascending: true })
  if (error || !data) return []
  return data.map((r) => ({ dayKey: r.day_key, result: r.result, turns: r.turns, trainer: r.trainer, gen: r.gen, survivors: r.survivors ?? undefined, kos: r.kos ?? undefined }))
}

/** Enregistre le résultat du jour. Le serveur refuse tout autre jour que le jour UTC courant et tout doublon. */
export async function submitResult(rec: DayRecord, choices: string[]): Promise<'ok' | 'duplicate' | 'error'> {
  if (!supabase) return 'error'
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return 'error'
  const { error } = await supabase.from('results').insert({
    user_id: u.user.id,
    day_key: rec.dayKey,
    result: rec.result,
    turns: rec.turns,
    trainer: rec.trainer,
    gen: rec.gen,
    survivors: rec.survivors ?? null,
    kos: rec.kos ?? null,
    choices,
  })
  if (!error) return 'ok'
  return error.code === '23505' ? 'duplicate' : 'error'
}

export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('leaderboard_v2', { limit_n: 50 })
  return error || !data ? [] : (data as LeaderRow[])
}

export async function fetchWorldStats(day: string): Promise<{ players: number; wins: number } | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('daily_stats', { p_day: day })
  const row = Array.isArray(data) ? data[0] : null
  return error || !row ? null : { players: Number(row.players), wins: Number(row.wins) }
}
