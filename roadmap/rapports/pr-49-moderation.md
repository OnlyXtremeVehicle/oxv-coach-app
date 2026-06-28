# PR-49 — Modération communautaire (PR-82, M3 — dernière tranche)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`
**Méthode** : workflow (7 agents : comprendre UGC+doctrine/CGU+spec → concevoir → critique adversariale 3 lentilles), décision Gabin = MVP complet.

## Intention

Une fonction d'**administration défensive** : un utilisateur signale un contenu UGC
visible ; l'admin traite en file. Le **signaleur est confidentiel** vis-à-vis du
signalé. La table ne porte qu'une **référence** (`target_type` + `target_id`),
jamais le contenu, **jamais de télémétrie ni de contenu pilote privé**.

## Corrections de la critique intégrées

- 🟠 **Fuite `resolution` au signaleur** → **deux tables** : `moderation_reports`
  (lisible par le signaleur : statut seul) + `moderation_report_reviews`
  (admin-only : resolution/reviewed_by). La note admin (qui peut nommer le signalé)
  ne fuit jamais.
- 🟠 **`target_id` polymorphe sans intégrité** → **trigger BEFORE INSERT** qui
  vérifie l'existence de la cible *sous la RLS du signaleur* = on ne signale que ce
  qui existe **et qu'on peut voir**. Plus de pointeur mort.
- **`map_point` retiré** (pas de table) ; **MVP = `coach_review` + `partner_offer`**
  (enum extensible). `session_media` différé.
- **CHECK conditionnel** : `details` requis si `reason='autre'`.
- **Anti-abus** : `UNIQUE(reporter, cible)` + **rate-limit léger côté service** (20/24 h) ;
  action admin **manuelle** (pas de censure auto exploitable).

## Schéma (migration `0029`, appliquée en prod)

3 enums (target_type, reason, status). `moderation_reports` (référence + reason +
details + status, UNIQUE anti-doublon, CHECK details-si-autre) + `moderation_report_reviews`
(admin-only). Triggers : updated_at (search_path durci) + validation cible. RLS :
reports SELECT (signaleur own OR admin), INSERT (signaleur, status=nouveau), UPDATE
(admin) ; reviews ALL admin-only ; le signalé n'a **aucune policy**. Aucune DELETE
(conservation). `database.types.ts` régénéré (+85/-0). Advisors : RAS.

## App

- `src/services/moderationService.ts` : `reportContent` (rate-limit, gestion 23505/23503),
  `listMyReports` (statut seul) ; admin `listReports`/`takeReport`/`resolveReport`.
- `src/components/ReportButton.tsx` : lien « Signaler » discret + modale sobre (motif +
  précision si « autre »). Branché sur les **avis coach** ([coach/[id]](app/(app)/coach/[id].tsx))
  et les **offres partenaires** ([partenaires](app/(app)/partenaires.tsx)).
- `app/(admin)/moderation.tsx` : file (non-traités d'abord), prise en charge, résolution
  (note interne admin-only), rejet + entrée hub admin.

## Vérifié

- `tsc` · `eslint` · `prettier`/`format:check` clean · `doctrine` 138 fichiers OK.
- `npx jest` : **918 passed, 0 échec**.
- Tests RLS `moderationRLS.test.ts` : 6 cas (signaleur dépose/voit ; autre user rien ;
  admin voit tout ; signaleur n'accède pas au review ; doublon refusé ; cible
  inexistante refusée par le trigger).

## Point juridique (à la main de Gabin)

La **CGU n'a pas de clause « Modération/Signalement »** — je ne touche pas aux textes
juridiques. Le code est livré ; l'activation publique en avant suppose cette clause
(RGPD 6.1.c, conservation, contact@oxvehicle.fr).

## Clôture M3

Garage (44) · Carnet (45) · Assistant IA coach (46) · Programmes adaptatifs (47) ·
Empreinte consolidée (48) · **Modération (49)** — M3 livré. Reste : **build device du
1er juillet** (quota EAS) pour valider toute la pile sur iPhone + rédaction de la clause CGU.
