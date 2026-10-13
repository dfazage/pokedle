-- Connexion par pseudo : renvoie l'e-mail du compte (provider « email ») associé à un pseudo, pour que le client puisse
-- appeler signInWithPassword({ email, password }). Comparaison insensible à la casse. À exécuter dans l'éditeur SQL Supabase.
-- Compromis : permet de retrouver l'e-mail d'un pseudo connu (le pseudo est public via le classement).
create or replace function public.email_for_username(uname text)
returns text
language sql stable security definer set search_path = '' as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(btrim(uname))
    and u.email is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
  limit 1
$$;
revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;
