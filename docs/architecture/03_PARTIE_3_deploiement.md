# 🏎️ OXV Mirror — Architecture technique (Partie 3)

> **Connectivité BLE, déploiement, sécurité, coûts**
> Document final de la trilogie d'architecture
> Version : 1.0 · Mai 2026
> Prérequis : Parties 1 et 2 lues

---

## Sommaire

1. [Connexion BLE au RaceBox Mini](#1-connexion-ble-au-racebox-mini)
2. [Bouton BLE de marquage tour](#2-bouton-ble-de-marquage-tour)
3. [Sync offline-first WatermelonDB ↔ Supabase](#3-sync-offline-first)
4. [Permissions iOS et Android](#4-permissions-ios-et-android)
5. [Build et déploiement EAS](#5-build-et-déploiement-eas)
6. [TestFlight et Google Play](#6-testflight-et-google-play)
7. [CI/CD GitHub Actions](#7-cicd-github-actions)
8. [RGPD et données télémétriques](#8-rgpd-et-données-télémétriques)
9. [Coûts récurrents annuels](#9-coûts-récurrents-annuels)
10. [Estimation d'effort détaillée](#10-estimation-deffort-détaillée)
11. [Plan de lancement recommandé](#11-plan-de-lancement-recommandé)

---

## 1. Connexion BLE au RaceBox Mini

### 1.1. Le protocole RaceBox

Le RaceBox Mini expose un **service BLE GATT** avec plusieurs caractéristiques. RaceBox publie un SDK officiel sur GitHub (`racebox-mini-sdk`) documentant l'intégralité du protocole. Les éléments clés :

- **Service principal** : UUID propriétaire RaceBox
- **Caractéristique de données** : notifications en streaming des trames UBX
- **Caractéristique de commande** : configuration du device (start/stop logging, paramètres)
- **Caractéristique de transfert de fichier** : téléchargement des sessions stockées en interne

**Note importante** : les UUIDs exacts doivent être lus depuis la doc officielle RaceBox au moment du développement — ils peuvent évoluer avec les firmwares.

### 1.2. États de la connexion BLE

L'app doit gérer une machine à états robuste :

```
┌──────────────┐
│ DISCONNECTED │ ◄────────────┐
└──────┬───────┘              │
       │ scan                 │
       ▼                      │
┌──────────────┐              │
│   SCANNING   │              │
└──────┬───────┘              │
       │ device found         │
       ▼                      │
┌──────────────┐              │
│  CONNECTING  │              │
└──────┬───────┘              │
       │ services discovered  │
       ▼                      │
┌──────────────┐              │
│   READY      │              │
└──────┬───────┘              │
       │ start logging        │
       ▼                      │
┌──────────────┐              │
│   LOGGING    │              │
└──────┬───────┘              │
       │ stop / disconnect    │
       │ ────────────────────►│
       │ error                │
       ▼                      │
┌──────────────┐              │
│ ERROR_RETRY  │ ─────────────┘
└──────────────┘
   (auto-reconnect)
```

### 1.3. Reconnexion automatique

Au circuit, la connexion BLE peut se perdre (interférences, distance, batterie qui faiblit). L'app doit :

- **Détecter la déconnexion** dans les 2-3 secondes
- **Tenter une reconnexion automatique** jusqu'à 5 fois avec backoff exponentiel (1s, 2s, 4s, 8s, 16s)
- **Continuer le logging localement** sur le téléphone pendant la perte (si possible avec GPS du téléphone en fallback)
- **Notifier le pilote** uniquement si reconnexion impossible après 60s

```typescript
class RaceBoxConnectionManager {
  private state: ConnectionState = 'DISCONNECTED';
  private retryCount = 0;
  private maxRetries = 5;

  async connect(deviceId: string): Promise<void> {
    this.state = 'CONNECTING';
    try {
      await this.bleManager.connectToDevice(deviceId);
      await this.discoverServices();
      this.state = 'READY';
      this.retryCount = 0;
      this.subscribeToDataStream();
    } catch (e) {
      await this.handleDisconnect();
    }
  }

  private async handleDisconnect(): Promise<void> {
    if (this.retryCount >= this.maxRetries) {
      this.state = 'DISCONNECTED';
      this.notifyUser('Connexion RaceBox perdue. Redémarrage manuel requis.');
      return;
    }

    this.state = 'ERROR_RETRY';
    const delay = Math.pow(2, this.retryCount) * 1000;
    this.retryCount++;
    await sleep(delay);
    await this.connect(this.lastDeviceId);
  }
}
```

### 1.4. Téléchargement post-session

Quand le pilote termine sa session, on télécharge le fichier UBX stocké en interne du RaceBox :

- **Taille typique** : 25-30 Mo pour 2h de session
- **Débit BLE 4.2** : ~10-15 Ko/s avec Mini
- **Durée estimée** : 30-50 secondes
- **Affichage** : barre de progression dans l'app pendant le download

**Optimisation** : si le pilote a connecté son téléphone au RaceBox pendant la session, on streame les données en live et le fichier est déjà en local — pas besoin de re-télécharger.

### 1.5. Librairies React Native

- **`react-native-ble-plx`** (v3.x) — la lib BLE la plus mature, support iOS + Android
- **Alternative** : `react-native-ble-manager` mais moins activement maintenu

```typescript
import { BleManager } from 'react-native-ble-plx';

const bleManager = new BleManager();

// Scan pour trouver le RaceBox
bleManager.startDeviceScan(
  [RACEBOX_SERVICE_UUID],
  null,
  (error, device) => {
    if (error) return handleError(error);
    if (device?.name?.startsWith('RaceBox')) {
      bleManager.stopDeviceScan();
      connectToDevice(device);
    }
  }
);
```

---

## 2. Bouton BLE de marquage tour

### 2.1. Recommandation matérielle

Le bouton BLE doit être :
- Petit (fixable au volant ou sur le levier de vitesse)
- Résistant aux vibrations
- Autonomie minimale 3-6 mois sur pile
- Protocole BLE standard (HID ou BLE custom selon modèle)

**Modèles candidats** (à valider compatibilité React Native) :

| Modèle | Format | Protocole | Prix indicatif |
|---|---|---|---|
| **Flic 2** (Shortcut Labs) | Pastille adhésive | BLE custom + SDK | ~35-45€ |
| **Satechi Button** | Pastille volume | BLE HID | ~25-30€ |
| **Bouton custom Adafruit nRF52** | DIY | BLE BTLE | ~15-20€ |

Mon choix recommandé : **Flic 2**. Le SDK Flic est mature, supporté React Native, et la build qualité est suffisante pour environnement automobile. À tester côté humidité et vibrations sur 2-3 sessions.

### 2.2. Inclusion dans le pack OXV

Suggestion d'intégration commerciale :

- **Access** : pas inclus
- **Signature** : pas inclus, mais option achat à 49€
- **Promotion** : inclus
- **Heritage** : inclus + version personnalisée OXV (logo gravé)

Le bouton est jumelé une fois pour toutes lors de la première session du pilote. L'ID du bouton est stocké dans `app_user_progression.ble_marker_button_id`.

### 2.3. Logique de marquage

Le bouton émet un signal BLE à chaque pression. L'app capte ce signal et pose un timestamp dans la télémétrie :

```typescript
flicManager.onButtonClick((button) => {
  const timestamp = Date.now();
  currentSession.markers.push({
    timestamp_ms: timestamp,
    button_id: button.uuid,
    kind: 'pilot_marker',  // type par défaut
  });
});

// Double-clic = marqueur "incident"
flicManager.onButtonDoubleClick((button) => {
  const timestamp = Date.now();
  currentSession.markers.push({
    timestamp_ms: timestamp,
    button_id: button.uuid,
    kind: 'incident',  // pour les sorties de piste, etc.
  });
});

// Triple-clic = marqueur "question" pour debrief
flicManager.onButtonTripleClick((button) => {
  currentSession.markers.push({
    timestamp_ms: Date.now(),
    button_id: button.uuid,
    kind: 'question',
  });
});
```

### 2.4. Affichage des tours marqués

Dans l'écran 2 (Tour par tour), les tours qui contiennent au moins un marqueur affichent une **petite icône** à côté de leur numéro :
- ⭐ Marqueur simple (`pilot_marker`)
- ⚠️ Incident (`incident`)
- ❓ Question (`question`)

Lors du tri, ces tours apparaissent en premier — c'est ce que le pilote vient chercher dans son debrief.

---

## 3. Sync offline-first

### 3.1. Pourquoi offline-first est obligatoire

Au circuit de Haute Saintonge, la couverture 4G est intermittente. Une app qui exige du réseau pour fonctionner est inutilisable. L'approche **offline-first** implique :

- Toutes les écritures vont dans **WatermelonDB local** d'abord
- La sync vers Supabase se fait **en arrière-plan**, quand le réseau revient
- L'UI ne distingue pas les données locales des données synchronisées
- En cas de conflit, la donnée locale gagne (le pilote est la source de vérité)

### 3.2. Architecture WatermelonDB

```
┌─────────────────────────────────────────────────────────┐
│  Composants React Native                                │
└──────────────────────┬──────────────────────────────────┘
                       │ observe()
                       ▼
┌─────────────────────────────────────────────────────────┐
│  WatermelonDB (sur device)                              │
│  Tables: sessions, laps, corners, markers, progression  │
└──────────┬───────────────────────┬──────────────────────┘
           │ writes                │ syncEngine
           │                       ▼
           │             ┌─────────────────────────┐
           │             │  Sync queue             │
           │             │  (offline → online)     │
           │             └──────────┬──────────────┘
           │                        │ when online
           │                        ▼
           │             ┌─────────────────────────┐
           └────────────►│  Supabase Postgres      │
                         │  (source of truth back) │
                         └─────────────────────────┘
```

### 3.3. Stratégie de sync

WatermelonDB a un système de sync intégré basé sur :
- **Timestamps** (`_changed`, `_status`)
- **Conflit resolution** au niveau ligne

```typescript
import { synchronize } from '@nozbe/watermelondb/sync';

async function syncWithSupabase() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const { data } = await supabase
        .from('app_sessions_changes')
        .select('*')
        .gte('updated_at', new Date(lastPulledAt || 0).toISOString());
      return { changes: data, timestamp: Date.now() };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // Push toutes les nouvelles modifications locales vers Supabase
      for (const [tableName, tableChanges] of Object.entries(changes)) {
        if (tableChanges.created.length > 0) {
          await supabase.from(tableName).insert(tableChanges.created);
        }
        if (tableChanges.updated.length > 0) {
          for (const row of tableChanges.updated) {
            await supabase.from(tableName).update(row).eq('id', row.id);
          }
        }
        if (tableChanges.deleted.length > 0) {
          await supabase.from(tableName).delete().in('id', tableChanges.deleted);
        }
      }
    },
  });
}
```

### 3.4. Sync des fichiers UBX

Les fichiers binaires UBX ne passent pas par WatermelonDB. Ils utilisent une file séparée :

```typescript
class UbxUploadQueue {
  async enqueue(localPath: string, sessionId: string): Promise<void> {
    const queueEntry = await database.write(async () => {
      return database.get('ubx_upload_queue').create((entry) => {
        entry.localPath = localPath;
        entry.sessionId = sessionId;
        entry.status = 'pending';
        entry.attempts = 0;
      });
    });

    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (!await isOnline()) return;

    const pending = await database.get('ubx_upload_queue')
      .query(Q.where('status', 'pending'))
      .fetch();

    for (const entry of pending) {
      try {
        await entry.update(e => { e.status = 'uploading'; });
        const fileData = await FileSystem.readAsArrayBufferAsync(entry.localPath);

        await supabase.storage
          .from('telemetry_raw')
          .upload(`${entry.sessionId}.ubx`, fileData, {
            contentType: 'application/octet-stream',
            upsert: true,
          });

        await entry.update(e => { e.status = 'completed'; });
        await FileSystem.deleteAsync(entry.localPath);  // libère l'espace
      } catch (e) {
        await entry.update(en => {
          en.attempts++;
          en.status = en.attempts > 3 ? 'failed' : 'pending';
        });
      }
    }
  }
}
```

### 3.5. Triggers de sync

La sync se déclenche automatiquement :

- À l'**ouverture de l'app** (si pas synced depuis >1h)
- Lors d'un changement de **connectivité réseau** (passage offline → online)
- À la **fermeture d'une session** (priorité haute)
- **Pull-to-refresh** manuel sur les écrans liste

---

## 4. Permissions iOS et Android

### 4.1. Permissions requises

| Permission | iOS | Android | Usage |
|---|---|---|---|
| Bluetooth | `NSBluetoothAlwaysUsageDescription` | `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` | RaceBox + bouton marquage |
| Location | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` | Requis pour BLE scan sur Android |
| Location background | `NSLocationAlwaysAndWhenInUseUsageDescription` | `ACCESS_BACKGROUND_LOCATION` | Logging quand téléphone verrouillé |
| Storage | n/a | `WRITE_EXTERNAL_STORAGE` (API < 29) | Cache fichiers UBX |
| Network state | n/a | `ACCESS_NETWORK_STATE` | Détection online/offline |

### 4.2. Spécificité Android

Android 12+ a **rendu le BLE scanning plus strict** :
- `BLUETOOTH_SCAN` doit être déclaré dans `AndroidManifest.xml`
- Requiert `ACCESS_FINE_LOCATION` pour scanner (sauf si `neverForLocation` flag)
- Background scan requiert un service en foreground avec notification persistante

### 4.3. Spécificité iOS

iOS gère bien le BLE en background si :
- L'app déclare `bluetooth-central` dans `UIBackgroundModes`
- L'app est dans la liste des apps connectables au démarrage

Mais iOS **suspend l'app après 10 minutes en background** si elle ne reçoit pas d'événement BLE. Solution : on garde le RaceBox connecté en permanence pendant la session pour maintenir l'app active.

### 4.4. Écran d'onboarding des permissions

L'app doit demander les permissions de manière progressive et expliquée :

```
1ère ouverture
├── "OXV Mirror a besoin du Bluetooth pour se connecter à votre RaceBox"
│   └── Demande NSBluetooth*
├── "Et de la localisation pendant la session"
│   └── Demande Location (when in use)
└── "Si vous voulez utiliser l'app téléphone verrouillé"
    └── Demande Location (always)
```

Refus de la première = blocage de l'app. Refus de la troisième = mode "téléphone déverrouillé requis".

---

## 5. Build et déploiement EAS

### 5.1. Configuration `eas.json`

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false, "buildConfiguration": "Debug" },
      "android": { "buildType": "apk", "gradleCommand": ":app:assembleDebug" }
    },
    "preview": {
      "distribution": "internal",
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": "version",
      "ios": { "buildConfiguration": "Release" },
      "android": { "buildType": "app-bundle" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "votre-apple-id@oxvehicle.fr",
        "ascAppId": "1234567890",
        "appleTeamId": "ABC12DEF34"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "production"
      }
    }
  }
}
```

### 5.2. Profils de build

- **`development`** : pour le dev en local avec hot reload
- **`preview`** : pour les bêta-testeurs (Heritage / pilotes pilotes)
- **`production`** : pour les stores

### 5.3. Build cloud EAS

Avantages d'EAS Build :
- Pas de Mac requis pour builder iOS
- Cache automatique des dépendances
- Builds parallélisés iOS + Android
- Stockage des `.aab` et `.ipa` 30 jours

Temps de build typique :
- iOS : 15-25 min
- Android : 10-15 min

### 5.4. OTA Updates (Expo Updates)

Pour les corrections JavaScript urgentes sans repassage au store :

```typescript
// Vérifier les updates au démarrage
import * as Updates from 'expo-updates';

useEffect(() => {
  async function checkForUpdates() {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (isAvailable) {
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Mise à jour disponible',
        'Redémarrer l\'app pour appliquer ?',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Redémarrer', onPress: () => Updates.reloadAsync() }
        ]
      );
    }
  }
  checkForUpdates();
}, []);
```

**Limitation** : OTA ne fonctionne que pour le code JS/TS. Les changements natifs (BLE config, permissions) nécessitent un nouveau build et passage en store.

---

## 6. TestFlight et Google Play

### 6.1. Inscription développeur

- **Apple Developer Program** : 99 USD/an, individu ou entreprise
- **Google Play Console** : 25 USD à vie (une fois)

Pour OXV, je recommande **Apple Developer Enterprise** non — c'est pour la distribution interne d'entreprises. Restez sur Apple Developer Program standard.

### 6.2. TestFlight (iOS bêta)

Workflow :

1. EAS build production
2. EAS submit → upload sur App Store Connect
3. Sur App Store Connect : "TestFlight" → ajouter testeurs
4. Testeurs reçoivent invitation par email
5. Installent TestFlight app + l'app OXV Mirror

**Avantages** : 90 jours de test illimité, jusqu'à 10000 testeurs externes (avec review Apple beta), tests crash automatiques.

**Workflow OXV recommandé** :
- **Bêta interne** : 5-10 pilotes Heritage (les plus engagés)
- **Bêta publique restreinte** : 30-50 pilotes Signature + Promotion
- **Lancement public** : tous pilotes OXV

### 6.3. Google Play (Android bêta)

Workflow équivalent :

1. EAS build production (`.aab`)
2. EAS submit → Google Play Console
3. Sur Play Console : "Tests internes" puis "Tests fermés" puis "Production"
4. Liste de testeurs via emails Google

Différence majeure avec TestFlight : Google Play accepte les `.aab` directement, pas de review pour les tests internes (juste pour la production).

### 6.4. Review Apple — points d'attention

L'app sera soumise à review par Apple. Points qui peuvent bloquer :

- **Permissions justifiées** : chaque permission doit avoir une explication claire dans l'`Info.plist`
- **Politique de confidentialité** : obligatoire, hébergée sur `oxvehicle.fr/privacy`
- **Compte de test** : Apple veut un compte de test avec une session pré-enregistrée pour tester l'app sans avoir le RaceBox
- **Pas d'utilisation de l'API privée** : EAS Build gère ça automatiquement

Délai de review Apple : 24-48h en moyenne en 2026.

### 6.5. Review Google — points d'attention

Google est plus souple sur l'iOS pour la première publication, mais :

- **Manifest des permissions explicites** : `ACCESS_BACKGROUND_LOCATION` exige une justification écrite à Google
- **Target SDK 34+** obligatoire (Android 14)
- **Politique données** : déclaration détaillée des données collectées

Délai de review Google : 1-7 jours selon complexité.

---

## 7. CI/CD GitHub Actions

### 7.1. Workflow recommandé

```yaml
# .github/workflows/build.yml
name: Build and Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test
      - run: npm run lint
      - run: npm run typecheck

  build-preview:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --profile preview --platform all --non-interactive

  build-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: npm ci
      - run: eas build --profile production --platform all --non-interactive --auto-submit
```

### 7.2. Tests automatisés

- **Unit tests** : Jest pour les fonctions de calcul (marges, secteurs)
- **Integration tests** : Detox pour les flows critiques
- **E2E tests** : Maestro (plus simple que Detox pour les apps RN)

Couverture cible : 60% sur la business logic, 0% sur l'UI (pas pertinent).

---

## 8. RGPD et données télémétriques

### 8.1. Statut juridique de la télémétrie

**Question** : la donnée de pilotage est-elle une donnée personnelle au sens RGPD ?

**Réponse** : oui, dès qu'elle est liée à un pilote identifiable (ce qui est le cas dans OXV puisque liée à `user_id`). Les positions GPS sont des données personnelles localisables ; les performances individuelles peuvent révéler des traits comportementaux.

### 8.2. Implications

L'app doit :

- **Mention CGV/CGU explicite** sur la collecte télémétrique
- **Consentement éclairé** à l'onboarding (pas un opt-in caché dans les CGV)
- **Droit d'accès** : permettre le téléchargement des données dans un format lisible (JSON export)
- **Droit à l'effacement** : suppression complète sous 30 jours sur demande
- **Droit à la portabilité** : export des données dans un format standard
- **Sécurité** : chiffrement at-rest (Supabase le fait), chiffrement in-transit (HTTPS partout)

### 8.3. Politique de confidentialité

Document obligatoire à publier sur `oxvehicle.fr/privacy`. Doit couvrir :

- Quelles données sont collectées (liste exhaustive)
- Pourquoi (finalités)
- Combien de temps (durée de conservation)
- Avec qui (partenaires : Supabase, RaceBox, etc.)
- Comment l'utilisateur peut exercer ses droits
- Coordonnées du DPO ou responsable RGPD

### 8.4. Partage social

Le partage de progression (votre choix de cette session) est un sujet RGPD subtil :

- Le pilote partage **ses propres** données (pas celles d'autrui)
- Le partage doit être **opt-in explicite** à chaque génération
- Le lien partagé peut être **révoqué à tout moment**
- Durée de vie maximale : **30 jours** par défaut
- **Pas d'indexation moteurs** : `robots.txt` exclut les URLs de partage

### 8.5. Stockage Supabase et RGPD

Bonne nouvelle : Supabase est hébergé en **Europe (Frankfurt)** dans votre cas. Pas de transfert hors UE. Conformité naturelle.

### 8.6. Suppression de compte

Quand un pilote supprime son compte OXV :

1. **Délai de grâce 30 jours** (déjà en place sur votre plateforme)
2. **Anonymisation** : `user_id` remplacé par un UUID anonyme dans toutes les tables
3. **Fichiers UBX** : supprimés du bucket `telemetry_raw`
4. **Liens de partage** : révoqués
5. **Backups Supabase** : conservés 7 jours par défaut, purgés ensuite

---

## 9. Coûts récurrents annuels

### 9.1. Services techniques

| Service | Plan | Coût annuel | Justification |
|---|---|---|---|
| Supabase Pro | Pro | 300 € | Backend complet (DB, Storage, Auth, Functions) |
| Apple Developer | Standard | 99 USD ≈ 92 € | Publication App Store |
| Google Play | One-time 25 USD | Amorti | À payer une seule fois |
| Expo EAS Build | Production | 0 à 999 € | Plan Free suffisant si <30 builds/mois |
| Expo EAS Update | Production | Inclus dans EAS | OTA updates |
| Domaine `oxvehicle.fr` | Déjà payé | 0 € | Pas de surcoût |
| Monitoring (Sentry) | Team plan | 312 € | 26€/mois, crash reporting + perf |
| Analytics (PostHog ou Mixpanel) | Growth | 0 à 240 € | Plan free souvent suffisant |
| Hébergement docs privacy | Vercel | 0 € | Sur le site existant |

**Total services techniques : ~700-1200 €/an**

### 9.2. Coûts ponctuels (one-time)

| Item | Coût | Note |
|---|---|---|
| Apple Developer (1ère année) | 92 € | Renouvelable |
| Google Play Console | 23 € | À vie |
| Boutons Flic 2 (10 unités) | 400-450 € | Distribués aux Heritage |
| Calibration circuit (session) | 0-1500 € | Selon présence Julien Beltoise |
| Audit RGPD (avocat) | 800-1500 € | Optionnel mais recommandé |
| Audit télémétrie (consultant) | 4000-8000 € | Recommandé Partie 2 |

**Total one-time : ~5500-11500 €**

### 9.3. Coûts de développement (one-time)

Voir section 10 ci-dessous.

### 9.4. Coûts variables avec l'usage

| Item | Coût | Calcul |
|---|---|---|
| Supabase Storage UBX | Inclus Pro | 5 Go/an, plan Pro = 100 Go |
| Supabase Database | Inclus Pro | <1 Go pour les métadonnées |
| Supabase Realtime | Inclus Pro | Pas utilisé sauf si live HUD |
| Bandwidth | Inclus Pro | 250 Go/mois inclus |

Conclusion : **les coûts opérationnels restent stables même avec 200-500 sessions/an**.

---

## 10. Estimation d'effort détaillée

### 10.1. Modules de développement (heures)

| Module | Min | Max | Note |
|---|---|---|---|
| **Setup projet** | 15 | 25 | Expo init, structure, Supabase config |
| **Auth + onboarding** | 25 | 35 | Login, signup, palier déclaré, permissions |
| **BLE connection (RaceBox)** | 35 | 50 | Connexion, reconnexion, état machine |
| **BLE bouton marquage** | 15 | 25 | Jumelage Flic, écoute événements |
| **Parser UBX (Rust → WASM)** | 40 | 60 | Plus complexe si nouveau au Rust |
| **Stockage local + Sync (WatermelonDB)** | 30 | 45 | Schema, sync engine, conflict resolution |
| **Algorithmes de marge (V1 simple)** | 25 | 35 | Vehicle margin + pilot margin basique |
| **Détection virages + secteurs** | 20 | 30 | Algorithme basé sur yaw rate |
| **Filtre de Kalman** | 25 | 40 | Implémentation EKF, calibration |
| **Comparateur Ghost** | 25 | 35 | Alignement spatial, superposition |
| **Détection anomalies (méthode 3)** | 20 | 30 | 6 détecteurs, scoring, sélection |
| **Recommandation algorithme** | 15 | 25 | Scoring multicritère |
| **UI Écran 1 (Bilan)** | 20 | 30 | Vue d'entrée post-session |
| **UI Écran 2 (Carte circuit)** | 25 | 40 | SVG dynamique, interactions |
| **UI Écran 3 (Zoom virage)** | 30 | 45 | Le plus complexe, charts |
| **UI Écran 4 (Prochaine fois)** | 15 | 25 | Présentation recommandation |
| **UI Écran 5 (Progression)** | 25 | 35 | Historique, courbes multi-sessions |
| **Onboarding flow** | 15 | 25 | 4-5 écrans de bienvenue |
| **Settings et préférences** | 10 | 15 | Permissions, RGPD, paramètres |
| **Partage de progression (social)** | 20 | 35 | Génération images, liens partagés |
| **Tests unitaires** | 30 | 50 | Couverture business logic |
| **Tests E2E** | 20 | 30 | Flows critiques (Maestro) |
| **CI/CD setup** | 10 | 15 | GitHub Actions, EAS Build |
| **Onboarding stores (review)** | 10 | 20 | Apple + Google submissions |
| **Documentation utilisateur** | 15 | 25 | Aide intégrée, FAQ |
| **Calibration circuit Beltoise** | 20 | 30 | Session relevé + analyse |
| **Polish / debugging** | 30 | 50 | Inévitable |

### 10.2. Total

| Catégorie | Min | Max |
|---|---|---|
| **Hardware connectivity** | 50 | 75 |
| **Data layer** | 70 | 105 |
| **Algorithmes** | 130 | 195 |
| **UI / UX** | 130 | 195 |
| **Infrastructure** | 50 | 75 |
| **Polish** | 60 | 100 |
| **TOTAL** | **490 h** | **745 h** |

À ~80€/h tarif freelance senior, soit **40 000 € à 60 000 €** de dev pure.

### 10.3. Profil de développeur recommandé

**Idéalement, 2 profils complémentaires** :

- **Profil A** : React Native senior + BLE + iOS/Android natif
  - 5+ ans d'expérience React Native
  - Avoir déjà fait du BLE (idéalement avec un device industriel)
  - Bonus : connaissance Expo / EAS

- **Profil B** : Ingénieur algo / data
  - Maîtrise dynamique véhicule (formation auto ou mécanique)
  - Expérience télémétrie ou GPS+IMU
  - Idéalement Rust + WASM

Si vous n'avez que **1 profil**, prenez le Profil A. Le Profil B peut être consulté ponctuellement.

### 10.4. Planning sur 6 mois (1 dev senior à plein temps)

```
Mois 1 — Setup + BLE + Parser UBX
   ├── Semaines 1-2: Setup projet, Supabase, Auth
   └── Semaines 3-4: BLE RaceBox, parser UBX prototype

Mois 2 — Data layer + Algorithmes V1
   ├── Semaines 5-6: WatermelonDB, sync, schema
   └── Semaines 7-8: Marges, secteurs, anomalies

Mois 3 — UI principale + Kalman
   ├── Semaines 9-10: Écrans 1, 2, 3
   └── Semaines 11-12: Filtre Kalman, calibration

Mois 4 — UI secondaire + Social + Bouton BLE
   ├── Semaines 13-14: Écrans 4, 5, onboarding
   └── Semaines 15-16: Bouton BLE, partage social

Mois 5 — Calibration + Tests + Bêta
   ├── Semaines 17-18: Calibration Beltoise, ajustements
   └── Semaines 19-20: Tests E2E, bêta interne

Mois 6 — Submission + Lancement
   ├── Semaines 21-22: TestFlight, Google Play tests
   └── Semaines 23-24: Reviews stores, lancement public
```

---

## 11. Plan de lancement recommandé

### 11.1. Phase 0 — Pré-lancement (avant développement)

- ☐ Brief le développeur avec les 3 documents d'architecture
- ☐ Valider les hypothèses techniques (BLE RaceBox, lib React Native)
- ☐ Audit RGPD avec avocat
- ☐ Audit algorithmes avec consultant télémétrie (PI Research, Estaca)
- ☐ Acheter 1 RaceBox Mini pour le dev
- ☐ Acheter 3 boutons Flic 2 pour les tests

### 11.2. Phase 1 — Développement (6 mois)

Voir planning section 10.4.

Jalons clés :
- **Mois 2** : prototype BLE fonctionnel sur dev device
- **Mois 3** : première session complète enregistrée et analysée
- **Mois 4** : UI complète sur device de dev
- **Mois 5** : 3 bêta-testeurs internes
- **Mois 6** : 20 bêta-testeurs externes

### 11.3. Phase 2 — Bêta fermée (1 mois)

- Inviter les 10 pilotes Heritage à essayer
- Récolter feedback structuré (formulaire post-session)
- Ajuster algorithmes selon données réelles
- Corriger bugs critiques

### 11.4. Phase 3 — Lancement public (mois 8)

- Soumission App Store + Google Play
- Annonce email à tous les pilotes OXV
- Page dédiée sur `oxvehicle.fr/coach`
- Inclusion dans le pack Heritage automatiquement

### 11.5. Phase 4 — Évolutions continues (mois 9+)

- Calibration progressive des seuils selon données accumulées
- Ajustements UX selon retours pilotes
- Ouverture potentielle à des partenaires (clubs locaux, écoles de pilotage)
- Préparation V2 (live HUD optionnel, partage communautaire, etc.)

---

## Synthèse globale des 3 parties

Vous disposez maintenant d'un dossier d'architecture complet de **3 documents totalisant 50+ pages** :

| Partie | Contenu | Pour qui |
|---|---|---|
| **Partie 1** | Stack, couches, Supabase, parsing UBX | Tech lead / Dev senior |
| **Partie 2 augmentée** | Algorithmes pédagogiques + modèles competition | Consultant télémétrie + Dev algo |
| **Partie 3** | Connectivité, déploiement, RGPD, coûts | Vous (décisionnel) + Dev mobile |

**Coût total à investir** :
- Développement : **40 000 à 60 000 €** (one-time)
- Hardware + audit : **5 500 à 11 500 €** (one-time)
- Services récurrents : **700 à 1 200 €/an**
- Total année 1 : **~50 000 à 75 000 €**
- Total années suivantes : **~1 000 à 1 500 €/an**

**Temps de mise sur le marché** : 8 mois depuis le début du dev.

Si vous voulez attaquer plus modeste, on peut revenir sur le périmètre A (MVP minimaliste à 60-80h pour la partie app, plus 80-120h pour les algorithmes essentiels) — environ **150-200 heures soit 12 000 à 18 000 €** pour valider l'idée avant de scaler.

---

*Document à conserver dans votre repo sous `/docs/app/ARCHITECTURE_PARTIE_3.md`.*
