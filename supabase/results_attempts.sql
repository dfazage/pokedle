-- Système de cœurs : nombre d'essais utilisés par jour, et possibilité de rejouer après une défaite.
-- À exécuter dans l'éditeur SQL Supabase. Sans ce script le jeu fonctionne : les rejeux restent locaux (pas de remplacement en ligne).

-- 1) Nombre d'essais du jour (1 = premier essai offert ; au plus 3 rejeux, soit 4 essais, avec la réserve de 3 cœurs).
alter table public.results add column if not exists attempts smallint not null default 1 check (attempts between 1 and 4);

-- 2) Un joueur peut remplacer SA défaite du jour de jeu (voir reset_noon_paris.sql) par le résultat d'un rejeu. Une victoire n'est jamais modifiable.
grant update on public.results to authenticated;
drop policy if exists results_replace_loss_today on public.results;
create policy results_replace_loss_today on public.results
  for update to authenticated
  using (user_id = (select auth.uid()) and day_key = (now() at time zone 'utc')::date and result = 'loss')
  with check (user_id = (select auth.uid()) and day_key = (now() at time zone 'utc')::date);
