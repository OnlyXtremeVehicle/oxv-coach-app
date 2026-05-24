# Checklist Setup Supabase — Semaine 1

> Liste précise des actions à réaliser pour connecter l'app au backend OXV existant.
> À exécuter conjointement par Gabin (côté admin Supabase) et Claude Code (côté code).

---

## Vue d'ensemble

Cette checklist couvre les actions de **mise en place initiale** de la connexion Supabase. Elle doit être complétée à 100% avant la fin de la semaine 1 du développement.

Estimée : **2-4 heures de travail** réparties entre Gabin et Claude Code.

---

## Partie A — Actions de Gabin (avant Claude Code)

### A.1 — Récupération des credentials

- [ ] Se connecter à https://supabase.com/dashboard
- [ ] Sélectionner le projet OXV (`fouvuqkdxarjpjbqnsjq`)
- [ ] **Project Settings** → **API** → noter dans un gestionnaire de mots de passe :
  - [ ] `Project URL` : https://fouvuqkdxarjpjbqnsjq.supabase.co
  - [ ] `anon public` key
  - [ ] `service_role` key (à garder secret absolu)

### A.2 — Export du schéma actuel

Suivre `docs/architecture/04_SUPABASE_CONNECTION_GUIDE.md` étape 3.

- [ ] Méthode A (Dashboard) ou Méthode B (SQL) ou Méthode C (CLI)
- [ ] Sauvegarder le résultat dans `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql`
- [ ] Vérifier que le fichier ne contient pas de données sensibles
- [ ] Le commiter dans Git (le schéma seul est OK)

### A.3 — Export des RLS Policies

- [ ] Lancer la requête SQL du guide (étape 4)
- [ ] Sauvegarder dans `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`
- [ ] Vérifier l'exhaustivité (toutes les tables doivent avoir leurs policies)

### A.4 — Export des Edge Functions (si existantes)

Si des Edge Functions sont déjà déployées (rituals, dispatchers, etc.) :

- [ ] Installer la CLI Supabase si pas déjà fait : `npm install -g supabase`
- [ ] `supabase login`
- [ ] `supabase link --project-ref fouvuqkdxarjpjbqnsjq`
- [ ] `supabase functions list`
- [ ] Pour chaque fonction : `supabase functions download <name>`
- [ ] Placer le code dans `docs/architecture/edge_functions/`

### A.5 — Création du fichier .env local

- [ ] À la racine de `oxv-coach-app/`, copier `.env.example` en `.env`
- [ ] Remplir les valeurs réelles :
  - [ ] `EXPO_PUBLIC_SUPABASE_URL`
  - [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_URL` (idem que ci-dessus)
  - [ ] `SUPABASE_ANON_KEY` (idem)
  - [ ] `SUPABASE_SERVICE_ROLE_KEY` (clé serveur, pour les Edge Functions)
- [ ] **Vérifier** que `.env` est bien dans `.gitignore`
- [ ] **Ne pas commiter** ce fichier

---

## Partie B — Actions de Claude Code (après que Gabin ait fait A)

### B.1 — Vérification de l'environnement

- [ ] Lire `.env.example` et confirmer que tous les placeholders sont compris
- [ ] Vérifier que `.gitignore` exclut bien `.env`
- [ ] Demander à Gabin de confirmer la présence du `.env` réel sur sa machine

### B.2 — Lecture du schéma actuel

- [ ] Ouvrir `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql`
- [ ] Lister toutes les tables existantes
- [ ] Identifier les colonnes critiques pour l'app :
  - [ ] Table `users` : quelles colonnes existent ?
  - [ ] Table `sessions` : structure exacte ?
  - [ ] Table `registrations` : liens vers users et sessions ?
  - [ ] Table `vehicles` : structure ?
- [ ] Rédiger un résumé dans le rapport hebdomadaire

### B.3 — Lecture des RLS Policies

- [ ] Ouvrir `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`
- [ ] Identifier les patterns de sécurité (qui peut lire quoi)
- [ ] Noter les policies qui devront être étendues pour les nouvelles tables `app_*`

### B.4 — Installation des dépendances

```bash
# Dans le terminal, à la racine du projet
npx expo install @supabase/supabase-js
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-url-polyfill
```

- [ ] Vérifier que les versions sont compatibles avec Expo SDK 51

### B.5 — Création du client Supabase

- [ ] Créer `src/lib/supabase.ts` (voir modèle dans le guide étape 2.3)
- [ ] Ajouter la gestion d'erreur si les variables manquent
- [ ] Tester l'import dans un fichier de test

### B.6 — Génération des types TypeScript

Deux options :

**Option 1 — Manuel** (pour la V1) :
- [ ] Créer `src/types/database.types.ts`
- [ ] Définir les types correspondant aux tables actuelles
- [ ] Maintenir manuellement quand le schéma change

**Option 2 — Auto via Supabase CLI** (recommandé) :
- [ ] `supabase gen types typescript --project-id fouvuqkdxarjpjbqnsjq > src/types/database.types.ts`
- [ ] Régénérer à chaque changement de schéma
- [ ] Ajouter cette commande dans un script npm

### B.7 — Écran de test

- [ ] Créer temporairement un écran qui :
  - [ ] Tente une connexion à Supabase
  - [ ] Affiche "OK" ou un message d'erreur
  - [ ] Permet de tester avec un compte existant si Gabin en fournit un
- [ ] Tester sur iOS Simulator
- [ ] Tester sur Android Emulator
- [ ] Tester sur appareil physique (Expo Go)

### B.8 — Mise en place de l'auth

- [ ] Créer le hook `useAuth()` qui :
  - [ ] Maintient l'état de connexion via Zustand
  - [ ] Gère la persistance via AsyncStorage
  - [ ] Expose `signIn`, `signOut`, `user`, `isLoading`
- [ ] Créer l'écran de login basique
- [ ] Tester un login avec un compte admin existant

---

## Partie C — Tests d'intégration

À la fin de la semaine 1, ces tests doivent passer :

### Test 1 — Connexion basique
- [ ] L'app se lance sans erreur
- [ ] Le client Supabase est initialisé correctement
- [ ] Un appel SELECT simple fonctionne

### Test 2 — Authentification
- [ ] Un utilisateur peut se connecter avec email + mot de passe
- [ ] La session est persistée après redémarrage de l'app
- [ ] La déconnexion fonctionne correctement

### Test 3 — RLS
- [ ] Un utilisateur connecté peut lire ses propres données
- [ ] Un utilisateur ne peut PAS lire les données d'un autre utilisateur
- [ ] Un utilisateur non connecté ne peut rien lire

### Test 4 — Offline
- [ ] L'app continue de fonctionner en mode avion (lecture seule)
- [ ] Les données déjà chargées restent accessibles
- [ ] Le mode offline est clairement signalé (bandeau)

---

## Partie D — Validation finale par Gabin

Avant de passer à la semaine 2 :

- [ ] Gabin reçoit le rapport hebdomadaire de Claude Code
- [ ] Gabin teste l'app sur son téléphone
- [ ] Gabin valide que la connexion à sa base existante fonctionne
- [ ] Gabin vérifie qu'aucune donnée n'est exposée par erreur
- [ ] Gabin donne le feu vert pour la semaine 2

---

## En cas de blocage

### Erreur "Variables Supabase manquantes"
→ Vérifier que `.env` est bien à la racine et contient les bonnes variables
→ Redémarrer Expo après modification de `.env` (les variables sont chargées au démarrage)

### Erreur RLS "permission denied"
→ Vérifier que l'utilisateur est bien authentifié
→ Vérifier que les RLS de la table autorisent la requête
→ Tester avec la service_role en dev pour confirmer que les données existent

### Erreur de version
→ Vérifier la compatibilité Expo SDK 51 + Supabase JS client
→ Si problème : `npm install @supabase/supabase-js@latest`

### Données manquantes après connexion
→ La base actuelle peut ne pas avoir encore les tables `app_*`
→ Voir Partie 1 de l'architecture pour les CREATE TABLE à exécuter en semaine 2

---

## Récapitulatif des livrables semaine 1

À la fin de cette checklist :

- ✅ `.env` configuré localement (Gabin)
- ✅ `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.sql` exporté (Gabin)
- ✅ `docs/architecture/06_RLS_POLICIES_ACTUELLES.sql` exporté (Gabin)
- ✅ `src/lib/supabase.ts` créé (Claude Code)
- ✅ `src/types/database.types.ts` généré (Claude Code)
- ✅ Hook `useAuth()` fonctionnel (Claude Code)
- ✅ Écran de login basique (Claude Code)
- ✅ Tests d'intégration passants
- ✅ Rapport hebdomadaire dans `roadmap/rapports/semaine-1.md`

---

*Checklist Setup Supabase — OXV Coach — Mai 2026*
*À compléter à 100% avant le démarrage de la semaine 2.*
