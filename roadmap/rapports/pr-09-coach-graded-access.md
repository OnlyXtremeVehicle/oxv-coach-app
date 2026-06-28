# Rapport — PR-A + PR-B · Bloqueurs P0 de l'audit CDC V2

> Suite directe de [AUDIT_CDC_V2.md](../../docs/refonte-app/AUDIT_CDC_V2.md). Les deux
> bloqueurs P0 de sortie d'alpha sont levés.

## PR-A · Silence en piste sur le handler de notifications *(commit `315ba93`)*
- `notifPreferencesLogic.notificationBehaviorForState(state)` : pur, testé — en `S6_roulage`
  supprime alerte + son + badge ; hors piste, bannière sans son.
- `pushNotificationsService` : le handler `setNotificationHandler` lit l'état pilote via
  `useAppStateStore.getState()` au lieu d'afficher tout en dur.
- **DoD §30.3 satisfaite.** Zéro schéma. Test : push en S6 supprimé / affiché hors piste.

## PR-B · Contrat de lecture coach gradué *(décision Gabin 2026-06 : « gradué »)*

### Migration prod (appliquée + fichier `supabase/migrations/0014_*`)
- Enum `coach_access_level` (`lecture_simple` | `lecture_detaillee` | `programme`).
- Colonne `coach_pilots.level` (défaut `lecture_simple`). Affiliations déjà consenties → `lecture_detaillee` (préservation ; aucune ne l'était en prod, 1 ligne pending).
- Helper `is_detailed_coach_of(pilot_uuid)` (SECURITY DEFINER) = `is_coach_of` **+** `level ∈ (détaillée, programme)`.
- **2 policies repointées** : `telemetry_frames_coach_select` et `app_segment_analyses_coach_select` → `is_detailed_coach_of`. Les 3 autres (`telemetry_sessions`, `laps`, `app_session_analyses`) restent sur `is_coach_of` (sessions/tours/bilan dès `lecture_simple`, §23).

**Effet** : un coach `lecture_simple` voit sessions/tours/bilan mais **plus les frames brutes ni les métriques de virage**. La faille « tout coach consenti voit toutes les frames » est **fermée**.

### Code
- `database.types.ts` : enum + `coach_pilots.level` (patch chirurgical).
- `pilotConsentService` : `CoachAccessLevel`, `COACH_ACCESS_LEVELS` (3 niveaux + libellés), `level` exposé ; `giveConsent(id, level)` ; **`setConsentLevel(id, level)`** (restreindre coupe l'accès détaillé immédiatement).
- `mon-coach.tsx` : **le pilote choisit à l'acceptation** — consentement au niveau le plus restreint (`lecture_simple`), puis sélecteur des 3 niveaux (radio sobre, gris/crème, **aucun or**). Explicatif mis à jour.

### Doctrine
Le pilote contrôle l'accès (privacy-first : consent = minimal, le pilote ouvre). Sélecteur neutre, vouvoiement, sans emoji. La règle « le coach ne voit que ce qui est consenti » devient graduée et **factuelle**.

### Tests
- Suite RLS `coachGradedAccessRLS` : `lecture_simple` ne voit ni frames ni virages mais voit les sessions ; `lecture_detaillee` voit les deux. Helpers `setup.ts` étendus (`level`, `createTestFrame`, `createTestSegmentAnalysis`).
- *(Skippée hors `TEST_SUPABASE_*`, comme les 3 suites existantes — documente et verrouille le contrat en Cns I.)*

## État des bloqueurs P0
- **P0-1 (silence en piste)** : **FERMÉ**.
- **P0-2 (accès coach)** : **cœur fermé** (la faille frames est corrigée). *Reste P1* : étendre la matrice de tests RLS aux autres tables sensibles (`session_media`, `pilot_goals`, `duels`, etc.) — la suite graduée pose le socle.

## Gates
- `tsc` 0 · `eslint` 0 · `jest` 799 (+ 2 tests RLS skippés sans env).

## En suspens — build requis
- Rendu du sélecteur de niveau sur device ; vérifier le parcours consent → choix niveau → le coach voit/ne voit pas.
