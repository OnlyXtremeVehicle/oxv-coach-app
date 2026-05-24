# Code V1 récupéré pour la V2

> Inventaire des fichiers récupérés de la V1 OXV App (mai 2026), copiés tels quels dans le dossier V2.
> Claude Code doit utiliser ce code comme **brique de base** sans le réécrire, mais peut l'adapter au besoin.

---

## Contexte

La V1 d'OXV App a été développée en mai 2026 avec Claude Code et **ne convient pas** au pilote (Gabin) pour plusieurs raisons :

- Système de scoring QDI (Quality Driving Index) avec niveaux gamifiés (elite/or/argent/bronze) qui **contredisent la doctrine OXV** ("miroir pas coach")
- Charte graphique mélangée (rouge `#E63946` + or `#FFB703` qui ne sont pas les vrais codes OXV)
- Onglets `Live` en temps réel qui violent la doctrine "silence en piste"
- Onboarding 5 étapes "identité/photo/permissions" sans les écrans philosophiques (doctrine, méthode, pacte)
- Structure de routing inadaptée aux 26 écrans V2

**Cependant**, la V1 contient du **code de qualité** issu d'un PoC `oxv-telemetry` validé en condition réelle (RaceBox Mini S). Ce code est récupéré tel quel pour gagner plusieurs semaines de développement.

---

## Fichiers copiés depuis la V1

### Parser UBX RaceBox

**Fichier** : `src/ubx/parser.ts` (150 lignes)

Décode les trames UBX du RaceBox Mini S sur Bluetooth :
- Vérification du checksum Fletcher-8
- Détection des trames RACEBOX_DATA (88 octets)
- Extraction des données : timestamp, GPS (lat, lon, altitude, accuracy, satellites), motion (speed, heading), IMU (g-force XYZ, rotation rate XYZ), batterie

**À garder tel quel.** Aucune modification nécessaire pour la V2.

---

### Service BLE

**Fichier** : `src/ble/bluetoothService.ts` (274 lignes)

Gère toute la connexion Bluetooth avec le RaceBox :
- Scan des appareils (filtre par nom "RaceBox")
- Connexion + découverte des services UART
- Souscription aux notifications (caractéristique TX)
- Buffer de trames + parser intégré
- Listeners pattern (`onStatusChange`, `onDeviceFound`, `onData`, `onError`)
- Calcul du débit en Hz (devrait être ~25 Hz)
- Reconnexion automatique

**À garder tel quel.** Adapter les listeners pour les brancher aux nouveaux stores Zustand V2.

**Note technique** : utilise `react-native-ble-plx` v3.2 et le polyfill `buffer`.

---

### Types télémétrie

**Fichier** : `src/types/telemetry.ts` (190 lignes)

Types TypeScript pour toute la chaîne télémétrie :
- `RACEBOX_PROTOCOL` (constantes UUID Bluetooth)
- `GpsFix` (enum)
- `RaceBoxData` (trame parsée complète)
- `BleStatus`, `RaceBoxDevice`
- `TelemetrySession`, `SessionStatus`
- `Lap`, `Circuit`

**À garder tel quel.** Aligné avec les vraies tables Supabase de production.

---

### Types généraux

**Fichier** : `src/types/index.ts`

Types métier : `OxvUser`, `PilotLevel`, `ExperienceYears`, `EmergencyRelation`, etc.

**À garder, mais à enrichir** avec les types de la V2 (états S1-S10 de la state machine).

---

### Utilitaires

**Fichier** : `src/utils/geo.ts` (64 lignes)

Calculs géographiques : distance Haversine, conversion degré/radian, bearing.

**À garder tel quel.**

**Fichier** : `src/utils/lapDetection.ts` (132 lignes)

Algorithme de détection des tours :
1. Calibration ligne d'arrivée (point GPS + rayon, typ. 30m)
2. Détection entrée/sortie de zone
3. Cooldown 10 secondes anti-faux-positifs
4. Premier tour = outlap (mise en route)

**À garder tel quel.** Pour V2, ajouter à terme la vérification de direction (bearing) et la détection de secteurs.

**Fichier** : `src/utils/validation.ts` (66 lignes)

Validations basiques : email, téléphone français, handle utilisateur.

**À garder tel quel.**

---

### Services

**Fichier** : `src/services/sessionsService.ts` (453 lignes)

CRUD complet pour les sessions de télémétrie :
- `fetchPreviousSessions` (avec filtres)
- `fetchAllSessions`
- `calculateGlobalStats` (stats all-time)
- `deleteSession`, `renameSession`
- Type `SpeedSample` pour l'historique vitesse

**À garder tel quel.** C'est le pont entre l'app et Supabase pour tout ce qui concerne les sessions de pilotage.

**Fichier** : `src/services/weatherService.ts` (356 lignes)

Service météo Open-Meteo (API européenne RGPD-friendly, gratuite) :
- Récupération des données actuelles
- Capture before/during/after pour chaque session
- Cache 10 minutes
- Persistance dans `weather_snapshots` (table déjà existante)

**À garder tel quel.** Utilisé pour enrichir le bilan avec le contexte météo.

---

### Client Supabase

**Fichier** : `src/supabase/client.ts`

Client Supabase configuré avec `expo-secure-store` pour stocker les tokens d'auth de manière chiffrée (bonne pratique sécurité mobile).

**À garder tel quel.** Connecté à votre vraie base Supabase via les variables d'environnement.

**Note** : ce fichier remplace le `src/lib/supabase.ts.template` que j'avais préparé en V0 du dossier. Il est plus complet (gestion SecureStore).

---

## Configuration projet (récupérée V1)

### app.json

Configuration Expo avec :
- Bundle ID `fr.oxvehicle.app`
- Permissions iOS (Bluetooth, Location, Camera, Photo, Notifications)
- Permissions Android (équivalent)
- Apple Sign-In activé
- Plugins : expo-router, react-native-ble-plx, expo-image-picker, expo-secure-store, Sentry
- `userInterfaceStyle: dark` (mode sombre forcé)
- Splash screen avec fond `#0B1220`

**À garder, mais à mettre à jour** :
- Vérifier que `version` est `1.0.0` pour la V2
- `buildNumber` à incrémenter à chaque build
- Le `projectId` EAS doit être ré-attribué si on repart d'un nouveau projet EAS

### package.json

Liste de toutes les dépendances V1 (testées et fonctionnelles).

**Sauvegardé sous `package.json.v1`** pour référence. Claude Code doit régénérer un `package.json` propre en démarrant un nouveau projet Expo SDK 51.

**Dépendances à conserver** :
- `expo` ~51.0.28
- `expo-router` ~3.5.23
- `react-native-ble-plx` ^3.2.0
- `@supabase/supabase-js` ^2.45.4
- `zustand` ^5.0.13
- `expo-secure-store` ~13.0.2
- `react-native-svg` 15.2.0
- `@react-native-community/datetimepicker` ^8.2.0
- Polices Google : `@expo-google-fonts/inter`, `@expo-google-fonts/syncopate`
- `buffer` ^6.0.3 (polyfill pour parser UBX)
- `react-native-keyboard-aware-scroll-view` ^0.9.5
- `react-native-toast-message` ^2.2.0

**Dépendances optionnelles à discuter** :
- `@sentry/react-native` : monitoring crash en production (recommandé pour V1 commerciale)
- `expo-apple-authentication` : Sign in with Apple (peut être V1.1)
- `expo-local-authentication` : Face ID / Touch ID (peut être V1.1)

### Autres fichiers

- `babel.config.js` : config Babel avec resolver pour les alias `@/`
- `metro.config.js` : config Metro bundler
- `tsconfig.json` : config TypeScript avec paths
- `eas.json` : config EAS Build (development, preview, production)

**À garder tel quel.**

---

## Migrations Supabase déjà appliquées

Le dossier `supabase/migrations/` contient les 6 migrations SQL qui ont créé l'infrastructure télémétrie actuelle :

| Fichier | Rôle |
|---|---|
| `0001_module_a_auth.sql` | Tables users, vehicles, documents (déjà partiellement présentes) |
| `0002_remove_medical_data.sql` | Suppression des données médicales sensibles |
| `0003_telemetry_sessions.sql` | Création table `telemetry_sessions` |
| `0004_laps_and_circuits.sql` | Création tables `laps` et `circuits` |
| `0005_haute_saintonge_weather_bilan.sql` | Création `weather_snapshots` + enrichissement circuits |
| `0006_verify_and_fix.sql` | Corrections et vérifications |

**Important pour Claude Code** : ces migrations ont **DÉJÀ été appliquées en production**. Ne PAS les ré-exécuter. Elles sont là à titre de **référence historique** pour comprendre l'évolution du schéma.

Voir `docs/architecture/05_SCHEMA_SUPABASE_ACTUEL.md` pour la **réalité actuelle** de la base.

---

## Ce qui N'EST PAS récupéré de la V1 (volontairement écarté)

### Système QDI

Fichier V1 : `src/utils/drivingQuality.ts` (300 lignes)

**Pourquoi écarté** : ce système calcule un score "Quality Driving Index" sur 5 piliers (Trajectory, Smoothness, Braking, Acceleration, Chrono) avec des niveaux Elite/Solide/À travailler/Base.

Cela **contredit fondamentalement** la doctrine OXV "miroir pas coach" :
- Donne des notes au pilote (gamification)
- Hiérarchise (Elite vs Base)
- Suggère implicitement qu'il y a un "bon" pilotage objectif

La V2 le remplace par :
- **Marge composite** (le 24% central du bilan)
- **Étiquettes humaines** ("Confortable", "À explorer", "Terrain serré")
- **Observations qualitatives** sans note

**Conséquence pour Claude Code** : la table `qdi_scores` existe en base mais ne doit pas être utilisée par la V2. À discuter avec Gabin en semaine 1 si on la supprime ou si on la garde en interne admin.

---

### Charte graphique V1

Fichiers V1 : `src/theme/colors.ts`, `src/theme/typography.ts`

**Pourquoi écartée** : la V1 utilise un mix de couleurs (`#E63946` rouge + `#FFB703` "performance/copper") qui ne sont **pas la vraie charte OXV**.

La V2 utilise la charte officielle :
- Rouge OXV strict : `#C8102E` (insigne, accents)
- Or Heritage : `#C4A459` (réservé Heritage uniquement)
- Bronze admin : `#B87333` (réservé admin uniquement)
- Vert marge : `#97C459`
- Orange marge : `#EF9F27`

Voir `docs/screens/01_DESIGN_TOKENS.md` pour la charte complète.

**Cependant** : la V1 utilise les polices **Syncopate** (titres italiques uppercase) et **Inter** (corps) qui sont des bonnes intuitions. La V2 peut les conserver via `@expo-google-fonts/inter` et `@expo-google-fonts/syncopate` (déjà dans package.json V1).

---

### Écrans V1

Tout le dossier `app/` de la V1 (Expo Router) est **écarté** :
- `(auth)/` : login, signup, forgot-password, welcome, doctrine, methode
- `(onboarding)/` : step1-identity, step2-pilot, step3-emergency, step4-photo, step5-permissions, pacte
- `(tabs)/` : index, sessions, live, profile
- `(app)/` : index, profile, session/[id], calibrate-circuit
- Routes profil : delete-account, security, notifications

**Pourquoi écartés** : la structure de routing V1 ne correspond pas aux 26 écrans V2 définis dans `docs/screens/00_OVERVIEW_26_ECRANS.md`. Claude Code doit recréer une arborescence propre à partir de la spec V2.

**Cependant**, Claude Code peut **s'inspirer** des écrans V1 pour les patterns React Native (KeyboardAwareScrollView, Toast, etc.) sans copier le contenu.

---

### Stores Zustand V1

Fichiers V1 : `src/store/useAuthStore.ts`, `useCircuitsStore.ts`, `useOnboardingStore.ts`, `useProfileStore.ts`, `useTelemetryStore.ts`

**Pourquoi écartés** : les stores V1 dépendent du modèle de données V1 (notamment QDI, états V1). La V2 a besoin de ses propres stores alignés sur la state machine S1-S10.

**Cependant**, les **patterns d'usage** sont bons (zustand + supabase actions). Claude Code peut s'en inspirer pour la structure :
- Un store par domaine fonctionnel
- Actions async définies dans le store
- Pattern `set((state) => ({ ... }))`
- Sélecteurs typés

---

## Stratégie pour Claude Code

### Semaine 1 — Démarrage

1. Initialiser un nouveau projet Expo SDK 51 + TypeScript
2. **Copier** les fichiers du dossier `src/` actuel (déjà fournis)
3. Régénérer `package.json` à partir de `package.json.v1` (mêmes dépendances)
4. Conserver `app.json`, `babel.config.js`, `metro.config.js`, `tsconfig.json`, `eas.json` (déjà copiés)
5. Tester que l'app build et se connecte à Supabase
6. Premier rapport de fin de semaine

### Semaine 2 — Nouveaux stores V2

Réécrire les stores Zustand alignés sur la V2 :
- `useAppStateStore` : la state machine S1-S10
- `useAuthStore` : auth Supabase (V1 réutilisable)
- `useSessionsStore` : sessions télémétrie (V1 réutilisable)
- `useTelemetryStore` : data live BLE + parser
- `useUIStore` : navigation, mode actuel, préférences UI

### Semaine 3-4 — BLE + Parser

Brancher le service BLE existant (V1) sur les nouveaux stores V2. Tester avec un vrai RaceBox.

### Semaine 5+

Démarrer le développement des 26 écrans V2 selon `docs/screens/00_OVERVIEW_26_ECRANS.md`.

---

## Récapitulatif

| Élément | Status | Action Claude Code |
|---|---|---|
| Parser UBX | ✅ Fourni V1 | Garder tel quel |
| Service BLE | ✅ Fourni V1 | Garder tel quel, brancher sur stores V2 |
| Types télémétrie | ✅ Fourni V1 | Garder + enrichir |
| Utils geo/lap/validation | ✅ Fourni V1 | Garder tel quel |
| Service météo | ✅ Fourni V1 | Garder tel quel |
| Service sessions | ✅ Fourni V1 | Garder tel quel |
| Client Supabase | ✅ Fourni V1 | Garder tel quel |
| Config Expo (app.json, etc.) | ✅ Fourni V1 | Adapter version + bundle ID |
| Migrations Supabase | 📚 Référence | Ne PAS ré-exécuter |
| QDI scoring | ❌ Écarté | Ne PAS utiliser |
| Charte V1 colors.ts | ❌ Écarté | Utiliser `tokens.ts` V2 |
| Écrans V1 (app/) | ❌ Écarté | Recréer selon V2 |
| Stores V1 | ❌ Écarté | Réécrire alignés V2 |

---

## Gain de temps estimé

En réutilisant le code V1 ci-dessus, Claude Code économise environ **3 à 4 semaines** de développement :

- Semaine 3 (BLE) : prêt à 80%
- Semaine 4 (Parser UBX) : prêt à 100%
- Semaine 9 (services backend) : prêt à 60%

Soit un total de **3,5 semaines économisées** sur les 14 semaines prévues.

---

*Document généré le 24 mai 2026.*
*À lire par Claude Code en complément de CLAUDE.md.*
