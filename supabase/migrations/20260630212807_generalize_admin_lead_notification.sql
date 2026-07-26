-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 30 juin 2026 a 21:28:07 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Généralise l'alerte admin : corporate + liste d'attente + partenaire + presse (était corporate seul).
-- Autorisé explicitement par l'utilisateur. Exception-safe : n'impacte jamais l'insert. Dormant sans secrets edge.
CREATE OR REPLACE FUNCTION public.notify_corporate_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
declare
  edge_url text;
  invoke_secret text;
  lead_kind text;
begin
  lead_kind := case new.source
    when 'corporate_form' then 'corporate'
    when 'event_waitlist' then 'waitlist'
    when 'partner_form'   then 'partner'
    when 'press'          then 'press'
    else null
  end;
  if lead_kind is null then
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
    body := jsonb_build_object('kind', lead_kind, 'id', new.id),
    timeout_milliseconds := 5000
  );

  return new;
exception when others then
  raise warning '[notify_corporate_lead] %', sqlerrm;
  return new;
end;
$function$;
