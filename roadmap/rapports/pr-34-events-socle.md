# Rapport — PR-20 · Socle Événements (M2)

> Pivot public-ready. Décisions Gabin : gestion events **dans l'app** (admin) +
> table **`event_registrations` app** (check-in QR). SQL appliqué (sans préférence
> show/apply → appliqué + montré).

## Constat d'architecture (surfacé avant migration)
La base a `sessions` (réservations SITE) ET `telemetry_sessions` (captures APP) ;
`app_sessions` n'existe pas. La table `events` est **partagée site↔app** : le DDL
suit `test_alpha/02` (le site la crée en `if not exists` → no-op). L'app la **lit**
et rattache ses captures. Le bandeau « mode démo » du Bilan se **dérive** de
`event_type != 'session'` (pas de colonne `context` séparée).

## Schéma (migration `0021`, appliquée en prod)
- **`events`** (DDL aligné spec) : name, slug (unique), `event_type`
  (session/balade_decouverte/test_alpha/partenaire/corporate), `status`
  (draft→private→public→closed→finished/cancelled), lieu (+`location_coordinates point`),
  dates, `max_pilots`/`current_pilots`, `pricing` jsonb, description, `internal_notes`,
  trigger `updated_at` (search_path durci). RLS : public/closed/finished pour tous ;
  private par lien ; draft/cancelled = admin ; admin gère tout.
- **`telemetry_sessions.event_id`** → `events(id)` (lien capture ↔ événement).
- **`event_registrations`** (app) : event_id, pilot_id, status enum
  (registered/checked_in/cancelled/no_show), checked_in_at/by, unique(event_id,pilot_id).
  RLS : le pilote voit/crée les SIENNES ; le **check-in (statut) = admin**.
- **Seed** : « Balade Découverte OXV — 5 juillet 2026 » (Bouteville), idempotent.

## Tests RLS (positifs + négatifs)
`src/__tests__/rls/eventsRLS.test.ts` (4) : pilote voit public mais pas draft ;
pilote s'inscrit + admin check-in ; pilote ne peut pas inscrire un autre pilote ;
pilote ne peut pas se check-in lui-même. Skippés sans creds ; vérifs en base
(1 event seedé, 3+3 policies, colonne event_id).

## Honnête
`internal_notes` n'est pas protégé par RLS (row-level) : les services pilote ne le
SÉLECTIONNENT jamais (contrôle requête, comme `users.admin_notes`). `current_pilots`
n'est pas auto-incrémenté (dérivé via count des inscriptions).

## Gates
- `format` OK · `tsc 0` · `eslint 0` · `jest 890` (+4 RLS skippés). Types régénérés (+192/-0).

## Suite (M2)
PR-21 admin Événements (liste/création/détail) · PR-22 inscriptions+check-in QR · PR-27 Pass OXV ·
PR-20b bandeau démo Bilan (dérivé event_type).
