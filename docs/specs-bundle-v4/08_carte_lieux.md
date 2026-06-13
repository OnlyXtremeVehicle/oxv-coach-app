# 08 — Carte, lieux & création de tracé (conception)

> Fiche de conception, suivant le gabarit du §6 de `05_integration_trace_3d.md`.
> À lire APRÈS `00_CLAUDE.md`, `05_integration_trace_3d.md` (générateur de tracé)
> et `07_social_rgpd.md`.
>
> ⚠️ État réel vérifié en base (`fouvuqkdxarjpjbqnsjq`) :
> - `circuits` : **3 lignes** — dont « Circuit de Haute-Saintonge Jean-Pierre
>   Beltoise », La Genétouze (17), 2,20 km, **7 virages**. C'EST le tracé OSM validé.
> - `circuit_services` : **vide** (schéma riche déjà en place).
> - `social_pings` : **vide**.
> - Tables partenaires / hébergements / restaurants : **N'EXISTENT PAS** → à créer.

---

## 1. PÉRIMÈTRE (décision fondateur)

Carte version 1 = **les deux niveaux** + **création de tracé par l'utilisateur**.
- Niveau 1 — CIRCUITS comme ancres : explorer les circuits (dont Haute Saintonge).
- Niveau 2 — LIEUX & ÉVÉNEMENTS posés autour : hébergements, restaurants,
  partenaires, événements ponctuels.
- **Création de tracé** : l'utilisateur peut définir SON circuit depuis la carte.
  C'est le point innovant — il réutilise l'outil `circuit-generator.mjs` déjà livré
  et validé (7/7 virages sur le tracé OSM de Haute Saintonge).

Décision sur les lieux : **nouvelles tables dédiées** (partenaires, hébergements,
restaurants), pas tout entassé dans `circuit_services`.

---

## 2. ARCHITECTURE — quatre briques, dont deux existent déjà

| Brique | Table | État | Rôle sur la carte |
|--------|-------|------|-------------------|
| Circuits (ancres) | `circuits` | existe, 3 lignes | points d'ancrage + géométrie 3D |
| Services circuit | `circuit_services` | existe, vide | services liés au circuit (paddock, écurie…) |
| Lieux dédiés | `partners` / `lodgings` / `restaurants` | **à créer** | hébergements, restos, partenaires |
| Événements | `social_pings` | existe, vide | événements ponctuels datés (lat/lon) |

> `social_pings` trouve ENFIN sa place ici (renvoyé depuis la fiche social 07) :
> c'est de la donnée de lieu/événement, pas du social entre pilotes.

---

## 3. CRÉATION DE TRACÉ PAR L'UTILISATEUR (le point innovant)

Le générateur `circuit-generator.mjs` (déjà livré, testé) EST le moteur de cette
fonctionnalité. Trois entrées possibles vers la même chaîne :

| Entrée | Comment | Sortie |
|--------|---------|--------|
| **Import OSM** | l'utilisateur saisit/sélectionne un way OpenStreetMap | `fetchOsmWay()` → `generateCircuit()` |
| **Tracé manuel** | l'utilisateur place des points sur la carte | tableau {lat,lon} → `generateCircuit()` |
| **Depuis une session** | à partir du GPS d'une session roulée | frames → `generateCircuit()` |

**Ce que la chaîne produit** (à écrire dans `circuits`) :
- `track_svg_path` ← tracé débruité (centerline projetée en chemin SVG)
- `turns_count` ← nombre de virages détectés (courbure)
- `bbox_min/max_lat/lon` ← cadre du tracé
- `finish_line_lat/lon/radius/heading` ← géofence de détection de tours
- `is_official = false`, `user_id = créateur` (tracé perso, pas officiel)

> Attribution OBLIGATOIRE si source OSM : « © contributeurs OpenStreetMap ».

### ⚠️ Arbitrage à trancher (cf. §6)
`circuits` distingue déjà `is_official` / `is_default` / `user_id`. Un tracé créé par
un utilisateur est-il **privé** (visible de lui seul) ou **partageable / promouvable**
en circuit officiel par OXV ? À décider AVANT de coder la visibilité.

---

## 4. SCHÉMA PROPOSÉ POUR LES TABLES DÉDIÉES (à valider AVANT migration)

> NON APPLIQUÉ. Proposition de DDL, à valider par le fondateur avant `apply_migration`.
> Base commune volontairement homogène (mêmes colonnes de lieu) + champs spécifiques.

```sql
-- Base commune à tous les lieux (rappel pour cohérence) :
--   id, name, description, address, city, region, lat, lon, url,
--   contact_email, contact_phone, circuit_id (FK nullable),
--   is_premium, is_published, created_by, created_at, updated_at

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  partner_type text,            -- concessionnaire, équipementier, média, assureur…
  description text,
  logo_url text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, contact_email text, contact_phone text,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_official_partner boolean default false,  -- partenaire OXV officiel
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.lodgings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lodging_type text,            -- hôtel, villa, location, chambre d'hôtes…
  description text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, booking_url text, contact_email text, contact_phone text,
  price_range text,             -- €, €€, €€€  (pas de prix exact figé)
  distance_to_circuit_km numeric,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cuisine_type text,
  description text,
  address text, city text, region text,
  lat numeric, lon numeric,
  url text, contact_email text, contact_phone text,
  price_range text,             -- €, €€, €€€
  distance_to_circuit_km numeric,
  circuit_id uuid references public.circuits(id) on delete set null,
  is_premium boolean default false,
  is_published boolean default false,
  created_by uuid, created_at timestamptz default now(), updated_at timestamptz default now()
);
```

> Note (challenge honnête) : trois tables quasi identiques = un peu de duplication.
> Acceptable et lisible vu la décision fondateur (tables dédiées). Si la maintenance
> devient lourde, une vue unifiée `places` (UNION ALL) pourra être ajoutée plus tard
> SANS casser les tables. RLS à écrire table par table.

---

## 5. ÉCRANS DE LA CARTE (sous-fiches)

### 5.1 — Carte principale
- Rôle : vue d'ensemble. Circuits en ancres ; lieux & événements en marqueurs typés.
- Données : `circuits`, `partners`, `lodgings`, `restaurants`, `social_pings`
  (filtrés `is_published = true`).
- Tracé : aperçu 2D du tracé sur chaque circuit (depuis `track_svg_path`).
- Filtres : par type de lieu, par proximité d'un circuit.

### 5.2 — Fiche circuit
- Rôle : détail d'un circuit + ses lieux autour + son tracé 3D.
- Données : `circuits` + lieux rattachés (`circuit_id`) + `circuit_services`.
- Tracé : **tracé 3D** via `<CircuitTrace>` (cf. fiche 05). Sur Haute Saintonge, les
  7 virages s'affichent.
- Liaison : depuis une session, « voir le circuit » ouvre cette fiche.

### 5.3 — Créer un tracé (le point innovant)
- Rôle : l'utilisateur définit son circuit (import OSM / tracé manuel / depuis session).
- Données : écriture dans `circuits` (cf. §3) via le générateur.
- Tracé : prévisualisation 3D immédiate du résultat avant enregistrement.
- Garde : `is_official=false`, scope à définir (§3 / §6).

### 5.4 — Fiche lieu
- Rôle : détail d'un hébergement / resto / partenaire.
- Données : la table dédiée correspondante.
- Visuel : `is_premium` met en avant (liseré — PAS l'or Heritage `#C4A459`,
  strictement réservé au tier Heritage). Style premium distinct à définir.

---

## 6. RÉSERVES STRUCTURELLES (à ne pas masquer)

1. **Doublon Haute Saintonge** : 3 entrées « Haute Saintonge »-ish en base, dont
   DEUX avec `is_default=true` simultanément (« La charade » et « Haute Saintonge
   BACKUP »). Incohérence à nettoyer : une seule par défaut, et l'entrée « BACKUP »
   n'a rien à faire dans une table de production. → Ménage à valider AVANT d'exposer
   la carte (ne PAS toucher les données sans accord).
2. **Visibilité des tracés utilisateur** (§3) : privé vs partageable vs promouvable.
   Bloquant pour coder l'écran 5.3.
3. **RGPD sur les contacts de lieux** : `contact_email` / `contact_phone` de
   partenaires sont des données de contact. Si saisies par des tiers ou affichées
   publiquement, cadrer le consentement de publication (modération `is_published`).
4. **Tables à créer** : le schéma §4 est une PROPOSITION non appliquée. Migration à
   valider avant exécution.
5. **`social_pings` = lieux/événements, pas social** : confirmé, traité ici et non
   dans la fiche 07.

---

## 7. ORDRE DE TRAVAIL RECOMMANDÉ

1. Valider le schéma §4 → appliquer la migration (tables dédiées).
2. Nettoyer le doublon Haute Saintonge (§6.1), après accord explicite.
3. Écran 5.1 (carte principale) en lecture, sur seed de démonstration.
4. Écran 5.2 (fiche circuit) avec `<CircuitTrace>` 3D sur Haute Saintonge.
5. Écran 5.3 (créer un tracé) — brancher le générateur, prévisualisation 3D.
6. Écran 5.4 (fiche lieu) + filtres.
7. Brancher sur vraies données après Valence + alignement numérotation virages (§5.1
   de la fiche 05).

Chaque étape validée par le fondateur avant la suivante. Pas de refactor spéculatif.
Architecture mono-repo Expo préservée.
