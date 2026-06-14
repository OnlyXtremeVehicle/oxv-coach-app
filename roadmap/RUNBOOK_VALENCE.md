# Runbook Valence — premier essai (1 coach + 1 pilote + 1 capture)

> Procédure pas-à-pas pour le jour J. L'app n'a pas (encore) d'inscription
> in-app ni d'attribution automatique du rôle coach : ces étapes se font une
> fois, en amont, par un admin OXV. Tout le reste se passe dans l'app.

## A. En amont (admin OXV, une fois)

1. **Créer les 2 comptes** dans Supabase (Dashboard → Authentication → Add user,
   ou via le site oxvehicle.fr) : un pour le **pilote**, un pour le **coach**.
   Le trigger `handle_new_user` crée automatiquement la ligne `public.users`
   (rôle par défaut = `pilot`).

2. **Bootstrap admin** (une seule fois, pour pouvoir promouvoir le coach) :
   sur le compte staff OXV, en SQL :
   ```sql
   update public.users set is_admin = true where email = 'staff@oxvehicle.fr';
   ```
   (à faire via le Dashboard SQL — c'est la seule action SQL manuelle.)

3. **Promouvoir le coach** : le compte admin ouvre l'app → écran
   `(admin)/preparation` → bouton de promotion du compte coach
   (`promoteToCoach` → `role='coach'`). Vérifier que `coach_permissions`
   contient au moins `view_pilots` pour ce coach (sinon l'insérer).

4. **Lier coach ↔ pilote** : le compte admin assigne le pilote au coach
   (`assignPilotToCoach` → ligne `coach_pilots`, active=true).

## B. Côté pilote (dans l'app)

5. Connexion (email + mot de passe) → **onboarding pilote** (doctrine →
   méthode → niveau → CGU → **Pacte de pilotage**).
6. Accueil → **Mon coach** → **consentir** au partage avec le coach
   (`pilot_consent_at`). Sans ce consentement, le coach ne voit RIEN (RLS
   `is_coach_of` exige active + consenti).
7. Accueil → **Mon équipement** → scanner et connecter le boîtier RaceBox →
   **Placement** → « C'est fait » → **Roulage** (l'app enregistre, écran posé).
8. De retour au paddock → **Terminer le roulage** → l'app clôt la session,
   préserve les données, calcule le bilan → **Bilan**.

## C. Côté coach (dans l'app)

9. Connexion → **onboarding coach** (mission → **Pacte de coaching**).
10. Accueil coach → le pilote consenti apparaît → ouvrir sa session →
    **Bilan (vue coach)** → virages, **annoter**, repères.

## Pré-requis matériel / réseau

- Un **RaceBox Mini** chargé + le support magnétique.
- Réseau mobile au paddock (l'écriture des trames est par paquets ; le `.ubx`
  local sert de filet si le réseau a des trous, et est ré-uploadé).
- Garder **l'app au premier plan** pendant le roulage (le BLE en arrière-plan
  arrivera avec les entitlements natifs — hors V1).

## Smoke test recommandé avant le jour J

Faire **un roulage de test complet** (même court, même sur parking) avec un vrai
RaceBox pour valider de bout en bout : connexion → frames écrites en base →
session `completed` → bilan peuplé. C'est la seule validation que le code ne
peut pas couvrir (matériel réel requis).
