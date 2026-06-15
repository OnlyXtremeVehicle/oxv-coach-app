# Migrations en attente de coordination site

Ce dossier contient des migrations **prêtes mais NON appliquées**, en attente
d'une vérification ou d'une coordination avec le site `oxvehicle.fr`. Elles ne
sont **pas** dans `supabase/migrations/` pour qu'aucun `supabase db push` ne les
applique par accident.

## `20260614121000_sessions_mask_private_client_pii.sql` — SUPERSEDED (ne pas appliquer)

> **Résolu autrement, déjà en production (2026-06-15).** La question ci-dessous a été
> tranchée : `oxvehicle.fr` (écran admin Médias, `loadAdminMedias`) lit
> `private_client_name` en tant que rôle **`authenticated`** (clé `anon` + JWT admin),
> **pas** via `service_role`. Un `REVOKE SELECT` de ces colonnes à `authenticated`
> casserait donc cet écran admin (c'est précisément le risque flagué ci-dessous).
>
> L'**Option 2** a été retenue et appliquée en prod : vue `public.sessions_public`
> (sans les 2 colonnes PII), retrait de la lecture `anon` sur la table de base, et
> `sessions_select_authenticated` pour préserver les lectures pilote/admin. Voir
> `supabase/migrations/20260614120000_secure_sessions_public_calendar.sql` et
> `supabase/migrations/20260615175209_restore_authenticated_read_on_sessions.sql`,
> et la PR site `oxv-site#1`.
>
> **Ne pas appliquer ce draft** — il casserait l'écran admin Médias. À supprimer par
> son auteur une fois constaté.

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
