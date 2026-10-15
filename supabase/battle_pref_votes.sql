-- Sondage ponctuel : « 1 ou 2 combats par jour ? » (notif affichée une seule fois à chaque joueur connecté).
-- À exécuter dans l'éditeur SQL Supabase (idempotent). Sans ce script le jeu fonctionne : la notif ne s'affiche simplement pas.

create table if not exists public.battle_pref_votes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  choice smallint not null check (choice in (1, 2)),
  created_at timestamptz not null default now()
);

-- Aucune politique : la table n'est lisible/modifiable que via les fonctions ci-dessous (et le service role).
alter table public.battle_pref_votes enable row level security;
revoke all on public.battle_pref_votes from anon, authenticated;

-- Enregistre le vote du compte connecté. Un seul vote par joueur : un second appel est ignoré.
create or replace function public.submit_battle_pref(p_choice smallint)
returns void
language sql security definer set search_path = '' as $$
  insert into public.battle_pref_votes (user_id, choice)
  select auth.uid(), p_choice
  where auth.uid() is not null and p_choice in (1, 2)
  on conflict (user_id) do nothing;
$$;
revoke all on function public.submit_battle_pref(smallint) from public, anon;
grant execute on function public.submit_battle_pref(smallint) to authenticated;

-- Vote du compte connecté (null s'il n'a pas encore répondu) : décide si la notif s'affiche, y compris sur un autre appareil.
create or replace function public.my_battle_pref()
returns smallint
language sql stable security definer set search_path = '' as $$
  select choice from public.battle_pref_votes where user_id = auth.uid();
$$;
revoke all on function public.my_battle_pref() from public, anon;
grant execute on function public.my_battle_pref() to authenticated;

-- Résultats du sondage (admins uniquement) : nombre de votes par choix.
create or replace function public.battle_pref_stats()
returns table (choice smallint, votes bigint)
language sql stable security definer set search_path = '' as $$
  select v.choice, count(*)::bigint
  from public.battle_pref_votes v
  where exists (select 1 from public.admins a where a.user_id = auth.uid())
  group by v.choice
  order by v.choice;
$$;
revoke all on function public.battle_pref_stats() from public, anon;
grant execute on function public.battle_pref_stats() to authenticated;
