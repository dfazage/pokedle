-- PV restants de l'équipe du joueur en fin de combat (en %, 0-100), utilisés par le calcul des points.
-- À exécuter dans l'éditeur SQL Supabase. Sans cette colonne le jeu fonctionne : les points retombent sur la part de survivants.
alter table public.results add column if not exists hp_left smallint check (hp_left between 0 and 100);
