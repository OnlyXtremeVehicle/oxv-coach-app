-- ============================================================================
-- Migration 0029 — Étend les types de notif throttlables
-- ============================================================================
--
-- Ajoute 'friend_request' au CHECK de notif_throttle_log.notif_type pour
-- permettre le throttling des demandes d'amitié spammy (improbable en
-- pratique grâce à UNIQUE(pilot_a, pilot_b), mais filet de sécurité).
--
-- 'coach_annotation' était déjà dans la liste (migration 0024) mais sans
-- jamais avoir été câblé côté Edge Function — on profite de cette PR pour
-- l'activer (15 min de throttle).
--
-- Cette migration NE modifie PAS la fonction should_send_notif() qui prend
-- déjà notif_type en paramètre générique.
-- ============================================================================

-- Drop l'ancienne contrainte
ALTER TABLE public.notif_throttle_log
  DROP CONSTRAINT IF EXISTS notif_throttle_log_notif_type_check;

-- Recrée avec friend_request ajouté
ALTER TABLE public.notif_throttle_log
  ADD CONSTRAINT notif_throttle_log_notif_type_check
  CHECK (
    notif_type IN (
      'session_analyzed',
      'coach_annotation',
      'coach_assigned',
      'consent_received',
      'friend_request'
    )
  );

COMMENT ON COLUMN public.notif_throttle_log.notif_type IS
  'Type de notif throttlée. Fenêtres recommandées :
   - session_analyzed   : 3600 s (1 h)
   - coach_annotation   : 900 s (15 min)
   - friend_request     : 86400 s (24 h)
   - coach_assigned     : pas de throttle (événement unique)
   - consent_received   : pas de throttle (événement unique)';
