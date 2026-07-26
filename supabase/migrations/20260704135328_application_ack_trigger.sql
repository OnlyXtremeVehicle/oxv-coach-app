-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 13:53:28 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Accusé de réception candidature (approuvé fondateur 2026-07-04 : « oui accusé candidature »)
-- Pattern identique au contact (notify_contact_message_inserted -> send-contact-ack).
alter table public.demandes_inscription
  add column ack_sent_at timestamptz;

comment on column public.demandes_inscription.ack_sent_at is
  'Accusé de réception de dépôt envoyé (idempotence send-application-ack).';

create or replace function public.notify_application_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  edge_url text;
  invoke_secret text;
  request_id bigint;
begin
  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');

  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;

  select net.http_post(
    url := edge_url || '/send-application-ack',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-oxv-invoke-secret', invoke_secret,
      'Authorization', 'Bearer ' || invoke_secret
    ),
    body := jsonb_build_object('application_id', new.id),
    timeout_milliseconds := 5000
  ) into request_id;

  insert into public.admin_audit (user_id, action, metadata)
  values (null, 'application_ack_relayed',
          jsonb_build_object('application_id', new.id, 'edge_request_id', request_id));

  return new;
exception
  when others then
    raise warning '[notify_application] %', sqlerrm;
    return new;
end;
$$;

-- Cohérence durcissement P2 : fonction trigger non exécutable par les rôles clients
revoke execute on function public.notify_application_inserted() from public, anon, authenticated;

create trigger trg_application_ack
  after insert on public.demandes_inscription
  for each row execute function public.notify_application_inserted();
