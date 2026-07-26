-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 30 juin 2026 a 20:53:38 UTC, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Décision verrouillée A1 (2026-06-30) : un seul modèle canonique = sessions/registrations.
-- events/event_registrations SUPPRIMÉS après migration app ; b2b_event_reports/event_partners CONSERVÉS mais repointés sur sessions.id ; telemetry liée par user_id.
COMMENT ON TABLE public.events IS 'DEPRECATED — A1 verrouille (2026-06-30). Canonique = public.sessions. A SUPPRIMER apres migration code app (eventsService/analytics/dataExport -> sessions/registrations) + repoint b2b_event_reports.event_id & event_partners.event_id vers sessions.id + drop telemetry_sessions.event_id. Plan: docs/site/PR_SITE_DEPRECATE_EVENTS.md.';
COMMENT ON TABLE public.event_registrations IS 'DEPRECATED — A1 verrouille (2026-06-30). Canonique = public.registrations. A SUPPRIMER apres migration code app. Plan: docs/site/PR_SITE_DEPRECATE_EVENTS.md.';
