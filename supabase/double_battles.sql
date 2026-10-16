-- Deux combats par jour (12h et 18h heure de Kuala Lumpur), à partir du 17/10/2026 à 12h KL (04:00 UTC).
-- À exécuter dans l'éditeur SQL Supabase (idempotent). RÉTRO-COMPATIBLE : tant que l'instant de bascule n'est pas atteint, rien ne change
-- pour le jeu actuel (un combat par jour, reset 12h Paris) ; le même instant est codé dans le front (DOUBLE_FROM_MS dans src/game/rng.ts).
--
-- Modèle : un « jour de jeu » (clé = date de sa FIN, comme avant) contient 2 combats (slot 1 et 2). Il commence à 12h KL (04:00 UTC) ;
-- le combat n°1 est publié à ce moment, le n°2 six heures plus tard (18h KL, 10:00 UTC), et les deux restent jouables jusqu'à la fin du jour.
-- La série compte des JOURS (un jour est gagné dès qu'un de ses combats l'est) ; les points et les cœurs se comptent par combat.

-- 1) Colonne `slot` : toutes les lignes existantes sont des combats n°1. La clé primaire accepte maintenant un 2e combat par jour.
alter table public.results add column if not exists slot smallint not null default 1;
alter table public.results drop constraint if exists results_slot_check;
alter table public.results add constraint results_slot_check check (slot in (1, 2));
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.results'::regclass and c.contype = 'p'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['day_key', 'slot', 'user_id']
  ) then
    alter table public.results drop constraint results_pkey;
    alter table public.results add constraint results_pkey primary key (user_id, day_key, slot);
  end if;
end $$;

-- 2) Jour de jeu et combats publiés. Avant la bascule : formule d'origine (12h Paris). Après : jour de 12h KL à 12h KL, heure fixe (UTC+8).
create or replace function public.game_day() returns date
language sql stable
set search_path = ''
as $$
  select case
    when now() >= timestamptz '2026-10-17 04:00:00+00' then ((now() at time zone 'utc') + interval '20 hours')::date
    else greatest(((now() at time zone 'Europe/Paris') + interval '12 hours')::date, case when now() >= timestamptz '2026-10-12 09:10:00+00' then date '2026-10-13' else date '2026-10-12' end)
  end
$$;
grant execute on function public.game_day() to anon, authenticated;

-- Nombre de combats déjà publiés pour le jour de jeu en cours : 1, puis 2 à partir de 18h KL (6 h après le début du jour).
create or replace function public.game_slots_open() returns smallint
language sql stable
set search_path = ''
as $$
  select (case when now() >= timestamptz '2026-10-17 04:00:00+00' and (((now() at time zone 'utc') - interval '4 hours')::time) >= time '06:00' then 2 else 1 end)::smallint
$$;
grant execute on function public.game_slots_open() to anon, authenticated;

-- 3) Politiques RLS de `results` : on n'enregistre un combat que pour le jour courant et un combat déjà publié ; un rejeu remplace une défaite.
drop policy if exists results_insert_today on public.results;
create policy results_insert_today on public.results for insert to authenticated
  with check (user_id = (select auth.uid()) and day_key = public.game_day() and slot <= public.game_slots_open());
drop policy if exists results_replace_loss_today on public.results;
create policy results_replace_loss_today on public.results for update to authenticated
  using (user_id = (select auth.uid()) and day_key = public.game_day() and result = 'loss')
  with check (user_id = (select auth.uid()) and day_key = public.game_day() and slot <= public.game_slots_open());

-- 4) Statistiques mondiales d'un jour (et d'un combat si `p_slot` est renseigné). Remplace daily_stats(date), conservée pour les anciens clients.
create or replace function public.daily_stats_v2(p_day date, p_slot smallint default null)
returns table(players bigint, wins bigint)
language sql stable security definer set search_path = '' as $$
  select count(*)::bigint, count(*) filter (where result = 'win')::bigint
  from public.results where day_key = p_day and (p_slot is null or slot = p_slot);
$$;
grant execute on function public.daily_stats_v2(date, smallint) to anon, authenticated;

-- 5) Classements Jour / Semaine / Saison. Mêmes barème et colonnes que leaderboard_v3/v4 d'origine, avec :
--    - série en JOURS (un jour compte dès qu'un de ses combats est gagné) ;
--    - points du jour = somme des combats du jour ; victoires = nombre de combats gagnés.
create or replace function public.leaderboard_v4(limit_n integer default 50)
returns table(username text, wins bigint, best_streak integer, current_streak integer, won_today boolean, points bigint, points_today integer, points_week integer, points_season integer)
language sql stable security definer set search_path = '' as $$
  with wd as (
    select distinct r.user_id, r.day_key from public.results r where r.result = 'win'
  ),
  wg as (
    select wd.*, wd.day_key - (row_number() over (partition by wd.user_id order by wd.day_key))::int as grp from wd
  ),
  ws as (
    select wg.*, (row_number() over (partition by wg.user_id, wg.grp order by wg.day_key))::int as streak from wg
  ),
  sc as (
    select r.user_id, r.day_key,
      round((
        coalesce(t.base, 50)::numeric                                                 -- base du dresseur (50 par défaut)
        * (0.5 + 0.5 * (0.45 * f.speed + 0.35 * f.hp + 0.2 * f.surv))                 -- plancher 50 % + performance
        * (1 + 0.05 * least(ws.streak, 10))                                           -- série en jours (plafond 10)
        + case when r.survivors = 6 then 10 else 0 end                                -- bonus sans K.O.
      ) * case coalesce(r.attempts, 1) when 1 then 1 when 2 then 0.75 when 3 then 0.5 else 0.25 end)  -- malus de rejeu
      as pts
    from public.results r
    join ws on ws.user_id = r.user_id and ws.day_key = r.day_key
    left join public.trainer_tiers t on t.gen = r.gen and t.trainer = r.trainer
    cross join lateral (
      select least(1, greatest(0, (40 - r.turns)::numeric / 32)) as speed,           -- 8 tours = max, 40 tours = 0
             least(1, greatest(0, coalesce(r.survivors, 0)::numeric / 6)) as surv,
             case when r.hp_left is null then least(1, greatest(0, coalesce(r.survivors, 0)::numeric / 6))
                  else least(1, greatest(0, r.hp_left::numeric / 100)) end as hp
    ) f
    where r.result = 'win'
  ),
  pts as (
    select user_id, sum(pts)::bigint as total,
           coalesce(sum(pts) filter (where day_key = public.game_day()), 0)::int as today,
           coalesce(sum(pts) filter (where day_key >= date_trunc('week', public.game_day())::date), 0)::int as week,     -- semaine : du lundi (jour de jeu) à aujourd'hui
           coalesce(sum(pts) filter (where day_key >= date_trunc('month', public.game_day())::date), 0)::int as season   -- saison : le mois en cours
    from sc group by user_id
  ),
  runs as (
    select user_id, count(*)::int as len, max(day_key) as last_day from ws group by user_id, grp
  ),
  s as (
    select user_id, max(len) as best,
           coalesce(max(len) filter (where last_day >= public.game_day() - 1), 0) as cur
    from runs group by user_id
  ),
  w as (
    select user_id, count(*)::bigint as wins from public.results where result = 'win' group by user_id
  )
  select p.username, coalesce(w.wins, 0)::bigint, coalesce(s.best, 0)::int, coalesce(s.cur, 0)::int,
         exists (select 1 from public.results r where r.user_id = p.id and r.day_key = public.game_day() and r.result = 'win'),
         coalesce(pts.total, 0)::bigint, coalesce(pts.today, 0)::int, coalesce(pts.week, 0)::int, coalesce(pts.season, 0)::int
  from public.profiles p
  left join w on w.user_id = p.id
  left join s on s.user_id = p.id
  left join pts on pts.user_id = p.id
  order by 6 desc, 2 desc, 3 desc, 1
  limit greatest(1, least(limit_n, 200));
$$;
grant execute on function public.leaderboard_v4(integer) to anon, authenticated;

-- 6) Notifications push : un envoi à 12h KL (combat n°1) et un à 18h KL (combat n°2), heure fixe UTC (04:00 et 10:00).
--    L'Edge Function send-daily-push reçoit { "slot": 1 | 2 } et n'a plus de test d'heure de Paris. Prérequis : push_cron.sql déjà appliqué
--    (secret du coffre-fort). Les travaux existent déjà : cron.schedule met à jour celui qui porte le même nom ; l'ancien appel de 11h UTC
--    (heure d'hiver à Paris) n'a plus lieu d'être et est simplement désactivé.
select cron.schedule('daily-push-04utc', '0 4 * * *', $job$
  select net.http_post(
    url := 'https://gcjsqxogywmgslkqoojq.supabase.co/functions/v1/send-daily-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{"slot":1}'::jsonb
  );
$job$);

select cron.schedule('daily-push-10utc', '0 10 * * *', $job$
  select net.http_post(
    url := 'https://gcjsqxogywmgslkqoojq.supabase.co/functions/v1/send-daily-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{"slot":2}'::jsonb
  );
$job$);

select cron.alter_job(jobid, active := false) from cron.job where jobname = 'daily-push-11utc';
