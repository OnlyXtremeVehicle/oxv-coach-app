-- Migration RECONSTITUEE le 26/07/2026 depuis supabase_migrations.schema_migrations.
-- Appliquee en production le 30 juin 2026, elle n avait jamais ete
-- versionnee dans ce depot. Source : colonne statements, recollee dans l ordre d execution.
-- Le formatage d origine et les commentaires hors instruction sont perdus ; le SQL, lui,
-- est celui qui a reellement tourne. Ne pas rejouer : deja appliquee.

-- Décision produit (Option A, 2026-06-30) : modèle canonique = sessions/registrations (modèle site, source de vérité).
-- events/event_registrations dépréciés. Action NON destructive : métadonnées uniquement (aucun impact comportemental, réversible via COMMENT ... IS NULL).
-- La suppression effective est différée à la migration du code app (cf docs/site/PR_SITE_DEPRECATE_EVENTS.md).
COMMENT ON TABLE public.events IS 'DEPRECATED (decision produit Option A, 2026-06-30) — modele canonique = public.sessions. Ne plus creer de journees pilotes ici. Suppression apres migration du code app (eventsService, b2b_event_reports, event_partners) + retrait de telemetry_sessions.event_id. Lien telemetrie<->reservation par user_id.';
COMMENT ON TABLE public.event_registrations IS 'DEPRECATED (decision produit Option A, 2026-06-30) — modele canonique = public.registrations. Ne plus utiliser. Suppression apres migration du code app.';
COMMENT ON COLUMN public.telemetry_sessions.event_id IS 'DEPRECATED — non alimente (0 lignes). Lien telemetrie<->reservation par user_id + correlation temporelle. A retirer lors de la depreciation de public.events.';
