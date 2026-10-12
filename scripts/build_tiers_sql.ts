// Génère supabase/trainer_tiers.sql : points de base par dresseur (miroir de tiers.json + SCORING.baseByClass), utilisés par le
// classement côté serveur. À relancer si tiers.json ou SCORING.baseByClass changent, puis réexécuter le SQL dans Supabase.
// Usage : npx tsx scripts/build_tiers_sql.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { SCORING } from '../src/game/scoring'

const tiers = JSON.parse(readFileSync(new URL('../src/data/tiers.json', import.meta.url), 'utf8')) as Record<string, string>
const q = (s: string) => `'${s.replace(/'/g, "''")}'`
const rows = Object.entries(tiers).map(([k, cls]) => {
  const i = k.indexOf('|')
  return `  (${Number(k.slice(0, i))}, ${q(k.slice(i + 1))}, ${SCORING.baseByClass[cls] ?? SCORING.defaultBase})`
})
const sql = `-- GÉNÉRÉ par scripts/build_tiers_sql.ts — ne pas éditer à la main.
-- Points de base par dresseur (classe → points, voir SCORING.baseByClass), lus par leaderboard_v3 pour calculer les points des joueurs.
create table if not exists public.trainer_tiers (
  gen smallint not null,
  trainer text not null,
  base smallint not null,
  primary key (gen, trainer)
);
alter table public.trainer_tiers enable row level security;
drop policy if exists trainer_tiers_read on public.trainer_tiers;
create policy trainer_tiers_read on public.trainer_tiers for select using (true);

insert into public.trainer_tiers (gen, trainer, base) values
${rows.join(',\n')}
on conflict (gen, trainer) do update set base = excluded.base;
`
writeFileSync(new URL('../supabase/trainer_tiers.sql', import.meta.url), sql)
console.log(rows.length, 'dresseurs')
