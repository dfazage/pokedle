-- Reset quotidien à 12h00 heure de Paris (au lieu de minuit UTC). Un jour de jeu va de 12h00 à 12h00 et porte la date de Paris
-- de son début : la clé reste une date, les clés restent consécutives (séries et statistiques inchangées, aucune donnée modifiée).
-- Miroir de gameDayKey() dans src/game/rng.ts. À exécuter en même temps que le déploiement du front (entre 12h Paris et minuit UTC
-- la clé du jour est identique à l'ancienne clé UTC, donc sans effet visible).
create or replace function public.game_day() returns date
language sql stable
set search_path = ''
as $$ select greatest(((now() at time zone 'Europe/Paris') - interval '12 hours')::date, date '2026-10-12') $$; -- plancher = jour du lancement (cf. LAUNCH_DAY dans rng.ts)
grant execute on function public.game_day() to anon, authenticated;

-- Fonctions : on remplace chaque `(now() at time zone 'utc')::date` par `public.game_day()` en réécrivant leur définition actuelle.
do $$
declare f record;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.proname <> 'game_day'
      and pg_get_functiondef(p.oid) like '%(now() at time zone ''utc'')::date%'
  loop
    execute replace(f.def, '(now() at time zone ''utc'')::date', 'public.game_day()');
  end loop;
end $$;

-- Politiques RLS de results : insertion et remplacement d'une défaite pour le jour de jeu courant uniquement.
drop policy if exists results_insert_today on public.results;
create policy results_insert_today on public.results for insert to authenticated
  with check (user_id = (select auth.uid()) and day_key = public.game_day());
drop policy if exists results_replace_loss_today on public.results;
create policy results_replace_loss_today on public.results for update to authenticated
  using (user_id = (select auth.uid()) and day_key = public.game_day() and result = 'loss')
  with check (user_id = (select auth.uid()) and day_key = public.game_day());
