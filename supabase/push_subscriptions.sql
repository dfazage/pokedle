-- Notifications push (« le combat du jour est disponible », envoyées à 12h Paris par l'Edge Function send-daily-push).
-- À exécuter dans l'éditeur SQL Supabase (idempotent). Sans ce script la carte Notifications des réglages échoue à l'activation.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  lang text not null default 'en' check (lang in ('fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Aucune politique : la table n'est lisible/modifiable que par le service role (Edge Function) et par les fonctions ci-dessous.
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Enregistre la souscription de l'appareil pour le compte connecté (réattribuée si l'appareil change de compte).
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'en')
returns void
language sql security definer set search_path = '' as $$
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, lang)
  select p_endpoint, auth.uid(), p_p256dh, p_auth, case when p_lang = 'fr' then 'fr' else 'en' end
  where auth.uid() is not null
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, updated_at = now();
$$;
revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Supprime la souscription de cet appareil (désactivation depuis les réglages).
create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.delete_push_subscription(text) to authenticated;
