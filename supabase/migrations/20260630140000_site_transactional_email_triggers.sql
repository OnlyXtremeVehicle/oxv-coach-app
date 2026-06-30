-- =============================================================================
-- OXV — Triggers transactionnels emails SITE (booking, paiement, lead corporate)
-- =============================================================================
-- Coordination site <-> Supabase partagé. Mirroir de notify_contact_message_inserted :
-- pg_net (net.http_post) + secrets vault (edge_functions_base_url / _invoke_secret),
-- SECURITY DEFINER, EXCEPTION WHEN OTHERS -> RETURN NEW (jamais bloquant pour l'écriture).
-- Idempotence assurée côté Edge Functions (confirmation_email_sent_at / metadata / email_log).
-- =============================================================================

-- 1) Réservation créée -> email confirmation pilote + notif admin
create or replace function public.notify_registration_inserted()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  edge_url text;
  invoke_secret text;
begin
  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');
  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := edge_url || '/send-booking-confirmation',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret,'Authorization','Bearer ' || invoke_secret),
    body := jsonb_build_object('registration_id', new.id),
    timeout_milliseconds := 5000
  );

  perform net.http_post(
    url := edge_url || '/notify-admin-lead',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret,'Authorization','Bearer ' || invoke_secret),
    body := jsonb_build_object('kind','booking','id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning '[notify_registration_inserted] %', sqlerrm;
  return new;
end;
$function$;

drop trigger if exists trg_registration_emails on public.registrations;
create trigger trg_registration_emails
after insert on public.registrations
for each row execute function public.notify_registration_inserted();

-- 2) Paiement validé (paid_at passe de NULL à NON NULL) -> email pilote
create or replace function public.notify_payment_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  edge_url text;
  invoke_secret text;
begin
  -- uniquement à la transition vers "payé"
  if new.paid_at is null or old.paid_at is not null then
    return new;
  end if;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');
  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := edge_url || '/send-payment-confirmed',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret,'Authorization','Bearer ' || invoke_secret),
    body := jsonb_build_object('payment_id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning '[notify_payment_confirmed] %', sqlerrm;
  return new;
end;
$function$;

drop trigger if exists trg_payment_confirmed_email on public.payments;
create trigger trg_payment_confirmed_email
after update on public.payments
for each row execute function public.notify_payment_confirmed();

-- 3) Lead corporate (contact_messages source=corporate_form) -> notif admin
create or replace function public.notify_corporate_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  edge_url text;
  invoke_secret text;
begin
  if new.source is distinct from 'corporate_form' then
    return new;
  end if;

  edge_url := oxv_get_secret('edge_functions_base_url');
  invoke_secret := oxv_get_secret('edge_functions_invoke_secret');
  if edge_url is null or edge_url = '' or invoke_secret is null or invoke_secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := edge_url || '/notify-admin-lead',
    headers := jsonb_build_object('Content-Type','application/json','x-oxv-invoke-secret',invoke_secret,'Authorization','Bearer ' || invoke_secret),
    body := jsonb_build_object('kind','corporate','id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning '[notify_corporate_lead] %', sqlerrm;
  return new;
end;
$function$;

drop trigger if exists trg_corporate_lead_admin on public.contact_messages;
create trigger trg_corporate_lead_admin
after insert on public.contact_messages
for each row execute function public.notify_corporate_lead();
