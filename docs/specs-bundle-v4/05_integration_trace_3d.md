# 05 — Intégration du tracé 3D dans les rapports pilote & coach

> Document de liaison pour Claude Code. Décrit COMMENT brancher le tracé 3D
> (générateur `circuit-generator.mjs`) sur les écrans de rapport, template par
> template. À lire APRÈS `00_CLAUDE.md`, `02_moteur_insights.md` et le
> `CONTRAT_DONNEES_session_insights.json`.
>
> Principe directeur : **le tracé n'est pas un écran isolé, c'est le support de
> lecture des données.** On ne lit pas des chiffres dans un tableau, on les lit
> SUR la piste, virage par virage. Doctrine Mirror : montrer OÙ, jamais dire QUOI faire.

---

## 1. ARCHITECTURE RETENUE (décision fondateur — non négociable)

**Un seul tracé partagé. Le coach débloque des couches supplémentaires.**

- Une seule source de vérité visuelle : le composant `<CircuitTrace>`.
- La distinction pilote / coach ne crée PAS deux écrans. Elle se joue sur la
  liste des couches accessibles, passée en prop.
- Le pilote voit les couches FACTUELLES (où, combien).
- Le coach voit EN PLUS les couches COMPARATIVES et INTERPRÉTATIVES, toujours
  visuellement attribuées au coach (cf. doctrine : seul le coach, agréé, prescrit).

```
<CircuitTrace
   circuit={circuitGeometry}      // sortie de generateCircuit()
   session={sessionInsights}      // CONTRAT_DONNEES_session_insights.json
   layers={role === 'coach' ? COACH_LAYERS : PILOT_LAYERS}
   role={role}
/>
```

---

## 2. LE COMPOSANT `<CircuitTrace>` — brique réutilisable

Source de la géométrie : `circuit-generator.mjs` (déjà livré, testé : 7/7 virages
sur OSM 54412766, ruban sans pli). Three.js pour le rendu (cf. `circuit-3d.html`
livré comme référence d'allure — à porter en React Three Fiber dans l'app Expo :
`@react-three/fiber` + `@react-three/drei` + `expo-gl`).

### Entrées
| Prop | Type | Source |
|------|------|--------|
| `circuit` | objet | `generateCircuit(points, opts)` → `{centerline, corners, ribbon, length_m}` |
| `session` | objet | une ligne de `session_insights` (cf. contrat JSON) |
| `layers` | string[] | liste ordonnée des couches à proposer dans le sélecteur |
| `role` | 'pilot' \| 'coach' | détermine le set par défaut + l'accès aux couches coach |

### Comportement
- Sélecteur de couches en haut (chips). Le pilote choisit librement ce qu'il veut
  voir sur SA piste — l'app ne décide pas pour lui.
- Chaque virage du ruban se colore selon la couche active.
- Au tap sur un virage : panneau de détail FACTUEL (valeurs brutes, pas de conseil).
- Couches coach : badge « Coach » visible, style distinct (liseré or `--oxv-gold`).

---

## 3. LES COUCHES (et leur source de données EXACTE)

> ⚠️ Chaque couche doit être alimentée par une clé RÉELLE du contrat. Une couche
> sans donnée → état vide explicite (cf. règle Mirror : ne jamais maquiller l'absence).

### Couches PILOTE (factuelles — accès libre)

| Couche | Clé du contrat | Mapping couleur | État vide si |
|--------|----------------|-----------------|--------------|
| **Vitesse d'apex** | `anatomy[].apex_speed_kmh` | lent→rapide (vert→rouge inversé) | `anatomy` absent |
| **Anatomie freinage** | `anatomy[].brake_dist_m` | court→long | idem |
| **Régularité** | `dispersion[corner_N]` | dispersion faible=vert, forte=rouge | `dispersion` vide |
| **Équilibre châssis** | `chassis_balance[corner_N]` | sous-virage (−) bleu / neutre / survirage (+) rouge | gyroscope absent |
| **Transfert de charge** | `load_transfer[corner_N]` | rapide→lent (s) | `load_transfer` vide |

### Couches COACH (comparatives / interprétatives — débloquées pour le coach)

| Couche | Clé du contrat | Spécificité |
|--------|----------------|-------------|
| **Perte de temps** | `ideal_lap.loss_by_sector_pct[]` | ⚠️ par SECTEUR, pas par virage (cf. §5) |
| **Dispersion détaillée** | `dispersion` + tours bruts | nuage de trajectoires superposées |
| **Annotations coach** | `coach_annotations` (table existante) | texte attribué au coach, sur un virage |
| **Référence coach** | `coach_corner_reference` (table, vide pour l'instant) | point de freinage / vitesse cible |

---

## 4. PLAN D'INTÉGRATION — TEMPLATE PAR TEMPLATE

> Pour chaque écran : ce qu'il est aujourd'hui (maquette), comment le tracé s'y
> branche, et la clé de données. Format identique pour tous — c'est le gabarit à
> suivre aussi pour les écrans à créer (§6).

### 4.1 — `maquette_20.1_synthese.html` (synthèse de session, écran pilote)
- **Rôle** : vue d'entrée après une session. Aujourd'hui : cartes de stats.
- **Intégration tracé** : ajouter le tracé en **héro** en haut de l'écran, couche
  par défaut = « Régularité ». Le pilote bascule de couche depuis là.
- **Clé** : `session_insights` complet ; `data_quality` pour le bandeau de fiabilité.
- **Liaison** : tap sur un virage → scroll vers la carte d'insight correspondante.

### 4.2 — `maquette_20.2_signature.html` (signature de pilotage)
- **Rôle** : les 4 piliers factuels du pilote.
- **Intégration tracé** : tracé en couche « Vitesse d'apex » + « Anatomie freinage »,
  illustrant la signature sur la piste.
- **Clé** : `anatomy[]`.

### 4.3 — `maquette_60.2_comparaison.html` (comparaison, écran coach)
- **Rôle** : comparer tours / pilotes. C'est l'écran COACH par excellence.
- **Intégration tracé** : tracé partagé avec **couches coach débloquées**
  (perte de temps par secteur, dispersion détaillée). Badge « Coach ».
- **Clé** : `ideal_lap`, `dispersion`, `session_drift`.

### 4.4 — `maquette_E0.2_ar_coach.html` (vue AR coach)
- **Rôle** : restitution augmentée, attribuée au coach.
- **Intégration tracé** : le tracé 3D EST le support AR. Couches coach +
  annotations posées sur les virages.
- **Clé** : `coach_annotations` + géométrie circuit.

### 4.5 — Maquettes d'insight individuelles (N2-1 → N4-5)
Chacune garde son SVG 2D détaillé (déjà figé, fidèle pixel). Le tracé 3D vient
en COMPLÉMENT, pas en remplacement : un mini-tracé qui localise l'insight sur la
piste. Mapping :
| Maquette | Couche tracé associée | Clé |
|----------|----------------------|-----|
| `N2-1_anatomie` | Vitesse d'apex / freinage | `anatomy[]` |
| `N2-2_gg` | (pas de localisation virage — garder G-G 2D seul) | `gg_envelope` |
| `N2-3_profils` | état vide jusqu'à Valence | `throttle_brake` (null) |
| `N3-1_dispersion` | Régularité | `dispersion` |
| `N3-2_tour_ideal` | Perte de temps (secteur) | `ideal_lap` |
| `N4-3_flow` | (niveau session, pas virage) | `flow_coherence` |
| `N4-4_equilibre` | **Équilibre châssis** (couche phare) | `chassis_balance` |
| `N4-5_transfert` | Transfert de charge | `load_transfer` |

---

## 5. ⚠️ DEUX RÉSERVES STRUCTURELLES (à résoudre, pas à masquer)

### 5.1 — Désalignement du nombre de virages
Le moteur d'insights actuel détecte les virages par **minima de vitesse** →
13 virages (corner_1..13) sur le contrat d'exemple. Le générateur de circuit
détecte par **courbure** → 7 virages sur le même tracé OSM. **Les couleurs ne
tomberont pas sur les bons virages tant que les deux ne partagent pas la même
détection.**
→ ACTION : aligner `detectCorners` du moteur d'insights sur la méthode courbure
du générateur (débruitage + rééchantillonnage ~5-10 m + seuil rayon). Calibration
finale sur vraies données à Valence (juillet 2026). NE PAS coder l'affichage
définitif des couleurs par virage avant cet alignement — utiliser une session de
démo alignée 7 virages en attendant.

### 5.2 — Perte de temps : secteur ≠ virage
`ideal_lap.loss_by_sector_pct` est découpé en N secteurs temporels égaux, pas en
virages. Tant qu'on n'a pas la correspondance secteur→virages d'un circuit donné,
la couche « Perte de temps » s'affiche par SECTEUR (zones du tracé), pas par
virage. L'étiqueter honnêtement « par secteur ».

---

## 6. GABARIT POUR LES ÉCRANS À CRÉER (pages manquantes)

Pour tout nouvel écran, remplir cette fiche AVANT de coder (même structure que §4) :

```
### [nom_ecran]
- Rôle : [à quoi sert l'écran, pour qui]
- Maquette de référence : [existe ? sinon = à concevoir d'abord]
- Intégration tracé : [héro / complément / support AR / aucune]
- Couche(s) par défaut : [parmi §3]
- Clé(s) de données : [clés EXACTES du contrat JSON]
- Liaison : [interactions vers d'autres écrans]
- Réserve éventuelle : [donnée manquante → état vide explicite]
```

Écrans identifiés comme manquants (à concevoir — PAS de maquette existante) :
- **Espace COACH complet** : tables existent (`coach_pilots`, `coach_annotations`,
  `coach_corner_reference`, `coach_permissions`, `coach_roulages`...). À CODER une
  fois les vues définies.
- **SOCIAL** : tables existent (`pilot_friendships`, `pilot_goals`, `social_pings`,
  `app_progression_shares`, `roulage_invitations`). À CONCEVOIR d'abord (RGPD partage
  entre pilotes à cadrer).
- **CARTE / lieux** : `circuits` + `circuit_services` existent. Partenaires /
  hébergements / restaurants / événements N'EXISTENT PAS (ni table ni maquette) —
  conception neuve, hors périmètre tracé.

---

## 7. ORDRE DE TRAVAIL RECOMMANDÉ

1. Porter `<CircuitTrace>` en React Three Fiber (depuis `circuit-3d.html`), testable
   sur la session de démo alignée 7 virages. Valider l'allure AVANT de brancher les vraies couches.
2. Brancher les couches PILOTE factuelles une par une (commencer par Régularité +
   Vitesse d'apex, les mieux alimentées).
3. Intégrer dans `20.1_synthese` (héro) puis `20.2_signature`.
4. Débloquer les couches COACH dans `60.2_comparaison` + `E0.2_ar_coach`.
5. Résoudre la réserve §5.1 (alignement détection virages) sur données Valence.
6. SEULEMENT ENSUITE : écrans manquants (coach complet, social, carte) via le gabarit §6.

Chaque étape validée par le fondateur avant la suivante. Pas de refactor spéculatif.
