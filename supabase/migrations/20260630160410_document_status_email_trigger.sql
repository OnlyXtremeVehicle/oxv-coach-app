-- =============================================================================
-- OXV — Trigger email statut document (validé / refusé) — PR-SITE-10
-- =============================================================================
-- Coordination site <-> Supabase. À l'UPDATE de public.documents, si le statut
-- passe à 'validated' ou 'rejected' (transition), appelle l'Edge Function
-- send-document-status (pg_net + secret vault). Non bloquant (EXCEPTION->RETURN NEW).
-- =============================================================================

create or replace function public.notify_document_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  edge_url text;
  invoke_secret text;
begin
  -- uniquement sur transition de statut vers validé/refusé
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.status not in ('validated', 'rejected') then
    return new;
  end if;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');
  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := edge_url || '/send-document-status',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret,'Authorization','Bearer ' || invoke_secret),
    body := jsonb_build_object('document_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning '[notify_document_status] %', sqlerrm;
  return new;
end;
$function$;

drop trigger if exists trg_document_status_email on public.documents;
create trigger trg_document_status_email
after update on public.documents
for each row execute function public.notify_document_status();
