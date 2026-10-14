-- Gen 5 (Noir 2 / Blanc 2) : la contrainte d'origine n'accepte que les générations 1 à 4, un résultat gen 5 serait rejeté.
-- À exécuter dans Supabase (SQL Editor) AVANT le 15/10/2026 (GEN5_FROM dans src/game/daily.ts), puis supabase/trainer_tiers.sql
-- (points de base des dresseurs gen 5 pour le classement).
alter table public.results drop constraint if exists results_gen_check;
alter table public.results add constraint results_gen_check check (gen >= 1 and gen <= 5);
