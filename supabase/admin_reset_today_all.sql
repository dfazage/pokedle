-- Reset du combat du jour pour tous les joueurs (admin). À exécuter dans l'éditeur SQL Supabase.
alter table public.daily_rerolls add column if not exists reset_n integer not null default 0;

create or replace function public.admin_reset_today_all()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare n integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.results where day_key = (now() at time zone 'utc')::date;
  insert into public.daily_rerolls (day_key, salt, reset_n)
  values ((now() at time zone 'utc')::date, 0, 1)
  on conflict (day_key) do update set reset_n = public.daily_rerolls.reset_n + 1
  returning reset_n into n;
  return n;
end;
$$;

create or replace function public.daily_reset_n(p_day date)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select reset_n from public.daily_rerolls where day_key = p_day), 0);
$$;

revoke all on function public.admin_reset_today_all() from public, anon;
grant execute on function public.admin_reset_today_all() to authenticated;
grant execute on function public.daily_reset_n(date) to anon, authenticated;
