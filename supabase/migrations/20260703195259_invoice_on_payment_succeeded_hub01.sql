-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 3 juillet 2026 a 19:52:59 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- PR-HUB-01 : facture automatique à la validation du paiement (exigence prompt maître).
-- Trigger exception-safe (n'impacte jamais l'update du paiement), dormant sans secrets vault.
create or replace function public.notify_payment_invoice()
returns trigger language plpgsql security definer
set search_path to 'public','extensions','vault' as $$
declare edge_url text; invoke_secret text;
begin
  if new.status is distinct from 'succeeded' or old.status = 'succeeded' then
    return new;
  end if;
  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');
  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;
  perform net.http_post(
    url := edge_url || '/generate-invoice',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret),
    body := jsonb_build_object('payment_id', new.id),
    timeout_milliseconds := 8000
  );
  return new;
exception when others then
  raise warning '[notify_payment_invoice] %', sqlerrm;
  return new;
end $$;

drop trigger if exists trg_payment_invoice on public.payments;
create trigger trg_payment_invoice
  after update of status on public.payments
  for each row execute function public.notify_payment_invoice();
