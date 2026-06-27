# Médias & OXV Moment

> Document de cadrage. Réf. nav : `00_PLATEFORME_OXV.md §4` · périmètre : `03_MVP_SCOPE.md` (« Médias de session + OXV Moment » = ◐ partage en V1, galerie complète en V1.5) · canon : `04_DESIGN_CANON.md`.
> Statut : cadrage avant code. Ground sur l'existant — aucun écran ni table inventés.
> Doctrine : l'app **montre**, ne dirige pas. Un seul chiffre dominant par écran. **Or = donnée uniquement**, jamais sur la nav. Vouvoiement. Aucun emoji.

---

## 0. Ce qui existe déjà (à ne pas réécrire)

Le moteur média est en place. Trois services, trois buckets, des RLS distinctes. On **range et expose**, on n'invente pas.

| Brique | Fichier réel | Bucket | Visibilité (RLS) |
|---|---|---|---|
| Médias de session (officiels OXV) | `src/services/sessionMediaService.ts` | `session-media` (privé) | Pilote propriétaire · amis · coach affilié · admin. Upload/Delete **admin seul**. URLs **signées** 15 min. |
| Vitrine coach | `src/services/coachMediaService.ts` | `coach-media` (public) | Lecture publique. Écriture coach owner (`is_coach()` + dossier = `auth.uid()`). |
| Médias profil pilote | `src/services/pilotMediaService.ts` | `pilot-media` (privé) | Pilote owner (édition) · coach affilié (lecture via `coach_pilots_view`) · admin. URLs **signées** 30 min. |

Écrans réels rattachés :

| Écran | Fichier | Rôle |
|---|---|---|
| Carte trophée partageable | `app/(app)/carte-trophee.tsx` + `src/components/TrophyCard.tsx` | **Socle de l'OXV Moment** (déjà conforme : §2) |
| Partage RGPD (liens) | `app/(app)/partage.tsx` (via `sharesService`) | Lien web granulaire, **distinct** de l'OXV Moment |
| Upload médias session (admin) | `app/(admin)/sessions-media.tsx` | Côté OXV : attacher photos/vidéos à une session pilote |
| CTA « Carte à partager » | `app/(app)/bilan.tsx` (l.563-573) | Entrée vers `carte-trophee` depuis le Bilan |

Migration de référence (appliquée) : `supabase/migrations/20260526160000_0031_session_media.sql`, `0011_pilot_media_bucket.sql`, `0012_coach_pilots_view_media.sql`.

**Manque côté pilote** : il n'existe **aucun** écran galerie pour consulter ses médias de session. Le service `listSessionMedia()` est prêt, mais rien ne l'appelle dans `app/(app)/`. C'est le principal chantier V1.5 (§1.5).

---

## 1. Médias de session

### 1.1 Nature des médias

| Type | Source | Stockage | Décision |
|---|---|---|---|
| Photos officielles | Photographe OXV en piste | `session-media` (admin upload) | V1 lecture |
| Vidéos embarquées / clips | Caméra véhicule, importée par OXV | `session-media` (`media_type = 'video'`) | V1 lecture |
| Captures Data Lab | Export image d'une vue (carte, tours, virage) depuis le Bilan | partage OS éphémère, **pas** de bucket | §1.4 |
| Carte OXV Moment | `TrophyCard` capturée | image éphémère (view-shot) | §2 |
| Galerie événement | Agrégat des médias d'un track day | vue, pas table neuve | Club, V1.5 — `01_ORGANISATION_PRODUIT.md §Club` |

La table `session_media` porte déjà tout le nécessaire : `media_type ('photo'|'video')`, `mime_type`, `width_px`, `height_px`, `duration_seconds`, `caption`, `display_order`, `deleted_at` (soft-delete RGPD), `uploaded_by_user_id`. **Aucun changement de schéma requis pour la V1.**

### 1.2 Qui upload, qui voit

C'est verrouillé par les RLS de la migration 0031 — on s'y aligne, on ne les contourne pas.

| Action | Qui | Mécanisme |
|---|---|---|
| Upload | **Admin OXV uniquement** | `session_media_insert_admin` (`is_admin()`) + storage `session_media_storage_write` |
| Voir (table) | Pilote owner · amis · coach affilié · admin | `session_media_select_owner` / `_friend` (`are_friends`) / `_coach` (`is_coach_of`) / `_admin` |
| Voir (fichier) | mêmes acteurs | `session_media_storage_select` (extrait `pilot_user_id` de `storage.foldername(name)[1]`) |
| Supprimer | Admin (soft-delete via `deleted_at`) | `softDeleteSessionMedia()` |

Le pilote **ne dépose jamais** de média de session ; il reçoit. La symétrie pilote↔table↔storage est double : un `SELECT` autorisé sur la ligne ne suffit pas, il faut aussi l'autorisation storage pour signer l'URL. `listSessionMedia()` génère les `signedUrl` (15 min) en parallèle après lecture.

**Vitrine coach** (`coach-media`) et **profil pilote** (`pilot-media`) suivent une logique d'**auto-édition** : le titulaire ajoute/retire ses propres médias (`addMyCoachMedia` / `addMyPilotMedia` via `expo-image-picker`), avec rollback storage si l'écriture DB échoue. Ces deux flux sont **déjà fonctionnels** — ils relèvent du Club (coach) et du Compte (profil), pas du Bilan.

### 1.3 Galerie événement (Club, V1.5)

Regroupe les médias officiels d'un track day. **Aucune table neuve** : c'est un filtre sur `session_media` par événement (jointure `telemetry_sessions` → événement). À cadrer avec `05_ROLES_PERMISSIONS.md` (un pilote ne voit que SES médias d'un événement, jamais ceux des autres — les RLS le garantissent déjà). Reporté V1.5.

### 1.4 Captures Data Lab (export partageable)

Le Bilan et ses sous-vues (carte, tours, virage, heatmap) sont des images potentielles. Le mécanisme existe déjà dans `carte-trophee.tsx` : `captureRef` (`react-native-view-shot`) → `Sharing.shareAsync` (`expo-sharing`). On **réutilise** ce duo pour exporter une vue Data Lab, sans persistance (image éphémère, pas de bucket).

**Garde-fou doctrine** : une capture exportée reste **descriptive**. Aucune annotation prescriptive, aucun classement, aucune comparaison non consentie n'apparaît dans une image qui sort de l'app. Le seul rouge admis sur un export est la marque (le X du logo), jamais une alerte « performance ».

### 1.5 Écran galerie pilote (V1.5 — à créer)

Chantier net-neuf, débloqué par ce doc :

- **Route** : `app/(app)/session-media/[id].tsx` (le path est déjà anticipé dans le commentaire de la migration 0031, l.13).
- **Objectif (une seule question)** : « Quels souvenirs de cette session ? »
- **Data** : `listSessionMedia(sessionId)` → grille de vignettes (`signedUrl`), `caption` en sous-ligne, ordre `display_order`.
- **Actions** : ouvrir en plein écran ; pour une photo, possibilité d'en faire un OXV Moment (§2) ; rien d'autre.
- **États** : vide (« Aucun média pour cette session pour l'instant. »), chargement, URLs expirées (re-signer à la demande).
- **Entrée** : depuis le Bilan, à côté du CTA « Carte à partager » existant.

---

## 2. OXV Moment

### 2.1 Définition

L'**OXV Moment** est la **seule** chose pensée pour être vue **hors de l'app** (story, post, message). Le socle existe : c'est `TrophyCard` (format 4:5, capturable, `forwardRef`) rendu par `app/(app)/carte-trophee.tsx`. On **renomme conceptuellement** « carte trophée » → « OXV Moment » dans le vocabulaire produit ; le composant reste.

Grammaire stricte (déjà respectée dans `TrophyCard.tsx`) : **un logotype · un chiffre dominant · un tracé · une signature**. Rien de plus.

### 2.2 Anatomie (carte réelle, ground sur `TrophyCard.tsx`)

```
┌──────────────────────────────────────┐  4:5 · fond #0A0A0C · bord #242428
│  OXV                       SESSION    │  logo Geist (le X en rouge #C8102E)
│   ↑ X rouge                05 JUIN 26 │  eyebrow Mono · faint
│                                       │
│            ╭───────╮                  │
│           ╱         ╲                 │  tracé du circuit, polyline SVG
│          │  (tracé)  │ ● départ       │  stroke OR #FFB703 (donnée)
│           ╲         ╱                 │  point de départ crème
│            ╰───────╯                  │
│                                       │
│              MEILLEUR TOUR            │  label Mono · OR
│              1'47.60                  │  ← LE chiffre dominant (Mono 46, crème)
│              Haute Saintonge          │  nom circuit (Geist)
│              Tracé · 42 tours         │  sous-ligne Mono · creamMute
│                                       │
│  ──────────────────────────────────  │
│   ONLY XTREME VEHICLE · OXVEHICLE.FR  │  signature Mono · faint (branding discret)
└──────────────────────────────────────┘
```

Décomposition par couche doctrinale :

| Élément | Valeur (exemple) | Style réel | Couleur | Règle |
|---|---|---|---|---|
| Logo | `OXV` (X coloré) | `bodySemi` 22 | crème · X en **rouge** | rouge = marque, pas « perf » |
| Eyebrow | `SESSION` + date | Mono 9.5 | faint | date = repère, pas chiffre dominant |
| Tracé | polyline du circuit | SVG `stroke` 2.4 | **OR `#FFB703`** | or = **donnée** (la géométrie roulée) |
| Point de départ | ● | `Circle` r3 | crème | repère ligne |
| Label | `MEILLEUR TOUR` | Mono 9.5 | OR | étiquette de la donnée |
| **Chiffre dominant** | `1'47.60` | Mono **46** | crème | **un seul** par carte |
| Circuit | `Haute Saintonge` | `display` 14 | crème | contexte |
| Sous-ligne | `Tracé · 42 tours` | Mono 10 | creamMute | fait, pas classement |
| Signature | `ONLY XTREME VEHICLE · OXVEHICLE.FR` | Mono 9 | faint | branding **discret** |

Données réelles, jamais inventées : le meilleur tour vient du **même chemin que le Bilan** (`fetchSessionLaps` → `computeRegularity` → `bestSeconds`, repli `session.best_lap_seconds`) ; le tracé vient de `fetchSessionCircuitCenterline`, repli Haute Saintonge officiel. Pas de carte vide.

### 2.3 Doctrine de l'OXV Moment

- **Un seul chiffre** : le meilleur tour. C'est un **fait**, pas un classement. Aucun « mieux que », aucun « +0,3 s », aucun rang.
- **Or = donnée** : le tracé et son label portent l'or parce qu'ils **sont** la donnée roulée. L'or Heritage `#C4A459` reste interdit ici (réservé tier Heritage).
- **Rouge = marque** : seul le X du logo. Jamais d'alerte rouge, jamais de « performance ».
- **Aucun verbe prescriptif**, aucune phrase OXV qui dirige. Si une phrase éditoriale est ajoutée (§2.4), elle reste descriptive ou contemplative.
- **Branding discret** : la signature de pied, rien de plus. Pas de QR, pas de call-to-action marketing.
- Le partage passe par la **feuille système** (`expo-sharing`) qui couvre Story et Enregistrer ; pas d'intégration réseau propriétaire.

### 2.4 Phrase OXV (option éditoriale, V1.5)

`TrophyCard` n'affiche aujourd'hui **aucune** phrase. Si l'on en ajoute une (registre Instrument Serif, cf. canon §2), elle doit rester **non prescriptive et non jugeante**.

| Autorisé (contemplatif / factuel) | Interdit (prescriptif / jugeant) |
|---|---|
| « Une séance. » | « Bonne progression. » |
| « Le tracé, tel qu'il a été roulé. » | « Vous pouvez gagner 2 secondes. » |
| « Haute Saintonge, ce jour-là. » | « Freinez plus tard au virage 4. » |
| (silence — pas de phrase) | « Meilleur que votre dernière fois. » |

En cas de doute : **pas de phrase**. La carte se suffit (chiffre + tracé + signature). Toute phrase = à valider avec Gabin avant code (registre éditorial sensible).

### 2.5 OXV Moment ≠ partage RGPD

Distinction à tenir, deux écrans, deux logiques :

| | OXV Moment (`carte-trophee.tsx`) | Partage RGPD (`partage.tsx`) |
|---|---|---|
| Sort une… | **image** statique | **page web** de données vivantes |
| Persistance | aucune (éphémère) | lien tokenisé + révocable (`sharesService`) |
| Expose | un chiffre + un tracé | métriques **cochées** par le pilote (vide par défaut) |
| RGPD | non concerné (pas de données vivantes exposées) | scope + durée + révocation + compteur de vues |
| Voie | feuille de partage OS | URL `oxvehicle.fr` |

Les deux **coexistent**. On ne fusionne pas : l'OXV Moment est un objet de **fierté sobre** ; le partage RGPD est un **outil de contrôle** des données.

---

## 3. Synchro vidéo ↔ télémétrie (V2)

Reportée explicitement en **V2** (`03_MVP_SCOPE.md` : « Synchro vidéo ↔ télémétrie avancée » = V2). On cadre l'intention, on ne code rien.

### 3.1 Approximation V2 (sans précision frame)

- **Ancre** : `telemetry_sessions.started_at` (déjà en base) + `session_media.duration_seconds` (déjà en table) comme repère grossier. Un décalage manuel (offset en secondes, réglé par le pilote ou par OXV à l'upload) suffit à une synchro **approximative** — pas de Kalman, pas d'alignement GPS-vidéo fin.
- **Lecture** : un curseur temporel commun entre la vidéo (`expo-av`/lecteur) et la courbe du Data Lab. Le pilote glisse, les deux suivent.
- **Doctrine** : la vidéo **montre**, elle ne surligne pas d'« erreur ». Pas d'overlay rouge « mauvais virage » sur la vidéo. Au plus, un repère neutre « à observer ».

### 3.2 Ce que ça nécessite — À SOUMETTRE À GABIN

> **Nécessite accord.** Tout ce qui suit est une **proposition de schéma**, pas un acquis.

- Un champ d'offset de synchro (ex. `session_media.sync_offset_seconds`, `NUMERIC`) **n'existe pas** aujourd'hui. Son ajout est **à soumettre** à l'accord de Gabin avant toute migration.
- Aucune table neuve n'est requise pour la V2 approximative : l'offset peut vivre sur `session_media` existante. La précision frame (V2+) éventuelle est hors périmètre de ce doc.

Tant que l'accord n'est pas donné, la synchro reste un cadrage, pas un ticket de code.

---

## 4. Récapitulatif décisionnel

| Sujet | Statut | Schéma |
|---|---|---|
| Médias session (lecture pilote, upload admin) | **V1** — services + RLS prêts | Existant (0031), inchangé |
| Galerie pilote `session-media/[id]` | **V1.5** — à créer (service prêt) | Existant, inchangé |
| Galerie événement (Club) | V1.5 | Vue sur l'existant, inchangé |
| Captures Data Lab exportables | V1 (réutilise view-shot + expo-sharing) | Aucun (éphémère) |
| OXV Moment (`carte-trophee` / `TrophyCard`) | **V1** — déjà conforme | Aucun |
| Phrase OXV sur la carte | V1.5 — **à valider avec Gabin** | Aucun |
| Synchro vidéo ↔ télémétrie | **V2** | Offset `sync_offset_seconds` **à soumettre à Gabin** |

**Règle finale** : aucun OXV Moment ne dirige, ne classe, ni ne juge. Un chiffre, un tracé, une signature — le reste est silence.
