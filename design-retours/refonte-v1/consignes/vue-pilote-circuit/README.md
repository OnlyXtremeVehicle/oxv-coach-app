# Consignes — Vue pilote embarquée sur circuit réel (idée à explorer)

> Statut : **prototype / à valider**. Le porteur n'est pas certain de l'idée.
> Ce dossier réunit tout ce qu'il faut pour qu'une autre personne reprenne et
> tranche : concept, données, règles de couleur, navigation, intégration RN.

## Fichiers de ce dossier
- `README.md` — ces consignes.
- `track_saintonge.js` — données du circuit **Haute Saintonge** déjà calculées
  (points, courbure, vitesse, action par point). Généré depuis le GeoJSON OSM.
- Référence visuelle jouable : `../../app__replay.dc.html` (ouvre dans le navigateur ;
  glisser sur le plan pour se déplacer, bouton lecture pour laisser rouler).

---

## 1. Le concept
Une **caméra embarquée** (vue subjective pseudo-3D) qui parcourt la trajectoire
réelle d'un circuit. **Ce n'est pas une vidéo qui tourne** : le pilote contrôle
sa position en **glissant le long du plan du circuit** (scrub par manipulation
directe). Un bouton lecture optionnel laisse rouler tout seul au tempo réel
(ça ralentit dans les virages, accélère en ligne droite).

Trois piliers demandés :
1. **Couleurs QDI selon l'action** effectuée à chaque endroit du circuit.
2. **Fond ambiant réactif** (pas une boucle vidéo) — un halo qui glisse vers la
   couleur de l'action courante.
3. **Déplacement facile et innovant** — glisser le doigt sur le tracé réel.

---

## 2. Pipeline de données (déjà fait, à reproduire côté app)
Source : export **GeoJSON** OSM du raceway (LineString `highway=raceway`).
Traitement (script de préparation, résultat dans `track_saintonge.js`) :
1. Projeter lon/lat → mètres (équirectangulaire autour du centroïde).
2. Rééchantillonner en **N = 300 points** équidistants (~6,3 m).
3. Heading + **courbure signée** par point, lissée (fenêtre 7).
4. **Profil de vitesse** : v ∝ √rayon, borné, puis lissé avant/arrière pour
   respecter des taux de freinage/accélération réalistes → `kmh` 70–232.
5. **Classement d'action** par point (voir §3) → `action`.
6. `map` = points normalisés 0..100 (y inversé écran) pour le plan interactif.
7. `drive` = courbure remise à l'échelle pour le rendu pseudo-3D.

Sortie (`window.SAINTONGE_TRACK`) :
`{ N, lengthM, kmh[], action[], drive[], map[] }`
Circuit Haute Saintonge : **1905 m**, 300 points. Le tracé OSM n'est pas fermé
(≈220 m entre départ et arrivée) → segment de jonction ignoré sur le plan.

---

## 3. Règles de couleur (palette QDI par action) — NORMATIF
Chaque point porte une action ; sa couleur colore la **ligne de course**, les
**vibreurs**, la **jauge d'accélérateur**, la **pastille d'action** et le **fond ambiant**.

| Action    | Détection                              | Couleur    | Token      |
|-----------|----------------------------------------|------------|------------|
| Freinage  | vitesse en baisse (dv/ds ≤ −3)         | `#60A5FA`  | brake/bleu |
| Corde     | courbure forte, vitesse quasi stable   | `#F2792B`  | apex/ambre |
| Réaccél.  | vitesse en hausse (dv/ds ≥ +3)         | `#4ADE80`  | accel/vert |
| Plein gaz | ligne droite, vitesse haute stable     | `#FFB703`  | gold/or    |

Doctrine maintenue : **l'or reste la donnée** (la vitesse au HUD est en or) ;
le reste est neutre ; le rouge « REPLAY » = marque (jamais une donnée de perf).

---

## 4. Navigation (l'idée à défendre)
- **Plan du vrai circuit** en bas, segments colorés par action, avec un
  **playhead** qu'on **glisse** (pointer down/move) → saut instantané à ce point.
  `seekToMap` = point du circuit le plus proche du doigt.
- **Bouton lecture** : avance auto, position × vitesse réelle, boucle.
- Position mémorisable (localStorage côté proto ; état de nav côté app).

## 5. Fond ambiant
Halo radial derrière la route dont la couleur **ease** (≈6 %/frame) vers la
couleur de l'action courante — présent aussi sur l'horizon du rendu 3D.
Subtil, « respire », ne défile pas.

---

## 6. Rendu pseudo-3D (référence)
Technique OutRun/pole-position : segments projetés de loin en près avec
accumulation latérale de la courbure (`x += dx; dx += curve`), quads de route +
vibreurs + ligne de course, culling par `maxy`. Caméra posée sur la ligne de
course (`playerX = linePos`). Silhouette de volant + tableau de bord en overlay.

## 7. Intégration RN (piste)
- Rendu embarqué : **`<Canvas>` Skia** (mêmes quads de route + `Path` de la
  ligne colorée par segment), boucle `requestAnimationFrame`/frame callback.
- Navigation : `react-native-gesture-handler` (Pan sur le plan) pilotant la
  position ; le plan = `Path` Skia coloré par action.
- Données : rejouer le pipeline §2 à l'ingestion d'un circuit (une fois),
  stocker `{kmh, action, drive, map}` par circuit.
- Archétype : **A4** (famille carte/replay). Fichier cible probable `replay.tsx`.

## 8. Généralisation
Le moteur est agnostique du circuit : fournir n'importe quel GeoJSON de raceway
au pipeline §2 → mêmes tableaux → même vue. Haute Saintonge n'est qu'un exemple.
