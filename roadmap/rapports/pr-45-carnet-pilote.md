# PR-45 — Carnet pilote : notes libres + partage opt-in coach (M3)

**Milestone** : M3 (innovation V4) · **Date** : 2026-06-28 · **Branche** : `main`
**Méthode** : conception via workflow (comprendre → concevoir → critique adversariale, 7 agents) puis arbitrages tranchés par Gabin.

## Intention

L'espace **intime** du pilote : des notes en **texte libre** post-session,
propriété du pilote. Doctrine cardinale (V5 P-E, audit maquettes 90.1) : **l'app
ne pré-remplit ni ne suggère JAMAIS le contenu**. Page blanche, aucun gabarit,
aucune IA, aucun jugement. L'app affiche et conserve, elle ne rédige pas.

## Arbitrages (vos décisions)

- **Partage coach** : *opt-in par note* — chaque note porte `shared_with_coach`.
- **Nom de table** : `pilot_notes` (conforme spec V5 + service `pilotNotesService`).

## Schéma (migration `0025_pilot_notes`, appliquée en prod)

Table `pilot_notes` : `user_id` → `auth.users` (cascade), `session_id` →
`telemetry_sessions` (set null — effacer une séance ne détruit jamais le
ressenti), `body` text (check 1–5000), `shared_with_coach` bool (défaut false),
`created_at`, `updated_at` (trigger). Index `(user_id, created_at desc)`.

**RLS — chirurgicale (territoire règle cardinale)** :
- `pilot_notes_owner_all` (for all) : own-row strict ; le `with check` borne en
  plus `session_id` aux **sessions du pilote** (intégrité, pas de rattachement
  cross-pilote).
- `pilot_notes_coach_select` (for select) : `shared_with_coach = true AND
  is_coach_of(user_id)`. `is_coach_of` encapsule déjà *actif + consentement*.
  Lecture seule, **aucune écriture coach**. Révocation = flag à false → la note
  disparaît immédiatement de la vue du coach.
- **Aucune policy partenaire ni admin** → deny-by-default (espace intime, calqué
  sur `pilot_goals` 0023).

**Corrections issues de la critique adversariale, intégrées** : `session_id`
borné aux sessions du pilote ; trigger en `search_path = public, pg_temp`
(standard maison `20260615190000`, pas la chaîne vide proposée). La fausse alerte
« 0025 déjà pris » a été vérifiée : ce dépôt applique ses migrations en *live*
(`apply_migration`), la série nue `0007→0024` (mes 5 de cette session incluses)
fonctionne ; `0025` nu est libre et continue la série.

`database.types.ts` régénéré (+45/-0). Advisors sécurité : **aucune alerte sur
`pilot_notes`** (RLS active, policies présentes, search_path durci). Le seul
ERROR reste `security_definer_view` sur `sessions_public` — préexistant, hors PR.

## Écrans & câblage

- `app/(app)/carnet.tsx` — page blanche : composer (création/édition), liste des
  notes, interrupteur « Partagée avec mon coach » par note, suppression franche
  (confirmation). État vide exact : « Aucune note. Ce carnet est à vous. »
- `src/services/pilotNotesService.ts` — CRUD own-row + `setNoteShared` ;
  `listSharedNotesForPilot` côté coach (journalise via `log_coach_view`, RGPD).
- `app/(coach)/pilote/[id].tsx` — bloc « Carnet partagé » en **lecture seule**
  (visible seulement s'il existe des notes partagées ; le coach observe, ne
  répond pas).
- `appMap` : `carnet → progression` (route + écran livrés dans le même commit →
  test de cohérence vert).
- Points d'entrée : onglet **Progression** (« Carnet ») + Bilan (« Noter mon
  ressenti », qui pré-remplit le *lien séance*, jamais le texte).

## Vérifié

- `tsc` clean · `eslint`/`prettier`/`format:check` clean.
- `npm run doctrine` : 133 fichiers, aucun verbe interdit.
- `npx jest` : **899 passed, 0 échec** ; `appMap.test.ts` vert.
- Tests RLS `pilotNotesRLS.test.ts` : 6 cas (pilote crée/édite ; coach consenti
  voit la partagée et **pas** la privée ; coach non consenti ne voit rien ;
  coach ne peut pas écrire ; autre pilote rien ; partenaire rien). Skippés sans
  env de test, prêts pour la CI RLS.

## Garde-fous doctrine appliqués

Page blanche · aucun placeholder suggestif · état vide exact · zéro IA / zéro
pré-remplissage / zéro résumé auto · aucun score ni gamification · l'app
n'interprète pas le contenu · vouvoiement · pas d'emoji · suppression franche.

## Reste / suite M3

- Note **vocale** (`audio_url`) : reportée (V4), autre migration.
- Build device + scan QR caméra : 1er juillet (quota EAS).
- Tranches M3 à venir (schéma → STOP) : assistant IA coach, programmes
  adaptatifs, jumeau numérique, modération.
