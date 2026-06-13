# Formulaire — Créer un circuit sur OXV Mirror

> Demandé par Gabin le 2026-06-13. Deux usages :
> **A.** création d'un circuit **officiel** depuis le compte **admin OXV** (référentiel partagé) ;
> **B.** création d'un circuit **perso** par n'importe quel pilote, **privé par défaut** (bloc 50.3).
>
> Premier circuit de référence : **Haute Saintonge (tracé Beltoise)** — déjà saisi (sert d'exemple rempli ci-dessous).
>
> Gouvernance (règle ferme, spec 50) : un pilote crée un tracé **pour lui, privé**. La publication
> dans le **référentiel partagé est réservée à OXV** : le pilote peut « Proposer à OXV », OXV seul valide.

---

## Où vivent les données aujourd'hui (à connaître)

| Donnée | Où c'est stocké aujourd'hui | Conséquence |
|---|---|---|
| Identité, ligne d'arrivée, longueur, bbox, SVG | Table Supabase **`circuits`** (data) | Créable **sans code** depuis l'admin |
| **Polyligne GPS du tracé** (76 points HS) | **Code** : `src/trackviz/hauteSaintonge.ts` | Ajouter un circuit ⇒ aujourd'hui un **petit pas dev** |
| **Virages** (apex, nom, profil) | **Code** : `src/lib/circuitTopology.ts` (`BELTOISE_CORNERS`) | Idem |
| Segments (S1/S2/…) | **Dérivés** de la polyligne + virages | Automatique |

> **Recommandation (à valider) :** pour que vous puissiez créer un circuit **entièrement depuis l'admin**,
> sans que je touche au code à chaque fois, je propose de **migrer la polyligne et les virages dans la base**
> (colonnes `track_points jsonb`, table `circuit_corners`). C'est un chantier court que je peux intégrer à la
> construction du bloc 50. En attendant, vous remplissez ce formulaire et je fais le branchement.

---

## A. Formulaire CIRCUIT OFFICIEL (admin OXV)

### A1. Identité
| Champ | Type / unité | Obligatoire | Exemple (Haute Saintonge) |
|---|---|---|---|
| Nom officiel | texte | ✅ | `Circuit de Haute Saintonge` |
| Nom du tracé / configuration | texte | ⬜ | `Tracé Beltoise` |
| Localisation (commune, dépt) | texte | ✅ | `Bouteville (17), Nouvelle-Aquitaine` |
| Coordonnées centre (lat, lon) | décimal °, 7 décimales | ✅ | `45.2406, -0.0925` |
| Sens de roulage | horaire / anti-horaire | ✅ | `à confirmer` |
| Longueur officielle | mètres | ✅ | `~1 700 m` (calculée : voir A3) |
| Nombre de virages | entier | ✅ | `7` |
| Largeur de piste (indicative) | mètres | ⬜ | `10-12 m` |
| Type de revêtement | texte | ⬜ | `asphalte` |
| Officiel OXV ? | oui / non | ✅ | `oui` (`is_official = true`) |
| Circuit par défaut ? | oui / non | ✅ | `oui` (`is_default = true`) |

### A2. Ligne d'arrivée — **critique** (détection automatique des tours)
La détection de tour se déclenche au franchissement de cette ligne. À mesurer **sur place, au GPS**,
au point exact de la ligne de départ/arrivée peinte sur la piste.

| Champ | Type / unité | Obligatoire | Exemple |
|---|---|---|---|
| Latitude ligne d'arrivée | décimal °, 7 décimales | ✅ | `45.2390749` |
| Longitude ligne d'arrivée | décimal °, 7 décimales | ✅ | `-0.0908906` |
| Rayon de détection | mètres (10-40) | ✅ (défaut 30) | `30` |
| Cap de passage | degrés 0-360 | ⬜ (anti-faux-positifs) | `à relever` (sens de franchissement) |

> Comment l'obtenir : se placer sur la ligne, relever lat/lon (app GPS, RaceBox, ou point Google Maps précis).
> Le **cap de passage** = direction (boussole) dans laquelle on franchit la ligne en piste — évite de
> compter un tour quand on repasse en sens inverse (retour stands).

### A3. Géométrie du tracé (la polyligne)
Le tracé schématique (`TrackStage`/`CircuitMap`) est dessiné à partir d'une **liste ordonnée de points GPS**
qui suivent le ruban d'asphalte (hors voie des stands), **bouclée** (dernier point = premier).

| Champ | Type | Obligatoire | Exemple |
|---|---|---|---|
| Points GPS du tracé | liste de `{lat, lon}` ordonnée, ~40-120 points | ✅ | 76 points (HS, depuis OSM way `54412766`) |
| Longueur (calculée) | mètres | auto (Haversine) | `~1 700 m` |
| Bbox (min/max lat/lon) | décimal ° | auto | `lat 45.2389→45.2429 ; lon -0.0968→-0.0881` |

**3 façons de fournir la polyligne (du plus simple au plus précis) :**
1. **Référence OpenStreetMap** — donnez l'**ID du `way` `highway=raceway`** (ex. `54412766`). J'extrais les points (méthode HS). Le plus rapide pour un circuit existant.
2. **Tracé GPS d'un tour propre** — un fichier de session RaceBox/CSV d'un tour de référence ; je dérive la polyligne réelle (idéal une fois la 1ʳᵉ capture faite).
3. **Points posés sur carte** — vous placez les points sur une carte (c'est exactement l'outil du **bloc 50.3** ci-dessous), je les enregistre.

### A4. Virages (pour les faits par virage + insights spatiaux)
Un par virage. L'apex peut être **détecté automatiquement** depuis la polyligne (script
`scripts/analyze-track-corners.ts`, classe le profil par angle de braquage) — vous n'avez alors qu'à
**valider/renommer**.

| Champ | Type | Obligatoire | Exemple (V3 HS) |
|---|---|---|---|
| N° de virage (ordre) | entier 1..N | ✅ | `3` |
| Nom du virage | texte (sobre, OXV) | ✅ | `L'épingle Est` |
| Apex (lat, lon) | décimal °, 7 décimales | ✅ (auto-détectable) | `45.2416307, -0.0881483` |
| Profil | rapide / moyen / lent | ✅ (auto-détectable) | `lent` (épingle) |

> **Doctrine :** les noms de virages sont des **repères factuels**, jamais des consignes. Pas de « le virage
> où il faut freiner tard ». Les noms actuels HS (`Saintonge 1/2`, `L'épingle Est`, `Le balcon`, `Le retour`,
> `L'épingle Sud`, `La ramenée`) sont **provisoires** — donnez les noms officiels du circuit si vous les avez.

### A5. Secteurs (optionnel)
Si vous voulez un découpage S1/S2/S3 officiel, donnez les points de coupure (par n° de virage ou par
position sur le tracé). Sinon, je les dérive automatiquement des virages.

### A6. Visuels (optionnel)
| Champ | Type | Usage |
|---|---|---|
| Miniature / plan du circuit | image | vignette liste circuits |
| Logo / couleurs du circuit | image / hex | habillage fiche (charte OXV respectée, **or réservé Heritage**) |

---

## B. Création de circuit PERSO par un pilote (bloc 50.3)

Chaque pilote peut définir **son** tracé, **privé par défaut**. Formulaire allégé :

| Champ | Obligatoire | Note |
|---|---|---|
| Nom du circuit/boucle | ✅ | libre |
| Ligne de départ/arrivée | ✅ | posée d'un tap sur la carte |
| Points du tracé | ✅ | posés sur la carte, boucle fermée |
| Longueur estimée, nb de points | auto | affichés en direct |
| Virages | ⬜ | auto-détectés, renommables |

**Actions :**
- **« Enregistrer (privé) »** → tracé lié au pilote, visible de lui seul (RLS : `user_id = auth.uid()`).
- **« Proposer à OXV »** → crée une **demande en attente de validation** ; OXV seul publie au référentiel.
  **Pas** de bouton « Publier » côté pilote.

**Doctrine / RGPD :** un tracé perso n'est **jamais** exposé à d'autres pilotes sans validation OXV. Le pilote
peut le supprimer à tout moment (cohérent avec « vos données vous appartiennent »).

---

## C. Ce dont J'AI besoin de vous, concrètement, pour le prochain circuit

Pour ajouter un circuit (ex. **Circuit de Bordeaux**, déjà cité dans les specs), envoyez-moi **au minimum** :
1. **Nom + localisation + sens de roulage** (A1).
2. **Ligne d'arrivée : lat, lon, rayon, cap** (A2) — le seul point vraiment irremplaçable, à relever sur place.
3. **La polyligne** sous **une** des 3 formes A3 (un ID OSM suffit pour démarrer).
4. (Confort) Les **noms officiels des virages** s'ils existent (A4), sinon je les auto-détecte et vous validez.

Donnez-moi ça et je branche le circuit. Dites-moi aussi si vous voulez que je fasse d'abord la **migration
« topologie en base »** (recommandée) pour que vous puissiez créer les circuits suivants **vous-même depuis
l'admin**, sans passer par moi.
