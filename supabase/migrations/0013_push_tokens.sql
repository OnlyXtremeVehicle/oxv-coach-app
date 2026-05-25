-- Push notifications (sem 13 J3)
--
-- Ajoute le token Expo Push (ExponentPushToken[...]) à chaque user pour
-- pouvoir envoyer des notifs depuis une Edge Function ou un cron côté
-- serveur (V1.1). En V1, on se contente de notifications LOCALES côté
-- device (debrief J+1, veille session), qui ne dépendent pas du token —
-- mais on persiste quand même le token pour préparer V1.1 sans seconde
-- migration.
--
-- `push_notif_enabled` permet au pilote de couper toutes les notifs OXV
-- depuis l'écran #24 Settings sans toucher aux permissions iOS/Android.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS push_notif_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_token_updated_at timestamptz;

COMMENT ON COLUMN public.users.expo_push_token IS
  'Token Expo Push pour notifications remote (format ExponentPushToken[xxx]). Null si jamais enregistré ou si permission refusée.';
COMMENT ON COLUMN public.users.push_notif_enabled IS
  'Opt-in pilote pour notifications OXV (debrief J+1, veille session). Indépendant des permissions système.';

-- Pas de policy nouvelle : users own-row policies couvrent déjà ces colonnes.
