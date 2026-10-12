-- Classement avec les POINTS des joueurs, calculés côté serveur (miroir de src/game/scoring.ts : si SCORING change, mettre à jour
-- les constantes ci-dessous). Ordre d'exécution dans l'éditeur SQL Supabase : trainer_tiers.sql, puis ce fichier.
-- Sans ce script le jeu fonctionne : le classement retombe sur leaderboard_v2 (victoires, séries) sans les points.

-- Colonnes lues par le calcul (idempotent : déjà ajoutées par results_hp_left.sql / results_attempts.sql).
alter table public.results add column if not exists hp_left smallint check (hp_left between 0 and 100);
alter table public.results add column if not exists attempts smallint not null default 1 check (attempts between 1 and 4);

create or replace function public.leaderboard_v3(limit_n integer default 50)
returns table(username text, wins bigint, best_streak integer, current_streak integer, won_today boolean, points bigint, points_today integer)
language sql stable security definer set search_path = '' as $$
  with w as (
    select r.*, r.day_key - (row_number() over (partition by r.user_id order by r.day_key))::int as grp
    from public.results r where r.result = 'win'
  ),
  st as (
    select w.*, (row_number() over (partition by w.user_id, w.grp order by w.day_key))::int as streak from w
  ),
  sc as (
    select st.user_id, st.day_key,
      round((
        coalesce(t.base, 50)::numeric                                                 -- base du dresseur (50 par défaut)
        * (0.5 + 0.5 * (0.45 * f.speed + 0.35 * f.hp + 0.2 * f.surv))                 -- plancher 50 % + performance
        * (1 + 0.05 * least(st.streak, 10))                                           -- série (plafond 10)
        + case when st.survivors = 6 then 10 else 0 end                               -- bonus sans K.O.
      ) * case coalesce(st.attempts, 1) when 1 then 1 when 2 then 0.75 when 3 then 0.5 else 0.25 end)  -- malus de rejeu
      as pts
    from st
    left join public.trainer_tiers t on t.gen = st.gen and t.trainer = st.trainer
    cross join lateral (
      select least(1, greatest(0, (40 - st.turns)::numeric / 32)) as speed,           -- 8 tours = max, 40 tours = 0
             least(1, greatest(0, coalesce(st.survivors, 0)::numeric / 6)) as surv,
             case when st.hp_left is null then least(1, greatest(0, coalesce(st.survivors, 0)::numeric / 6))
                  else least(1, greatest(0, st.hp_left::numeric / 100)) end as hp
    ) f
  ),
  pts as (
    select user_id, sum(pts)::bigint as total,
           coalesce(max(pts) filter (where day_key = (now() at time zone 'utc')::date), 0)::int as today
    from sc group by user_id
  ),
  runs as (
    select user_id, count(*)::int as len, max(day_key) as last_day from st group by user_id, grp
  ),
  s as (
    select user_id, sum(len) as wins, max(len) as best,
           coalesce(max(len) filter (where last_day >= (now() at time zone 'utc')::date - 1), 0) as cur
    from runs group by user_id
  )
  select p.username, coalesce(s.wins, 0)::bigint, coalesce(s.best, 0)::int, coalesce(s.cur, 0)::int,
         exists (select 1 from public.results r where r.user_id = p.id and r.day_key = (now() at time zone 'utc')::date and r.result = 'win'),
         coalesce(pts.total, 0)::bigint, coalesce(pts.today, 0)::int
  from public.profiles p
  left join s on s.user_id = p.id
  left join pts on pts.user_id = p.id
  order by 6 desc, 2 desc, 3 desc, 1
  limit greatest(1, least(limit_n, 200));
$$;
grant execute on function public.leaderboard_v3(integer) to anon, authenticated;
