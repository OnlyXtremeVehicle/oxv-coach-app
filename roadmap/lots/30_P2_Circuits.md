# Lot P2 — les circuits du Mans et d'Albi en base

*Butée : 05/09. Bloqué sur une seule chose, et elle tient en deux nombres.*

---

## Ce qui manque, exactement

Quatre circuits sont en base. Trois ont leurs virages ; **Bouteville n'en a
aucun**, alors qu'il porte 139 points de tracé médian.

| Circuit | Tracé médian | Virages | Longueur | Ligne + cap |
|---|---|---|---|---|
| Circuit Ricardo Tormo | 135 pts | **14** | 4,00 km | oui, 55,2° |
| Haute Saintonge | 72 pts | **8** | 2,21 km | oui, 298,5° |
| Charente | 26 pts | **3** | 1,54 km | oui, 53,4° |
| **Bouteville** | **139 pts** | **0 — jamais calculés** | 5,91 km | oui, 336,6° |
| Circuit Bugatti | — | — | 4,185 km | — |
| Albi | — | — | 3,565 km | — |

Ricardo Tormo rend quatorze virages, et le circuit en compte quatorze : **le
détecteur fonctionne.** Haute Saintonge rend huit contre sept déclarés — un écart
d'un, à regarder, sans urgence.

---

## P2.1 · Bouteville — un seul appel, et le résultat est déjà connu

`detect-circuit-corners` n'a jamais tourné sur Bouteville. Un appel suffit.

**Le résultat attendu, calculé le 30/08** en portant
`generateCircuit` + `PARAMS_CENTERLINE` hors du dépôt. Le port a d'abord été
validé sur Haute Saintonge : **huit virages sur huit, sens et apex identiques à
ce qui est en base.**

139 points → 128 rééchantillonnés. Longueur **5 902 m** (déclarée 5 910,
mesurée sur trois vrais tours 5 874).

| V | Sens | Rayon | Apex | V min réelle | V avant |
|---|---|---|---|---|---|
| 1 | gauche | 36 m | 0,0469 | 38,6 | 60,9 |
| 2 | gauche | 48 m | 0,1406 | 48,9 | 69,6 |
| 3 | droite | 84 m | 0,2578 | 55,8 | 88,8 |
| 4 | droite | 12 m | 0,3594 | 12,2 | 81,9 |
| 5 | gauche | 79 m | 0,4062 | 58,0 | 69,6 |
| 6 | droite | 33 m | 0,5000 | 58,2 | 85,3 |
| 7 | gauche | 40 m | 0,5547 | 57,0 | 79,2 |
| 8 | droite | 33 m | 0,7109 | 7,8 | 94,0 |
| 9 | gauche | 26 m | 0,7969 | 34,0 | 106,3 |
| 10 | droite | 14 m | 0,8438 | 26,0 | 86,1 |
| 11 | gauche | 46 m | 0,9062 | 50,6 | 74,6 |
| 12 | gauche | 95 m | 0,9766 | 53,3 | 70,3 |

Les vitesses viennent de la projection des 26 999 trames réelles sur le tracé :
**les douze correspondent à un ralentissement observé.**

**Si la fonction rend autre chose que douze virages et 5 902 m, c'est mon port
qui a tort — dites-le, ne l'ajustez pas.**

**Réserve à porter au dossier.** Le virage 6 ne tient pas la physique :
58,2 km/h sur un rayon annoncé de 33 m demanderait 0,81 g latéral, alors que le
maximum mesuré sur toute la séance est 0,62 g. Le tracé médian a un point tous
les 46 m à Bouteville, ce qui est grossier pour un rayon. À recaler sur la
trajectoire réelle, pas sur le tracé — et c'est exactement ce que l'en-tête de
`detect-circuit-corners` annonce : *« le calage définitif vient de la
télémétrie : relancer cette fonction sur le centre de piste dérivé des vrais
tours figera le tracé. »*

---

## P2.2 · Le Bugatti et Albi — ce qu'il faut, et ce qu'il ne faut pas

**Ce qu'il faut : deux identifiants de way OpenStreetMap.** Rien d'autre.

`fetchOsmWay(wayId)` existe déjà dans `src/circuit/circuitGenerator.ts` et
récupère `https://api.openstreetmap.org/api/0.6/way/{id}/full.json`, en rend les
points lat/lon et sait si le tracé est fermé. Le tracé médian de Bouteville en
est visiblement sorti. **N'écrivez pas de second récupérateur.**

Les identifiants se lisent en ouvrant le circuit sur openstreetmap.org et en
cliquant la piste. Ils ne se devinent pas, et une recherche web ne les a pas
donnés.

**La procédure, une fois les deux identifiants connus :**

1. `fetchOsmWay(wayId)` → points lat/lon.
2. Écrire `centerline_latlon`, `length_km`, `name`, `is_official`, `city`.
3. `detect-circuit-corners` sur le circuit → `corners`, `corners_engine_version`,
   `corners_computed_at`.
4. Contrôler que le nombre de virages correspond au circuit réel — **en prenant
   le nombre sur la source officielle du circuit, pas de mémoire.** Le contrôle
   n'a de valeur que si la référence est vérifiée. Si le détecteur rend un
   nombre très éloigné, c'est le tracé récupéré qui n'est pas le bon, pas le
   détecteur : il a rendu quatorze virages sur Ricardo Tormo, qui en compte
   quatorze.
5. Écrire `finish_line_lat`, `finish_line_lon`, `finish_line_radius_m` et
   **`finish_line_heading`**.

---

## P2.3 · Le cap de la ligne d'arrivée — à ne pas oublier, il décide de la preuve

`captureSessionService` porte cette phrase :

> *« Le CAP commande le MODE : fourni → porte (segment perpendiculaire, seul
> moyen d'exclure une voie des stands parallèle) ; absent → rayon historique. »*

Ce cap est celui de la **ligne**, pas du véhicule. Les quatre circuits en base
l'ont. **Le Bugatti et Albi doivent l'avoir.**

Sans lui, la détection retombe en mode rayon. **Au Bugatti, dont la voie des
stands est parallèle à la ligne droite des stands, le rayon comptera les
passages par les stands comme des tours** — et la preuve P-1, « nos tours face
au chronométrage officiel », s'effondre devant une écurie professionnelle sur un
défaut de configuration.

Rayon : les circuits existants utilisent de 10 à 35 m. Prendre 15 m pour le
Bugatti, qui est large et rapide, et vérifier sur la première séance.

---

## P2.4 · Ce qui reste ensuite

Les secteurs officiels — le recalage des intermédiaires S1/S2/S3 sur la trace
GPS — sont un lot séparé (P6). Ils ont besoin de trois tours réels sur le
circuit, donc ils ne peuvent pas être faits avant Le Mans. Bouteville sert de
banc d'essai : trois tours y existent déjà.

---

## Recette du lot

```sql
select name, is_official, length_km,
       jsonb_array_length(coalesce(corners->'corners','[]'::jsonb)) n_virages,
       corners_engine_version,
       finish_line_heading,
       jsonb_array_length(coalesce(centerline_latlon,'[]'::jsonb)) n_pts
from circuits order by name;
```

Attendu après le lot : six circuits, **tous** avec un nombre de virages non nul,
un `finish_line_heading` renseigné, et un tracé médian.
