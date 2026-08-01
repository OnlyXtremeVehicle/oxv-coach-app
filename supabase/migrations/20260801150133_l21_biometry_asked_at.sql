-- =============================================================================
-- L21 — distinguer un REFUS d'une question JAMAIS POSÉE
--
-- APPLIQUÉE EN PRODUCTION le 01/08/2026 (version 20260801150133), sur accord
-- explicite du fondateur.
-- =============================================================================
--
-- LE PROBLÈME
--
-- `users` porte deux colonnes de consentement biométrie, et **un refus comme une
-- question jamais posée y valent tous deux NULL**. Un flux qui demanderait « à la
-- première fois » ne pourrait donc pas savoir qu'il y a déjà eu une première
-- fois : il redemanderait à chaque journée au pilote qui a dit non.
--
-- Ce n'est pas seulement pénible. Le RGPD veut qu'un refus soit respecté, pas
-- re-sollicité ; et la doctrine OXV dit que l'application montre, elle ne dirige
-- pas. Reposer indéfiniment la même question est une forme d'insistance.
--
-- ---------------------------------------------------------------------------
-- POURQUOI CÔTÉ SERVEUR, ET PAS UN MARQUEUR LOCAL
--
-- Un marqueur sur l'appareil (MMKV) aurait évité toute migration. Mais il ne
-- survit ni à une réinstallation, ni au passage à un nouveau téléphone : celui
-- qui a refusé se verrait redemander.
--
-- **Le refus d'une donnée de santé appartient au pilote, pas à son appareil.**
--
-- ---------------------------------------------------------------------------
-- CE QUE LA COLONNE DATE
--
-- La SOLLICITATION, pas la réponse. Elle est écrite quand la feuille s'affiche,
-- même si le pilote la referme sans répondre — sans quoi une fermeture sans
-- réponse rouvrirait la question à la journée suivante, ce qui est exactement
-- l'insistance qu'on veut éviter.
--
-- ---------------------------------------------------------------------------
-- POURQUOI MAINTENANT
--
-- Le drapeau `biometry` est passé à **true** : le bloc est vivant. 0 pilote a
-- consenti à ce jour. La question va donc commencer à être posée pour de bon —
-- il fallait pouvoir en enregistrer le refus avant, pas après.
-- =============================================================================

alter table public.users
  add column if not exists biometry_asked_at timestamptz;

comment on column public.users.biometry_asked_at is
  'Date à laquelle la question du consentement biométrique a été POSÉE au pilote. '
  'Distincte des colonnes de consentement : NULL ici signifie « jamais demandé », '
  'alors que NULL sur biometry_capture_consent_at signifie « refusé OU jamais '
  'demandé ». Sans cette distinction, un refus serait re-sollicité à chaque '
  'journée. Écrite quand la feuille s''affiche, même si le pilote la ferme sans '
  'répondre — c''est la SOLLICITATION qu''elle date, pas la réponse.';
