# Schéma Supabase actuel — OXV Production

> **Source** : Export direct depuis le projet Supabase `fouvuqkdxarjpjbqnsjq` (Frankfurt).
> **Date d'export** : 24 mai 2026
> **Méthode** : MCP Supabase Tools (Claude chat) — accès direct au projet.

---

## Vue d'ensemble

**20 tables** dans le schéma `public`, toutes avec RLS activée.

| Table | Lignes | Rôle |
|---|---|---|
| `users` | 13 | Profils pilotes et admins |
| `vehicles` | 4 | Véhicules des pilotes |
| `documents` | 5 | KYC (permis, identité, assurances) |
| `sessions` | 44 | Sessions de roulage planifiées |
| `heritage_packs` | 0 | Packs saison Heritage (3500€) |
| `registrations` | 5 | Inscriptions pilotes aux sessions |
| `payments` | 2 | Transactions Stripe |
| `media` | 0 | Photos/vidéos post-session |
| `email_log` | 0 | Historique emails Resend |
| `pricing` | 5 | Tarification dynamique par offre/saison |
| `telemetry_sessions` | 10 | **App OXV Coach** — sessions enregistrées |
| `telemetry_frames` | 0 | **App OXV Coach** — trames GPS/inertielles |
| `circuits` | 3 | Circuits configurés (Beltoise + autres) |
| `laps` | 1 | Tours individuels d'une session |
| `weather_snapshots` | 14 | Capture météo avant/pendant/après |
| `qdi_scores` | 0 | Quality Driving Index calculé |
| `admin_audit` | 15 | Audit des actions admin |
| `contact_messages` | 1 | Formulaire de contact public |
| `ritual_dispatches` | 0 | Rituels J-7, J-2, J-1 |
| `resend_events` | 0 | Webhooks Resend (deliveries) |

**Important** : les tables `telemetry_sessions`, `telemetry_frames`, `circuits`, `laps`, `weather_snapshots`, `qdi_scores`, `ritual_dispatches`, `resend_events` **existent déjà**. L'app OXV Coach a déjà une infrastructure backend partielle.

---

## Tables critiques pour l'app OXV Coach

### Table `users`

C'est la table maîtresse, avec **47 colonnes** dont des spécificités importantes :

```sql
-- Colonnes principales
id                              uuid PRIMARY KEY
email                           text UNIQUE
first_name                      text
last_name                       text
birth_date                      date
phone                           text
address_line                    text
address_zip                     text
address_city                    text
address_country                 text DEFAULT 'FR'
emergency_contact_name          text
emergency_contact_phone         text
emergency_contact_relation      text CHECK (conjoint, parent, enfant, ami, autre)

-- Stripe
stripe_customer_id              text UNIQUE

-- KYC
kyc_status                      kyc_status_enum (pending, validated, rejected, expired)
kyc_validated_at                timestamptz
kyc_validated_by                uuid REFERENCES users(id)

-- Rôles et permissions
role                            user_role (pilot, admin)
is_admin                        boolean DEFAULT false
email_verified                  boolean DEFAULT false
two_factor_enabled              boolean DEFAULT false

-- Profil pilote (pour l'app)
pilot_level                     text CHECK (debutant, intermediaire, confirme, expert)
ffsa_license                    text
experience_years                text CHECK ('<1', '1-2', '3-5', '5-10', '10+')
blood_type                      text CHECK (A+, A-, B+, B-, AB+, AB-, O+, O-, unknown)
medical_notes                   text
profile_completed_at            timestamptz

-- Personnalisation
avatar_url                      text
public_handle                   text UNIQUE  -- pour le partage social
preferred_language              text DEFAULT 'fr'

-- Notifications (préférences détaillées)
notif_newsletter                boolean DEFAULT false
notif_offers                    boolean DEFAULT false
notification_preferences        jsonb DEFAULT '{}'

-- Rituels (déjà toggle par l'utilisateur !)
ritual_jminus7_enabled          boolean DEFAULT true
ritual_jminus2_enabled          boolean DEFAULT true
ritual_jminus1_enabled          boolean DEFAULT true

-- Suspension / Suppression
suspended_at                    timestamptz
suspended_by                    uuid REFERENCES users(id)
suspension_reason               text
deletion_requested_at           timestamptz
deletion_scheduled_at           timestamptz

-- Tracking
admin_notes                     text
last_login_at                   timestamptz
accepts_marketing               boolean DEFAULT false
created_at                      timestamptz DEFAULT now()
updated_at                      timestamptz DEFAULT now()
```

**Pour l'app OXV Coach** :
- L'app lit `pilot_level` au démarrage pour calibrer les analyses
- L'app peut écrire `profile_completed_at` à la fin de l'onboarding
- Les toggles `ritual_jminus7_enabled` etc. permettent au pilote de désactiver les rituels depuis l'app
- `public_handle` est utilisé pour la fonction "Partage social"

---

### Table `telemetry_sessions` (DÉJÀ EXISTANTE)

C'est ici que l'app OXV Coach va écrire ses sessions :

```sql
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                         uuid REFERENCES users(id)
name                            text
circuit_name                    text DEFAULT 'Haute Saintonge'
circuit_id                      uuid REFERENCES circuits(id)
vehicle_id                      uuid REFERENCES vehicles(id)
vehicle_label                   text
weather                         text
notes                           text
custom_name                     text

-- Timing
started_at                      timestamptz DEFAULT now()
ended_at                        timestamptz
duration_seconds                int4 GENERATED  -- auto-calculé

-- Stats agrégées
total_frames                    int4 DEFAULT 0
max_speed_kmh                   numeric
max_g_lateral                   numeric
max_g_longitudinal              numeric
distance_km                     numeric
lap_count                       int4 DEFAULT 0
best_lap_seconds                numeric
best_lap_number                 int4
avg_lap_seconds                 numeric

-- État
status                          text CHECK (recording, completed, aborted, processing)

-- Données brutes
raw_data_url                    text  -- URL vers Supabase Storage (.ubx)

created_at                      timestamptz DEFAULT now()
updated_at                      timestamptz DEFAULT now()
```

**Important** : cette table existe déjà avec **10 lignes**. L'app doit s'y greffer, pas la recréer.

---

### Table `telemetry_frames` (DÉJÀ EXISTANTE)

Stockage des positions à 25 Hz (vide actuellement, sera remplie par l'app) :

```sql
id                              bigint PRIMARY KEY
session_id                      uuid REFERENCES telemetry_sessions(id)
elapsed_ms                      int4  -- temps écoulé depuis le début de la session

-- GPS
latitude                        numeric
longitude                       numeric
altitude_m                      numeric
gps_accuracy_m                  numeric
gps_fix                         int4
satellites                      int4

-- Mouvement
speed_kmh                       numeric
heading                         numeric  -- 0-360°
g_force_x                       numeric
g_force_y                       numeric
g_force_z                       numeric

-- Équipement
battery_level                   int4  -- batterie du RaceBox

created_at                      timestamptz DEFAULT now()
```

**Volume attendu** : ~135 000 frames par session de 1h30 (25 Hz). Considérer un partitionnement par session_id si performance dégrade.

---

### Table `circuits` (DÉJÀ EXISTANTE)

3 circuits déjà configurés :

```sql
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                         uuid REFERENCES users(id)  -- circuit perso ou null si officiel
name                            text
is_default                      boolean DEFAULT false
is_official                     boolean DEFAULT false
official_name                   text

-- Géographie
city                            text
region                          text
length_km                       numeric
turns_count                     int4

-- Ligne d'arrivée pour le découpage en tours
finish_line_lat                 numeric
finish_line_lon                 numeric
finish_line_radius_m            numeric DEFAULT 30
finish_line_heading             numeric

-- Tracé visuel
description                     text
track_svg_path                  text  -- SVG du tracé
bbox_min_lat                    numeric
bbox_max_lat                    numeric
bbox_min_lon                    numeric
bbox_max_lon                    numeric

-- Stats
total_sessions                  int4 DEFAULT 0
best_lap_seconds                numeric

created_at                      timestamptz DEFAULT now()
updated_at                      timestamptz DEFAULT now()
```

**Important** : la colonne `track_svg_path` contient le SVG du tracé. L'app peut donc afficher dynamiquement le tracé Beltoise sans hardcoder un fichier.

---

### Table `laps` (DÉJÀ EXISTANTE)

Découpage automatique en tours :

```sql
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
session_id                      uuid REFERENCES telemetry_sessions(id)
lap_number                      int4
is_best_lap                     boolean DEFAULT false
is_outlap                       boolean DEFAULT false  -- tour de sortie stand
is_inlap                        boolean DEFAULT false  -- tour de retour stand

started_at                      timestamptz
ended_at                        timestamptz
duration_seconds                numeric

-- Stats par tour
max_speed_kmh                   numeric
avg_speed_kmh                   numeric
max_g_lateral                   numeric
max_g_braking                   numeric
max_g_accel                     numeric
distance_meters                 numeric

-- Coordonnées de début/fin
start_lat                       numeric
start_lon                       numeric
end_lat                         numeric
end_lon                         numeric

created_at                      timestamptz DEFAULT now()
```

---

### Table `qdi_scores` (DÉJÀ EXISTANTE) — Bonus inattendu

**Vous avez déjà conçu un système de scores !** Le QDI (Quality Driving Index) :

```sql
id                              uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id                         uuid REFERENCES users(id)
session_id                      uuid REFERENCES sessions(id)  -- session OXV (pas telemetry_sessions)
registration_id                 uuid REFERENCES registrations(id)

-- 5 dimensions de score (0-100)
trajectory_score                int4 CHECK (0-100)
fluidity_score                  int4 CHECK (0-100)
braking_score                   int4 CHECK (0-100)
acceleration_score              int4 CHECK (0-100)
regularity_score                int4 CHECK (0-100)

-- Score global pondéré (généré automatiquement)
qdi_global                      int4 GENERATED
-- Formule : 30% trajectoire + 25% fluidité + 20% freinage + 15% accélération + 10% régularité

-- Niveau (généré automatiquement)
qdi_level                       text GENERATED
-- elite (≥95), or (≥85), argent (≥70), bronze (≥50), novice (<50)

best_lap_time_ms                int4
valid_laps                      int4 DEFAULT 0
total_laps                      int4 DEFAULT 0
notes                           text
computed_at                     timestamptz DEFAULT now()
```

**Attention doctrine OXV** : ce système de scores avec niveaux (elite/or/argent/bronze/novice) entre potentiellement en **tension avec votre doctrine** "miroir pas coach". À discuter en début de semaine 1 avec Claude Code.

Trois pistes :
- A) Conserver le QDI mais ne pas l'afficher au pilote (usage interne admin)
- B) L'afficher mais sans gamification (juste un chiffre comme la marge composite)
- C) Le supprimer et le remplacer par la marge composite que vous avez définie

---

### Table `weather_snapshots` (DÉJÀ EXISTANTE)

Capture automatique de la météo (déjà 14 lignes) :

```sql
id                              uuid PRIMARY KEY
session_id                      uuid REFERENCES telemetry_sessions(id)
captured_at                     timestamptz DEFAULT now()
moment                          text CHECK (before, during, after)

latitude                        numeric
longitude                       numeric

temperature_c                   numeric
feels_like_c                    numeric
humidity_pct                    int4
pressure_hpa                    int4
visibility_km                   numeric

wind_speed_kmh                  numeric
wind_direction_deg              int4
wind_gust_kmh                   numeric

precipitation_mm                numeric
precipitation_probability_pct   int4

weather_code                    int4  -- code météo standard
weather_label                   text

raw_data                        jsonb  -- réponse API complète
```

**Pour l'app** : utiliser ces données pour contextualiser le bilan ("Vous avez piloté sous 22°C, vent 12 km/h").

---

### Table `ritual_dispatches` (DÉJÀ EXISTANTE)

Gestion des rituels J-7, J-2, J-1 :

```sql
id                              uuid PRIMARY KEY
registration_id                 uuid REFERENCES registrations(id)
user_id                         uuid REFERENCES users(id)
session_id                      uuid REFERENCES sessions(id)
ritual_type                     ritual_type_enum (jminus7, jminus2, jminus1)
status                          ritual_status_enum (pending, generating, sent, failed, skipped)

scheduled_for                   timestamptz
sent_at                         timestamptz
delivered_at                    timestamptz
opened_at                       timestamptz
opened_count                    int4 DEFAULT 0
clicked_at                      timestamptz
clicked_count                   int4 DEFAULT 0
bounced_at                      timestamptz
bounce_reason                   text
complained_at                   timestamptz

payload                         jsonb  -- contenu généré (texte, audio URL)
audio_storage_path              text   -- pour J-2
audio_duration_sec              int4

-- Usage des APIs externes
openai_tokens_used              int4
elevenlabs_chars                int4

-- Suivi technique
attempt_count                   int4 DEFAULT 0
last_error                      text
last_attempt_at                 timestamptz
resend_message_id               text
```

**Statut** : 0 lignes actuellement. L'infrastructure est en place mais pas encore déclenchée.

---

## Fonctions PostgreSQL existantes (12)

```sql
-- Sécurité
is_admin()  RETURNS boolean  -- SECURITY DEFINER (utilisée partout dans les RLS)
handle_new_user()  RETURNS trigger  -- Crée le profil users à l'inscription

-- Rituels
schedule_rituals_for_registration(p_registration_id uuid)  -- Plannifie les 3 rituels
cancel_pending_rituals_for_registration(p_registration_id uuid)  -- Annule si désinscription
trigger_schedule_rituals()  RETURNS trigger  -- Trigger sur registrations
admin_ritual_stats(p_days_back integer DEFAULT 30)  -- Stats admin

-- Resend webhooks
apply_resend_event(p_dispatch_id uuid, p_event_type text, ...)

-- Utilitaires
generate_oxv_reference()  RETURNS text  -- Génère "OXV-XXXXXXXX"
auto_generate_payment_reference()  RETURNS trigger
update_updated_at_column()  RETURNS trigger
ritual_dispatches_set_updated_at()  RETURNS trigger
update_session_best_lap()  RETURNS trigger
```

---

## RLS Policies par table

Pattern principal : **"propriétaire ou admin"** via `auth.uid() = user_id OR is_admin()`.

Voir `06_RLS_POLICIES_ACTUELLES.sql` (généré automatiquement par Claude depuis l'export Supabase) pour la liste complète des 80+ policies.

**Patterns observés** :
- `users` : un utilisateur lit/édite uniquement son propre profil, l'admin lit/édite tout
- `vehicles`, `documents` : propriétaire ou admin
- `sessions` : lecture publique (calendrier), écriture admin only
- `registrations` : propriétaire pour lecture/insertion, admin pour modification
- `pricing` : lecture publique (active=true), écriture admin
- `telemetry_*` : strictement propriétaire (pas de visibilité admin par défaut)
- `qdi_scores` : propriétaire en lecture, admin en écriture

**Note importante** : la policy `is_admin()` est une fonction SECURITY DEFINER, ce qui évite la récursion infinie sur la table users.

---

## Implications pour l'app OXV Coach

### Bonnes nouvelles

1. **Infrastructure télémétrie déjà prête** — pas besoin de créer telemetry_sessions, telemetry_frames, laps, weather_snapshots
2. **Système de rituels déjà câblé** — il suffit de le connecter à Resend + OpenAI + ElevenLabs
3. **Multi-circuits supporté** dès le départ (Beltoise + autres) avec SVG stocké
4. **Préférences utilisateur granulaires** déjà dans users (notif, rituels)

### Points d'attention

1. **Conflit potentiel doctrine vs QDI** : à arbitrer en semaine 1
2. **Pas de migrations enregistrées** : Supabase ne montre aucune migration, vous avez probablement appliqué les SQL directement via l'éditeur (les scripts sont dans votre dossier `migration_*.sql` local)
3. **Stockage des fichiers UBX** : la colonne `raw_data_url` existe, il faut configurer un bucket Supabase Storage dédié

### Tables à AJOUTER pour l'app V1

Seules **2 tables manquent** (par rapport à ce que prévoyait notre architecture) :

```sql
-- 1. Référence de circuit enrichie (zones, virages nommés)
CREATE TABLE app_circuit_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_id uuid REFERENCES circuits(id),
  zone_number int4 NOT NULL,
  zone_name text,  -- "Le S des chênes"
  zone_type text CHECK (zone_type IN ('straight', 'corner', 'chicane', 'braking', 'apex')),
  start_lat numeric,
  start_lon numeric,
  end_lat numeric,
  end_lon numeric,
  ideal_speed_kmh numeric,
  created_at timestamptz DEFAULT now()
);

-- 2. Analyses par session (résultats du calcul de marge)
CREATE TABLE app_session_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telemetry_session_id uuid REFERENCES telemetry_sessions(id),
  
  -- Marge composite (le chiffre central du bilan)
  margin_global numeric CHECK (margin_global >= 0 AND margin_global <= 100),
  margin_zone text CHECK (margin_zone IN ('green', 'yellow', 'red')),
  
  -- Marges par zone (JSON pour flexibilité)
  margins_by_zone jsonb,  -- { "1": 28, "2": 35, "3": 12, ... }
  
  -- Suggestion "Une chose à creuser"
  next_focus_zone_id uuid REFERENCES app_circuit_zones(id),
  next_focus_phrase text,
  
  -- Texte du debrief J+1 (généré par OpenAI)
  debrief_text text,
  debrief_generated_at timestamptz,
  
  -- Acceptation Pacte
  pact_accepted_at timestamptz,
  pact_version text,
  
  computed_at timestamptz DEFAULT now()
);
```

C'est **tout** ce qui manque. Le reste de l'infrastructure est déjà là.

---

## Pour Claude Code

À la semaine 1, Claude Code doit :

1. **Lire ce fichier** en priorité
2. **Ne PAS recréer** les tables existantes
3. **Ajouter uniquement** les 2 tables `app_circuit_zones` et `app_session_analyses`
4. **Générer les types TypeScript** depuis ce schéma réel
5. **Implémenter** les hooks pour `telemetry_sessions` et `telemetry_frames` existants
6. **Tester** que les RLS existantes ne bloquent pas les requêtes

Commande utile pour générer les types :

```bash
npx supabase gen types typescript \
  --project-id fouvuqkdxarjpjbqnsjq \
  > src/types/database.types.ts
```

---

*Schéma exporté le 24 mai 2026 directement depuis Supabase via MCP tools.*
*Source : projet `fouvuqkdxarjpjbqnsjq` (région eu-central-1 / Frankfurt).*
