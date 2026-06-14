# Migrations en attente de coordination site

Ce dossier contient des migrations **prêtes mais NON appliquées**, en attente
d'une vérification ou d'une coordination avec le site `oxvehicle.fr`. Elles ne
sont **pas** dans `supabase/migrations/` pour qu'aucun `supabase db push` ne les
applique par accident.

## `20260614121000_sessions_mask_private_client_pii.sql`

Ferme la fuite PII de `public.sessions` (colonnes `private_client_name` /
`private_client_contact` lisibles par anon via `select *` sur le calendrier
public). Correctif column-level : `REVOKE SELECT` de ces 2 colonnes pour
`anon` + `authenticated`.

**Avant d'appliquer** : confirmer que `oxvehicle.fr` lit ces colonnes via
`service_role` (backend) ou une RPC admin — et non via la clé `anon`/`authenticated`
côté front. Sinon, le REVOKE casse la vue admin du site ; il faut d'abord faire
basculer le site sur `service_role`/RPC (même précaution que la migration
`20260614023457_secure_progression_share_read.sql` pour `oxvehicle.fr/share`).

Une fois le point tranché : déplacer le fichier dans `supabase/migrations/` (en
réhorodatant si besoin) puis appliquer.
