# Instructions pour Claude Code — Projet OXV Coach

> Ce fichier est ton point d'entrée. Lis-le complètement avant tout travail.

---

## Qui je suis

Tu es Claude Code, assistant développement intégré à ce projet OXV Coach. Tu vas coder une **application mobile React Native** complète à partir d'un dossier de spécifications produites en amont par Claude (conversation chat) et son utilisateur Gabin Dupont.

Le projet est mature : 26 écrans maquettés, architecture technique complète en 3 parties, dispositif juridique en 5 documents, et un plan de test alpha pour juillet 2026. **Tu ne pars pas de zéro.** Tu implémentes une vision qui existe déjà.

---

## Le projet en une phrase

OXV Coach est l'**application mobile compagnon** d'OXV (Only Xtreme Vehicle), plateforme premium de track day au Circuit de Haute Saintonge en France. L'app fournit aux pilotes une lecture posée et qualitative de leur conduite **après chaque session**, à partir de données télémétriques collectées par un boîtier Bluetooth (RaceBox Mini).

**Doctrine fondatrice** : *"L'app est un miroir. Elle vous montre. Elle ne vous dirige pas. La piste est à vous. Les décisions aussi."*

---

## Principes non négociables

Ces principes sont issus de mois de réflexion produit. **Tu ne les remets pas en cause.** Si tu trouves qu'un principe pose problème, tu poses la question à Gabin avant de t'écarter.

### Principe 1 — Sécurité avant performance

L'app ne pousse jamais le pilote à dépasser ses limites. Elle identifie à chaque session **une seule zone** à explorer en sécurité, et **une zone** à conserver en l'état. Le mot "limite" est volontairement remplacé par "marge" partout dans l'app.

### Principe 2 — L'app est un miroir, pas un coach

Aucune instruction de pilotage, jamais. L'app décrit ce qui s'est passé, propose des observations qualitatives, pose des questions ouvertes. Les conclusions appartiennent au pilote.

**Verbes interdits dans le contenu :**
- "Freinez plus tôt", "Accélérez à la sortie", "Prenez une trajectoire plus serrée"
- "Vous devriez", "Il faut", "Évitez de"

**Verbes autorisés :**
- "Une zone à observer", "À creuser la prochaine fois"
- "Était-ce volontaire ?", "Que sentez-vous ?"
- "Confortable", "Terrain serré", "Apprivoisé"

### Principe 3 — Silence en piste

Pendant que le véhicule est en mouvement, **aucun écran n'est affiché**. Aucune notification. Aucun son. Aucun HUD. Le pilote conduit, l'équipement enregistre, l'app dort.

### Principe 4 — Ton OXV

- **Vouvoiement systématique** (clientèle premium)
- **Pas d'emojis** sauf si explicitement demandé
- **Pas de marketing creux** ("Découvrez la révolution du pilotage" → interdit)
- **Phrases courtes, mots qui pèsent**
- **Style "Ferrari sec et minimaliste"**

### Principe 5 — Un seul chiffre par écran

Chaque écran a un seul indicateur central majeur (la marge globale en %). Tout le reste est qualitatif : couleurs, étiquettes humaines, indicateurs visuels.

---

## Plan de travail hebdomadaire

Tu vas développer l'app **par étapes hebdomadaires**, validées par Gabin à chaque fin de semaine. Le plan détaillé est dans `roadmap/SEMAINES.md`.

**Vue d'ensemble** :
- Semaines 1-2 : Fondations (setup, Supabase, auth)
- Semaines 3-4 : BLE RaceBox + parser UBX
- Semaines 5-7 : Cœur de l'app (5 écrans principaux + algorithmes V1)
- Semaines 8-10 : Écrans secondaires (onboarding, settings, comparateur)
- Semaines 11-12 : Écrans de bord, polish, tests
- Semaines 13-14 : Soumission App Store + Google Play

À chaque fin de semaine :
1. Tu produis un **rapport hebdomadaire** dans `roadmap/rapports/semaine-N.md`
2. Tu commits ton travail sur Git
3. Tu attends la validation de Gabin avant de passer à la semaine suivante

---

## Stack technique imposée

Tu n'as pas le choix sur la stack. Elle est définie dans `docs/architecture/01_PARTIE_1_stack_supabase.md`.

**Pour rappel rapide** :
- **Framework** : React Native + Expo SDK 51 + TypeScript
- **State management** : Zustand
- **Persistance locale** : WatermelonDB (offline-first)
- **Backend** : Supabase Pro (déjà existant chez Gabin, project Frankfurt)
- **BLE** : react-native-ble-plx
- **Parser UBX** : Rust compilé en WASM (ou parser JavaScript pur si trop complexe — à discuter)
- **CI/CD** : GitHub Actions + EAS Build

**Important** : utilise les **conventions de code suivantes** :
- TypeScript strict mode activé
- Pas de `any` sauf cas exceptionnel justifié
- Hooks fonctionnels, pas de classes
- Tests unitaires Jest sur la business logic uniquement
- Pas de localStorage/sessionStorage (cassent l'offline-first)

---

## Documents à lire dans l'ordre

Quand tu démarres, tu lis les documents dans cet ordre **strict** :

### Étape 1 — Comprendre la doctrine
1. `docs/screens/00_OVERVIEW_26_ECRANS.md` — Vue d'ensemble des écrans
2. `docs/screens/01_DESIGN_TOKENS.md` — Charte graphique complète (couleurs, typo, espacements)
3. `docs/juridique/01_PACTE_DE_PILOTAGE.md` — La doctrine OXV en clair

### Étape 2 — Comprendre l'architecture
4. `docs/architecture/01_PARTIE_1_stack_supabase.md` — Stack et schéma Supabase (vision globale)
5. `docs/architecture/02_PARTIE_2_algorithmes.md` — Modèles physiques et algos
6. `docs/architecture/03_PARTIE_3_deploiement.md` — Déploiement et coûts
7. `docs/architecture/04_SUPABASE_CONNECTION_GUIDE.md` — Comment se connecter à la base existante
8. **`docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md`** — **SCHÉMA RÉEL DE PRODUCTION** (CRITIQUE)
9. **`docs/architecture/06_RLS_POLICIES_ACTUELLES.sql`** — Policies de sécurité déjà en place
10. **`docs/architecture/07_CODE_V1_RECUPERE.md`** — **CODE V1 RÉUTILISÉ** (parser UBX, BLE, services)
11. **`docs/architecture/08_CONNEXION_PROGRESSION_SITE_APP.md`** — Cahier des charges progression site web

### Étape 3 — Comprendre les écrans et la navigation
8. `docs/sitemap/01_architecture_statique.md` — Quels écrans existent
9. `docs/sitemap/02_parcours_temporel.md` — Quand ils apparaissent
10. `docs/sitemap/03_flux_navigation.md` — Comment on y accède
11. `docs/sitemap/04_state_machine.md` — Logique métier des états

### Étape 4 — Suivre le plan
12. `roadmap/SEMAINES.md` — Ta feuille de route hebdomadaire
13. `roadmap/SETUP_SUPABASE.md` — Checklist détaillée semaine 1

### Étape 5 — Connaître le cadre légal
14. `docs/juridique/02_CGU_APP_OXV_COACH.md` — Limites légales du produit
15. `docs/juridique/04_POLITIQUE_CONFIDENTIALITE.md` — Obligations RGPD

### Fichiers templates à utiliser
- `src/lib/supabase.ts.template` — À renommer en `.ts` et adapter
- `src/theme/tokens.ts.template` — À renommer en `.ts` et utiliser partout
- `.env.example` — À copier en `.env` (Gabin remplit les valeurs)
- `.gitignore` — Déjà configuré pour exclure les secrets

### Code V1 récupéré dans src/ (À RÉUTILISER TEL QUEL)
- `src/ubx/parser.ts` — Parser UBX RaceBox Mini S (150 lignes, validé en prod)
- `src/ble/bluetoothService.ts` — Service BLE complet (274 lignes)
- `src/types/telemetry.ts` — Types télémétrie (190 lignes)
- `src/types/index.ts` — Types métier généraux
- `src/utils/geo.ts` — Calculs géographiques (Haversine)
- `src/utils/lapDetection.ts` — Détection automatique des tours
- `src/utils/validation.ts` — Validations email/téléphone/handle
- `src/services/weatherService.ts` — Service météo Open-Meteo
- `src/services/sessionsService.ts` — CRUD sessions télémétrie
- `src/supabase/client.ts` — Client Supabase avec SecureStore

**Important** : ne PAS réécrire ces fichiers, ils sont déjà fonctionnels et testés.
Voir `docs/architecture/07_CODE_V1_RECUPERE.md` pour les détails et la stratégie de réutilisation.

### Configuration projet récupérée
- `app.json` — Config Expo (bundle ID, permissions, plugins)
- `package.json.v1` — Liste des dépendances V1 à reprendre
- `babel.config.js`, `metro.config.js`, `tsconfig.json`, `eas.json`

### Migrations Supabase de référence
- `supabase/migrations/0001-0006_*.sql` — DÉJÀ APPLIQUÉES en production, ne PAS ré-exécuter

---

## Ce que tu peux faire en autonomie

Tu peux décider seul de :
- L'**organisation du code** (structure des dossiers, conventions de nommage)
- Les **bibliothèques tierces** (à condition qu'elles soient open source et maintenues)
- Les **tests unitaires** (couverture, choix des tests à écrire)
- La **gestion d'erreurs** (try/catch, fallbacks)
- Les **micro-décisions UX** (animations, transitions, espacements précis)

---

## Ce que tu dois faire valider par Gabin

Tu dois demander avant de :
- Changer une **règle de doctrine** (par exemple : "et si on ajoutait un classement entre pilotes ?")
- Modifier le **schéma Supabase existant** (Gabin a déjà une base en production sur oxvehicle.fr)
- Ajouter une **dépendance critique** (paiement, analytics, cloud)
- Supprimer ou fusionner un **écran maquetté**
- Modifier un **texte juridique** (CGU, pacte, etc.)
- Dévier du **planning hebdomadaire** établi

---

## Rapport de fin de semaine

À la fin de chaque semaine, crée un fichier `roadmap/rapports/semaine-N.md` avec :

```markdown
# Rapport de fin de semaine N

## Ce que j'ai fait
- [liste des tâches accomplies]

## Ce qui est testé et fonctionnel
- [liste des fonctionnalités validées]

## Ce qui reste en suspens
- [liste avec raisons]

## Questions pour Gabin
- [questions à valider avant la semaine suivante]

## Recommandations
- [suggestions d'amélioration ou ajustements de roadmap]

## Estimation pour la semaine suivante
- [tâches prévues + temps estimé]
```

---

## Particularités du projet à connaître

**Sur les algorithmes** : la Partie 2 de l'architecture mentionne des modèles physiques complexes (Pacejka, filtre de Kalman, etc.). Pour la V1, tu peux implémenter des **versions simplifiées** qui ne nécessitent pas de calibration extensive. Le but est d'avoir une app fonctionnelle, pas un simulateur de F1.

**Sur le RaceBox** : si tu n'as pas accès à un vrai RaceBox pendant le dev, **utilise des fichiers UBX de test** (dataset à demander à Gabin ou à générer artificiellement). La sortie publique de RaceBox propose des exemples sur GitHub.

**Sur les écrans** : les maquettes V3 sont dans `docs/screens/` sous forme de descriptions textuelles (les visuels SVG/HTML originaux étaient dans la conversation chat). Tu implémentes en React Native en respectant l'esprit décrit.

**Sur le déploiement** : tu ne déploies pas en production sans accord explicite. Tu peux faire des builds de développement et de preview (TestFlight interne), mais la soumission App Store réelle attend.

---

## En cas de doute

Si tu hésites sur un choix, voici l'ordre de priorité des sources d'information :

1. **Ce fichier CLAUDE.md** (les principes non négociables)
2. **Les documents `docs/`** (les spécifications)
3. **Le sitemap `docs/sitemap/04_state_machine.md`** (la logique métier)
4. **Le ton OXV** (vouvoiement, sec, sans emoji)
5. **Si vraiment bloqué** : pose une question dans le rapport hebdomadaire, ne fais pas de choix arbitraire

**Règle d'or** : *en cas de doute, fais simple et conforme à la doctrine, pas complexe et innovant.*

---

## Démarrage

Quand tu es prêt :
1. Lis les documents dans l'ordre étape 1 → 5
2. Crée un rapport `roadmap/rapports/semaine-0-onboarding.md` qui montre que tu as bien compris le projet
3. Pose toutes les questions de clarification à Gabin
4. Démarre la semaine 1 selon `roadmap/SEMAINES.md`

Bienvenue dans OXV Coach.

— Claude (l'autre, dans le chat)
