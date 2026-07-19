-- ============================================================================
-- BE-1 · Livrable 1 — Feature flags de la v2 (tous OFF, fail-closed).
-- ============================================================================
-- app_feature_flags existe déjà (isFlagEnabled fail-closed la lit). On insère
-- les 5 drapeaux de la v2 en OFF ; idempotent (ON CONFLICT DO NOTHING) pour ne
-- jamais réactiver un flag qu'un admin aurait déjà basculé.
-- ============================================================================

insert into public.app_feature_flags (key, enabled, description)
values
  ('app_payments', false, 'BE-1 : réservations/paiements in-app (Stripe/IAP). Activé au lot A1-ON.'),
  ('biometry',     false, 'BE-1 : capture et affichage FC (Polar/Watch). Gate consentement biometry.'),
  ('founders',     false, 'BE-1 : candidatures Membre Fondateur (30 places).'),
  ('video_overlay', false, 'BE-1 : vidéo du tour synchronisée télémétrie (lot B1).'),
  ('convoys',      false, 'BE-1 : convois vers une journée (route certifiée + RDV).')
on conflict (key) do nothing;
