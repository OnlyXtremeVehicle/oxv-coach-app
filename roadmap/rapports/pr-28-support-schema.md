# Rapport — PR-09 · Schéma Support (tickets + messages)

> Backlog V6, jalon M1. **Première création de table**, validée par Gabin
> (« go support »). Fondation du canal de contact pilote ⇄ admin.

## Schéma (migration `0020_support_tickets.sql`, appliquée en prod)
- 3 enums : `support_ticket_category` (equipement/bilan/data/coach/rgpd),
  `support_ticket_status` (nouveau→ouvert→en_cours→resolu→ferme),
  `support_ticket_priority` (p0–p3).
- **`support_tickets`** : `user_id`, `category`, `subject` (1–200), `status`
  (défaut nouveau), `priority` (défaut p2), `session_id?`, `device_id?`, timestamps
  (+ trigger `updated_at`). Index (user, créé) et (statut, priorité).
- **`support_messages`** : `ticket_id`, `author_id`, `body` (1–4000), `is_admin`,
  `created_at`.

## RLS (positives ET négatives testées)
- **Tickets** : le pilote voit/crée **les siens** ; l'admin voit tout ; statut/priorité
  modifiables **par l'admin uniquement** (`update_admin`). Le pilote n'édite pas son ticket.
- **Messages** : lisibles par le propriétaire du ticket et l'admin ; le pilote répond à
  **son** ticket avec `is_admin=false`, l'admin partout avec `is_admin=true` — l'`author`
  est toujours l'appelant. **Aucune télémétrie** dans ces tables (au plus une référence).
- **`src/__tests__/rls/supportRLS.test.ts`** : 6 scénarios — 2 positifs (pilote crée/voit/
  répond ; admin voit/change statut/répond) + 4 négatifs (autre pilote ne voit rien ;
  pilote ne change pas le statut ; pilote ne peut pas usurper `is_admin=true` ; coach ne
  voit rien). Skippés sans creds de test (pattern existant) ; les 5 policies vérifiées en
  base via `pg_policies`.

## Durcissement
- Advisor sécurité corrigé : `touch_support_ticket_updated_at` reçoit `set search_path = ''`
  (seul WARN introduit par la migration).
- Types régénérés depuis la base (diff **+119 / -0**, sur-ensemble exact : support + helper
  `is_pro_pilot`). `database.types.ts` reste en `.prettierignore`/`.eslintignore`.

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 883` (+6 RLS skippés).

## Suite
- **PR-10** : service + écran pilote (créer/suivre un ticket, dont demande RGPD).
- **PR-11** : écran admin (traiter, prioriser P0 en tête, répondre).
