# Rapport — PR-A' · Audit DB des changements de rôle

> Audit CDC V2, remonté P1 par la critique de complétude (§10.1 cas 4 + DoD §30
> « audit des rôles sensibles »). Décision Gabin : faire la PR.

## Problème
`promoteToCoach` / `demoteToPilot` (`coachAdminService`) mutaient `users.role`
**sans aucune trace** (« à câbler en V1.1 »). Impossible de répondre à « qui a
promu ce coach, et quand ? » — trou de conformité/sécurité.

## Ce que j'ai fait
- **Migration `0015`** (appliquée en prod) : trigger `trg_audit_user_role_change`
  `AFTER UPDATE OF role ON users` → insère dans `admin_audit` (action `role_changed`,
  `metadata = { old_role, new_role, changed_by: auth.uid() }`). `SECURITY DEFINER`
  → la trace passe **quel que soit le chemin** (client admin ou service_role), et
  uniquement quand le rôle change réellement (`is distinct from`).
- Convention respectée : `user_id` = l'utilisateur dont le rôle change (comme les
  lignes `login`), `metadata.changed_by` = l'admin qui a agi.
- Note ajoutée dans `coachAdminService.promoteToCoach` (la trace est automatique,
  aucun appel applicatif requis).

## Pourquoi un trigger (et pas du code applicatif)
Robuste par construction : toute mutation de `role` est tracée, y compris une
correction manuelle en base ou un futur autre chemin. Zéro oubli possible.

## Testé
- Trigger vérifié présent (`pg_trigger`). `tsc` 0 · `eslint` 0 · `jest` 807 (inchangé — seul un commentaire + le schéma).

## En suspens
- `demoteToPilot` ne désactive toujours pas les `coach_pilots` (noté « V1.1 ») — la
  RLS `is_coach_of` coupe déjà l'accès (rôle ≠ coach), donc non bloquant.
