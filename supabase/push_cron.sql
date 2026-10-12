-- Planifie l'envoi des notifications du combat du jour. À exécuter APRÈS push_subscriptions.sql et le déploiement de
-- l'Edge Function send-daily-push (voir DEPLOY.md, section « Notifications push »).
--
-- Le reset a lieu à 12h00 heure de Paris, soit 10h00 UTC en été (UTC+2) et 11h00 UTC en hiver (UTC+1) ; pg_cron travaille en UTC.
-- On déclenche donc aux deux heures : l'Edge Function ne s'exécute que si l'heure de Paris vaut 12 et ignore l'autre appel.
--
-- Prérequis : remplacer <CRON_SECRET> ci-dessous par la même valeur que le secret CRON_SECRET de l'Edge Function
-- (à ne pas committer avec la vraie valeur), et exécuter une seule fois :
--   select vault.create_secret('<CRON_SECRET>', 'push_cron_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname in ('daily-push-10utc', 'daily-push-11utc');

select cron.schedule('daily-push-10utc', '0 10 * * *', $job$
  select net.http_post(
    url := 'https://gcjsqxogywmgslkqoojq.supabase.co/functions/v1/send-daily-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{}'::jsonb
  );
$job$);

select cron.schedule('daily-push-11utc', '0 11 * * *', $job$
  select net.http_post(
    url := 'https://gcjsqxogywmgslkqoojq.supabase.co/functions/v1/send-daily-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')),
    body := '{}'::jsonb
  );
$job$);
