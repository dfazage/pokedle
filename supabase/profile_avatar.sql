-- Icône de profil choisie par le joueur (id d'un médaillon de public/avatars, ex. 'pikachu').
-- Sans ce script le choix reste mémorisé sur l'appareil seulement ; avec lui il suit le compte et apparaît dans le classement.
-- À exécuter dans l'éditeur SQL Supabase (idempotent).

alter table public.profiles add column if not exists avatar text check (avatar is null or char_length(avatar) <= 32);

-- Avatars des pseudos donnés (le classement est en security definer : la table profiles n'est pas lisible directement).
create or replace function public.profile_avatars(names text[])
returns table(username text, avatar text)
language sql stable security definer set search_path = '' as $$
  select p.username, p.avatar from public.profiles p where p.username = any(names) and p.avatar is not null;
$$;
grant execute on function public.profile_avatars(text[]) to anon, authenticated;
