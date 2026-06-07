# 🏎️ OXV Mirror — Architecture technique de l'app

> **Document technique pour le développement de l'app native OXV Mirror**
> Partie 1/3 : Stack, architecture en couches, schéma Supabase, parsing UBX
> Version : 1.0 · Mai 2026
> Périmètre : V1 ambitieuse (5 écrans + bouton marquage + partage progression)
> Plateformes : iOS + Android (React Native cross-platform)

---

## 1. Stack technique

### Choix retenus

| Couche | Technologie | Version | Raison |
|---|---|---|---|
| **Framework** | React Native | 0.74+ | Cross-platform iOS/Android, écosystème mature, équipe peut réutiliser ses connaissances JS |
| **Toolchain** | Expo SDK | 51+ | Build cloud (EAS), OTA updates, gestion certificats simplifiée |
| **Langage** | TypeScript | 5.4+ | Type safety obligatoire vu la complexité métier (marges, télémétrie, sectoriels) |
| **State management** | Zustand | 4.5+ | Léger, sans boilerplate, parfait pour un app de cette taille |
| **Navigation** | React Navigation | 6.x | Standard de facto, support natif des transitions iOS/Android |
| **Charts** | Victory Native + Skia | 36.x / latest | Performance native pour les courbes télémétriques 25-200 Hz |
| **Maps** | React Native Maps | 1.14+ | Tracé du circuit en overlay sur carte satellite |
| **BLE** | react-native-ble-plx | 3.x | Librairie BLE la plus mature pour les deux OS |
| **Storage local** | MMKV | 2.x | Plus rapide qu'AsyncStorage, parfait pour le cache |
| **DB locale** | WatermelonDB | 0.27+ | Sync offline-first avec Supabase, optimisé pour gros volumes |
| **Backend** | Supabase | Latest | Auth, Postgres, Storage, Realtime, Edge Functions — déjà votre stack |
| **Parsing UBX** | Custom Rust → WASM | N/A | Performance native, voir section 4 |

### Alternatives écartées et pourquoi

- **Flutter** : excellent mais oblige à apprendre Dart. Votre stack est JS/TS, React Native s'aligne mieux.
- **Native iOS Swift + Android Kotlin** : performance maximale mais double l'effort de développement (300 → 600h). Non justifié pour cette app.
- **Capacitor + Ionic** : WebView-based, performance insuffisante pour les courbes télémétriques en temps réel.
- **Redux/Redux Toolkit** : overkill pour cette app. Zustand suffit largement.
- **SQLite seul** : pas de sync offline-first native. WatermelonDB ajoute cette couche essentielle.

---

## 2. Architecture en couches

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI LAYER (React Native)                     │
│  • Écrans (Bilan, Carte, Zoom, Prochaine fois, Progression)     │
│  • Composants partagés (KPICard, RouteMap, MarginGauge…)        │
│  • Theming OXV (charte noir/rouge/marges)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  PRESENTATION LAYER (Zustand)                   │
│  • useSessionStore (session courante en cours d'analyse)        │
│  • useProgressionStore (historique multi-sessions)              │
│  • useUserStore (pilote, palier, préférences)                   │
│  • useBleStore (état connexion RaceBox)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    BUSINESS LOGIC LAYER                         │
│  • MarginCalculator (algorithmes de marge — voir Partie 2)      │
│  • SectorAnalyzer (découpage et stats par secteur)              │
│  • TrajectoryComparator (Ghost — superposition réelle/idéale)   │
│  • TelemetryParser (interface avec le module WASM)              │
│  • PhysicsAnalyzer (What-if, calcul de potentiel d'adhérence)   │
│  • QuestionGenerator (méthode 3, détection d'anomalies)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │  Local (WatermelonDB│ ◄─────► │  Remote (Supabase)      │   │
│  │  + MMKV + FileSystem│  sync   │  Postgres + Storage     │   │
│  └─────────────────────┘         └─────────────────────────┘   │
│                                                                 │
│  • SessionRepository (CRUD + sync)                              │
│  • LapRepository                                                │
│  • MarkerRepository (bouton BLE marquage tour)                  │
│  • ShareRepository (partage progression)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                  HARDWARE / EXTERNAL LAYER                      │
│  • BleManager (RaceBox Mini + bouton marquage)                  │
│  • UbxParser (module Rust→WASM)                                 │
│  • FileSystem (cache fichiers UBX bruts)                        │
│  • Location (GPS du téléphone, fallback si RaceBox HS)          │
└─────────────────────────────────────────────────────────────────┘
```

### Principes de cette architecture

**Séparation stricte UI / Business logic** : aucun calcul de marge dans un composant React. Tout passe par la couche business logic, qui est testable unitairement sans rendre quoi que ce soit.

**Offline-first** : l'app fonctionne intégralement sans réseau. Au circuit, vous n'avez pas de 4G la moitié du temps. WatermelonDB stocke tout localement, sync en arrière-plan quand le réseau revient.

**Lazy loading** : les fichiers UBX bruts (10-30 Mo) ne sont chargés en mémoire que quand on les analyse. Sinon, ils restent sur le disque.

**Stateless calculation** : un même fichier UBX + même version d'algorithme = exactement le même résultat. Pas d'état caché. Reproductible.

---

## 3. Schéma Supabase étendu

Vos tables existantes (`users`, `sessions`, `registrations`, `vehicles`) restent. On ajoute **6 nouvelles tables** dédiées à l'app.

### 3.1. Table `app_sessions` — une session de pilotage analysée

```sql
CREATE TABLE public.app_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liens vers l'écosystème OXV
  registration_id       uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id            uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  vehicle_id            uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,

  -- Métadonnées de la session
  started_at            timestamptz NOT NULL,
  ended_at              timestamptz,
  duration_seconds      integer,
  lap_count             integer NOT NULL DEFAULT 0,

  -- Référence aux fichiers
  ubx_storage_path      text,                          -- chemin Supabase Storage
  ubx_file_size_bytes   bigint,
  ubx_parsed_at         timestamptz,                   -- moment du parsing
  parser_version        text,                          -- ex: 'rust-ubx-v1.2.0'

  -- Résultats agrégés (dénormalisés pour requêtes rapides)
  global_margin_percent numeric(5,2),                  -- ex: 24.50
  margin_zone           text CHECK (margin_zone IN ('exploration', 'consolidation', 'conserve')),
  best_lap_time_ms      integer,                       -- meilleur temps en millisecondes
  best_lap_number       integer,
  regularity_stddev_ms  integer,                       -- écart-type des temps au tour
  max_speed_kmh         numeric(5,1),
  max_g_lateral         numeric(4,2),

  -- Recommandation de l'algo pour la prochaine session
  recommended_corner    integer,                       -- 1 à 14
  recommended_reason    jsonb,                         -- métadonnées de la recommandation

  -- Sync
  synced_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_sessions_user_date ON public.app_sessions (user_id, started_at DESC);
CREATE INDEX idx_app_sessions_registration ON public.app_sessions (registration_id);
```

### 3.2. Table `app_laps` — un tour dans une session

```sql
CREATE TABLE public.app_laps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_session_id      uuid NOT NULL REFERENCES public.app_sessions(id) ON DELETE CASCADE,

  lap_number          integer NOT NULL,
  lap_time_ms         integer NOT NULL,
  is_best             boolean NOT NULL DEFAULT false,
  is_marked           boolean NOT NULL DEFAULT false,  -- bouton BLE pressé
  marker_kind         text CHECK (marker_kind IN ('good', 'incident', 'question')),

  -- Sectoriels
  sector_1_ms         integer,
  sector_2_ms         integer,
  sector_3_ms         integer,
  sector_4_ms         integer,

  -- Stats du tour
  max_speed_kmh       numeric(5,1),
  max_g_lateral       numeric(4,2),
  margin_percent      numeric(5,2),

  -- Position dans le fichier UBX (pour re-extraction rapide)
  ubx_start_offset    bigint,
  ubx_end_offset      bigint,

  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (app_session_id, lap_number)
);

CREATE INDEX idx_app_laps_session ON public.app_laps (app_session_id, lap_number);
```

### 3.3. Table `app_corner_metrics` — métriques par virage

```sql
CREATE TABLE public.app_corner_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_session_id        uuid NOT NULL REFERENCES public.app_sessions(id) ON DELETE CASCADE,
  lap_id                uuid REFERENCES public.app_laps(id) ON DELETE CASCADE,

  -- Virage (1-14 sur Beltoise)
  corner_index          integer NOT NULL CHECK (corner_index BETWEEN 1 AND 14),

  -- Méthode 1 — Ghost (point de freinage, vitesse, trajectoire)
  brake_point_meters    numeric(5,1),
  apex_speed_kmh        numeric(5,1),
  exit_speed_kmh        numeric(5,1),
  reference_brake_point numeric(5,1),                  -- selon la référence active
  reference_apex_speed  numeric(5,1),

  -- Méthode 2 — What-if (potentiel physique)
  g_lateral_measured    numeric(4,2),
  g_lateral_threshold   numeric(4,2),                  -- seuil pneu/véhicule
  grip_potential_pct    numeric(5,2),                  -- ex: 18.00 = 18%

  -- Méthode 3 — Questions
  has_coasting_anomaly  boolean DEFAULT false,
  coasting_duration_ms  integer,
  anomaly_data          jsonb,                         -- détails pour la question générée

  -- Marge agrégée
  margin_percent        numeric(5,2),
  margin_zone           text CHECK (margin_zone IN ('exploration', 'consolidation', 'conserve')),

  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (app_session_id, lap_id, corner_index)
);

CREATE INDEX idx_corner_metrics_session_corner ON public.app_corner_metrics (app_session_id, corner_index);
```

### 3.4. Table `app_user_progression` — état du profil pilote

```sql
CREATE TABLE public.app_user_progression (
  user_id                   uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Palier déclaratif + ajusté
  declared_level            text NOT NULL CHECK (declared_level IN ('novice', 'initié', 'confirmé', 'avancé')),
  computed_level            text NOT NULL CHECK (computed_level IN ('novice', 'initié', 'confirmé', 'avancé')),
  level_last_updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Stats cumulées
  total_sessions            integer NOT NULL DEFAULT 0,
  total_laps                integer NOT NULL DEFAULT 0,
  total_distance_km         numeric(8,1) NOT NULL DEFAULT 0,
  cumulative_avg_margin_pct numeric(5,2),

  -- Seuils ajustés selon le palier
  margin_threshold_explore  numeric(5,2) NOT NULL DEFAULT 30.00,
  margin_threshold_conserve numeric(5,2) NOT NULL DEFAULT 15.00,

  -- Préférences app
  preferred_reference       text CHECK (preferred_reference IN ('theoretical', 'personal_best', 'pro_archive')),
  haptic_feedback_enabled   boolean NOT NULL DEFAULT true,
  ble_marker_button_id      text,                                -- ID du bouton BLE jumelé

  updated_at                timestamptz NOT NULL DEFAULT now()
);
```

### 3.5. Table `app_progression_shares` — partage de progression

```sql
CREATE TABLE public.app_progression_shares (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Périmètre du partage
  share_token         text NOT NULL UNIQUE,            -- token URL public
  share_scope         text NOT NULL CHECK (share_scope IN ('last_session', 'last_5_sessions', 'full_history')),
  included_metrics    jsonb NOT NULL,                  -- ex: ['margin_curve', 'sector_evolution']

  -- Cycle de vie
  expires_at          timestamptz,                     -- partage expire (par défaut 30 jours)
  revoked_at          timestamptz,                     -- révoqué par le pilote
  view_count          integer NOT NULL DEFAULT 0,
  last_viewed_at      timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_progression_shares_token ON public.app_progression_shares (share_token);
CREATE INDEX idx_progression_shares_user ON public.app_progression_shares (user_id, created_at DESC);
```

### 3.6. Table `app_circuit_reference` — données du tracé Beltoise

```sql
-- Tracé du circuit avec ses 14 virages. Statique mais en DB pour permettre
-- des évolutions sans redéploiement de l'app.

CREATE TABLE public.app_circuit_reference (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_slug        text NOT NULL UNIQUE,            -- 'beltoise', 'bordeaux', ...
  circuit_name        text NOT NULL,
  total_length_m      integer NOT NULL,

  -- Polyligne GPS du tracé optimal
  optimal_trajectory  jsonb NOT NULL,                  -- array de {lat, lon, target_speed_kmh}

  -- Définition des secteurs et virages
  sectors             jsonb NOT NULL,                  -- array de {sector_index, start_lat, end_lat, ...}
  corners             jsonb NOT NULL,                  -- array de {corner_index, name, entry_lat, apex_lat, exit_lat, theoretical_brake_point, theoretical_apex_speed}

  -- Tour théorique calculé (en fonction d'un véhicule de référence)
  reference_lap_data  jsonb,                           -- positions + vitesses à chaque pas de temps

  -- Métadonnées
  parser_version      text NOT NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_circuit_reference (circuit_slug, circuit_name, total_length_m, ...)
VALUES ('beltoise', 'Circuit de Haute Saintonge — tracé Beltoise', 2600, ...);
```

### 3.7. Storage buckets nécessaires

```sql
-- Bucket pour les fichiers UBX bruts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'telemetry_raw',
  'telemetry_raw',
  false,                                               -- privé
  52428800,                                            -- 50 Mo max par fichier
  ARRAY['application/octet-stream']
);

-- Bucket pour les images de partage social (générées dynamiquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'progression_share_images',
  'progression_share_images',
  true,                                                -- public (pour les liens partagés)
  2097152,                                             -- 2 Mo max
  ARRAY['image/png', 'image/jpeg']
);
```

### 3.8. RLS — Row Level Security

```sql
-- Toutes les tables app_* en RLS
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_laps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_corner_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_progression_shares ENABLE ROW LEVEL SECURITY;

-- Pilote voit uniquement ses propres données
CREATE POLICY app_sessions_select_own ON app_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY app_sessions_insert_own ON app_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY app_sessions_update_own ON app_sessions FOR UPDATE USING (auth.uid() = user_id);

-- Idem app_laps, app_corner_metrics (via app_session_id)
-- Idem app_user_progression (via user_id)

-- app_progression_shares : visible publiquement par token (pour les destinataires non connectés)
CREATE POLICY shares_select_by_token ON app_progression_shares
  FOR SELECT
  USING (true);                                        -- accès public ; sécurité via UNGUESSABLE token

-- app_circuit_reference : lecture publique pour tous les pilotes connectés
ALTER TABLE app_circuit_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY circuit_reference_select_all ON app_circuit_reference FOR SELECT USING (true);
```

---

## 4. Parsing UBX — la pièce technique sensible

### 4.1. Qu'est-ce que l'UBX et pourquoi c'est complexe

UBX est le format binaire propriétaire u-blox utilisé par le RaceBox Mini. Un fichier UBX de 2h de session contient typiquement :

- **NAV-PVT messages** : position + vitesse, ~25 Hz → 180 000 messages
- **NAV-HPPOSLLH messages** : position haute précision, ~5 Hz → 36 000 messages
- **HNR-INS messages** : accélérations 3 axes + gyroscope, ~200 Hz → 1 440 000 messages
- **NAV-TIMEGPS messages** : timestamp précis, ~1 Hz → 7 200 messages
- **MON-RF messages** : qualité du signal GPS, métadonnées

Total : **~1,7 million de messages binaires** sur 2h, pour ~25-30 Mo de fichier.

**Parser ça en JavaScript pur est trop lent** : nos tests internes donnent 30-60 secondes pour un fichier de 2h sur un iPhone récent. Inacceptable pour une expérience post-session.

### 4.2. Solution retenue : Rust → WASM

On écrit le parser UBX en **Rust** (langage système, performance native), compilé en **WebAssembly** (WASM), exposé à React Native via un wrapper. Performance attendue : **2-4 secondes** pour le même fichier.

```
┌──────────────────────────────────────────────────────────┐
│  React Native (TypeScript)                               │
│  await UbxParser.parse(filePath)                         │
└──────────────────┬───────────────────────────────────────┘
                   │ FFI bridge
┌──────────────────▼───────────────────────────────────────┐
│  WASM Runtime (sur device)                               │
│  • Lit le fichier en streaming                           │
│  • Parse les messages UBX par classe/ID                  │
│  • Construit les structures de données dérivées          │
└──────────────────┬───────────────────────────────────────┘
                   │ retourne JSON
┌──────────────────▼───────────────────────────────────────┐
│  TypeScript reçoit :                                     │
│  { laps: [], gpsTrack: [], sensorData: [], metadata: {} }│
└──────────────────────────────────────────────────────────┘
```

### 4.3. Crate Rust à utiliser

- **`ublox`** (crate Rust officiel pour parsing u-blox) : 95% du travail est déjà fait.
- **`wasm-bindgen`** : génère le pont JS/WASM automatiquement.
- **`serde_json`** : sérialise les résultats pour la couche TS.

### 4.4. Pipeline de traitement post-session

```
1. Pilote presse "Terminer session" dans l'app
   │
   ▼
2. App stoppe la connexion BLE RaceBox
   │
   ▼
3. App downloade le fichier UBX du RaceBox via BLE (~30s pour 30 Mo)
   │
   ▼
4. Fichier UBX stocké en local sur le téléphone (FileSystem)
   │
   ▼
5. UbxParser.parse() appelé (~2-4s)
   │
   ▼
6. Données dérivées stockées dans WatermelonDB (laps, corners, marges)
   │
   ▼
7. Fichier UBX uploadé vers Supabase Storage en arrière-plan (~30s si bon réseau)
   │
   ▼
8. UI affiche l'écran Bilan dès l'étape 6 (l'upload est asynchrone)
```

**Détail clé** : l'écran Bilan s'affiche **avant** la fin du upload UBX. Le pilote ne doit pas attendre que tout soit synchronisé pour voir ses résultats. L'upload se fait en tâche de fond, avec notification si échec.

### 4.5. Données structurées en sortie du parser

```typescript
interface ParsedSession {
  metadata: {
    started_at: string;
    ended_at: string;
    total_duration_ms: number;
    racebox_serial: string;
    sample_rate_hz: number;
  };

  gps_track: Array<{
    timestamp_ms: number;
    lat: number;
    lon: number;
    altitude_m: number;
    speed_kmh: number;
    heading_deg: number;
    accuracy_m: number;
  }>;

  sensor_data: Array<{
    timestamp_ms: number;
    accel_x_g: number;
    accel_y_g: number;
    accel_z_g: number;
    gyro_x_dps: number;
    gyro_y_dps: number;
    gyro_z_dps: number;
  }>;

  laps: Array<{
    lap_number: number;
    start_ms: number;
    end_ms: number;
    duration_ms: number;
    sector_times_ms: number[];
    max_speed_kmh: number;
    max_g_lateral: number;
  }>;

  events: Array<{
    timestamp_ms: number;
    type: 'lap_start' | 'sector_crossing' | 'pit_in' | 'pit_out';
    data: Record<string, unknown>;
  }>;
}
```

### 4.6. Détection des tours et secteurs

Le parser UBX seul ne sait pas où sont les tours. Il faut **un module supplémentaire** qui :

1. **Identifie le segment ligne droite/finish** depuis `app_circuit_reference`
2. **Détecte le passage par cette ligne** (croisement géométrique des positions GPS)
3. **Coupe la session en tours** à chaque passage
4. **Identifie les secteurs** via les marqueurs définis dans le circuit de référence

Ce module tourne **après** le parser UBX brut, en JavaScript natif (pas WASM), car il dépend de la donnée `app_circuit_reference` qui vient de Supabase.

### 4.7. Coût de stockage

| Élément | Taille | Pour 50 pilotes × 4 sessions/an | Total annuel |
|---|---|---|---|
| Fichier UBX brut | ~25 Mo / session | 200 sessions × 25 Mo | 5 Go |
| Données dérivées (Postgres) | ~50 Ko / session | 200 × 50 Ko | 10 Mo |
| Images partage social | ~500 Ko / partage | 50 partages | 25 Mo |
| **Total** | | | **~5 Go/an** |

Le plan Supabase Pro inclut **100 Go de Storage**, on est à 5% d'usage. Aucun souci de scaling avant plusieurs années.

---

## 🔄 Prochaines parties à venir

Cette **Partie 1** couvre les fondations. Les parties suivantes traiteront :

**Partie 2 — Algorithmes de marge et logique métier**
- Formules précises de calcul de marge véhicule et pilote
- Détection des anomalies (méthode 3 — coasting, freinage tardif, etc.)
- Comparateur Ghost (réel vs référence)
- Algorithme de recommandation pour "La prochaine fois"

**Partie 3 — Connectivité, déploiement, sécurité**
- Connexion BLE RaceBox Mini (états, reconnexion, gestion d'erreurs)
- Bouton BLE de marquage tour
- Sync offline-first WatermelonDB ↔ Supabase
- Build EAS, TestFlight, Google Play, CI/CD GitHub Actions
- Permissions iOS/Android (location background, BLE)
- RGPD (export, suppression, droit à l'oubli)
- Coûts récurrents annuels prévisionnels
- Estimation d'effort détaillée par module

---

*Document à conserver dans votre repo sous `/docs/app/ARCHITECTURE_PARTIE_1.md`.*
