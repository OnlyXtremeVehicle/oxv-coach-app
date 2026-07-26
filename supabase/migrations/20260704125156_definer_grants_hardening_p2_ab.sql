-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 4 juillet 2026 a 12:51:56 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Sécurité P2 (approuvé fondateur 2026-07-04) — cf docs/site/SECURITE_P2_GRANTS_AUDIT.md
-- Catégorie A : fonctions trigger (s'exécutent via triggers, EXECUTE du rôle appelant inutile ;
-- le déclenchement des triggers n'est PAS affecté par ces revokes)
revoke execute on function
  public.audit_user_role_change(),
  public.coach_objectives_capture_baseline(),
  public.coach_objectives_log_event(),
  public.guard_partner_account_status(),
  public.notify_corporate_lead(),
  public.notify_document_status(),
  public.notify_payment_confirmed(),
  public.notify_payment_invoice(),
  public.notify_registration_inserted(),
  public.pilot_goals_capture_baseline(),
  public.pilot_goals_log_event(),
  public.trg_fn_docs_to_eligibility(),
  public.trg_fn_feedback_guard(),
  public.trg_fn_referral_validate(),
  public.trg_fn_seed_eligibility()
from public, anon, authenticated;

-- Catégorie B : fonctions auto-scopées auth.uid() — anon retiré, authenticated conservé
revoke execute on function
  public.get_or_create_my_affiliation_code(),
  public.my_goal_progress(),
  public.my_objective_progress(),
  public.my_session_annotations(uuid),
  public.my_session_objectives(uuid),
  public.rotate_my_affiliation_code(),
  public.redeem_affiliation_code(text)
from public, anon;
