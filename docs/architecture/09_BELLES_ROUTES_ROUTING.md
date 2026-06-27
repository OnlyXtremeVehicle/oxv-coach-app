# 09 — Belles routes & itinéraires sinueux (routing + points de vue)

> Brique « écosystème » : proposer au pilote de **belles routes** (sinueuses,
> panoramiques) pour rejoindre un circuit ou pour une balade, affichées sur
> **notre carte**, avec points de vue remarquables et navigation guidée.

## 1. Cadre OXV — doctrine & droit (À TRANCHER PAR GABIN)

Cette fonction sort du périmètre historique « miroir de piste ». Elle se conçoit
comme une extension **tourisme/découverte** de l'écosystème (à côté de
*Lieux & partenaires* et de la carte sociale), **pas** comme un outil de
performance sur route ouverte.

**Garde-fous intégrés dès la fondation :**
- **Cadre = balade / tourisme.** Vocabulaire « belle route », « sinueuse »,
  « panoramique » — jamais « rapide », « chrono », « performance ». Respect
  du code de la route affiché.
- **La performance reste sur le circuit.** On NE classe PAS les routes
  publiques par freinages appuyés / G latéraux enregistrés. Croiser la
  télémétrie de conduite (G, freinage) avec des routes ouvertes pour les
  recommander = inciter à la conduite dangereuse sur route = **doctrine
  (« sécurité avant performance ») + responsabilité juridique**. Donc la
  pondération « route intéressante » vient de la **géométrie de la route**
  (sinuosité, dénivelé) et du **paysage** (points de vue), calculées par
  l'API de routing — **pas** des données d'agressivité des pilotes.
- **Disclaimer + CGU.** Une fonction d'itinéraire engage la responsabilité.
  À cadrer dans les CGU (clause « usage routier sous votre responsabilité,
  respect du code de la route, pas d'incitation à la vitesse »).

**Décisions attendues de Gabin :**
1. On active cette extension « route ouverte » dans OXV ? (déviation doctrine assumée)
2. OK pour le cadrage « tourisme/découverte » + reformulation du point « route
   technique » en **géométrie/paysage** (pas agressivité) ?
3. Mise à jour CGU à prévoir (relecture juridique = ton périmètre).

## 2. Architecture

```
UI (écran Carte / Itinéraire)
        │
        ▼
src/services/routing/
  ├─ types.ts               formes communes (GeoPoint, ScenicRoute, ScenicPoi…)
  ├─ scenicRouteService.ts  planScenicRoute() → provider-agnostique
  │     ├─ adaptateur Kurviger   (REST, paramètre de sinuosité)
  │     └─ adaptateur GraphHopper (REST, custom model)
  └─ scenicPoiService.ts    findScenicPois() → Overpass (OpenStreetMap)
        │
        ▼
Affichage : react-native-maps (déjà présent) OU Mapbox (décision §4)
```

### 2.1 Algorithme de tracé (point 1)
- **Kurviger** : le plus rapide à intégrer. REST : point de départ (+ destination
  ou distance cible) + niveau de sinuosité. Renvoie la polyligne GPS. Clé requise.
- **GraphHopper (custom models)** : contrôle total des règles (pénaliser feux,
  favoriser routes secondaires, dénivelé). Plus de travail, auto-hébergeable.
- Le service est **provider-agnostique** : on bascule par `EXPO_PUBLIC_ROUTING_PROVIDER`.

### 2.2 Points de vue (point 2)
- **Overpass API (OSM)** gratuit : requête dans un rayon des tags
  `tourism=viewpoint`, `natural=water`, `mountain_pass`, `natural=peak`…
  → injectés comme **waypoints** optionnels (étapes) pour forcer le tracé à
  passer par le beau.
- Google Places (optionnel, payant) : filtrer par note > 4.5 — phase 2.

### 2.3 Croisement télémétrie OXV (point 3 — REFORMULÉ doctrine-safe)
- On NE remonte PAS « où les pilotes ont freiné fort » sur route ouverte.
- À la place : une route peut être marquée **« sinueuse / panoramique »** via sa
  **géométrie** (indice de sinuosité = longueur/distance à vol d'oiseau, nb de
  virages, dénivelé) renvoyée par le routing, + densité de points de vue.
- La donnée de conduite OXV (G, freinage, marge) **reste sur le circuit**, où la
  performance est cadrée et sûre. Cohérent avec « la piste est à vous ».

## 3. Variables d'environnement (clés — JAMAIS commitées)
```
EXPO_PUBLIC_ROUTING_PROVIDER=kurviger | graphhopper
EXPO_PUBLIC_KURVIGER_KEY=…        (si kurviger)
EXPO_PUBLIC_GRAPHHOPPER_KEY=…     (si graphhopper, ou URL self-host)
# Overpass : pas de clé (endpoint public, à throttler ; self-host en phase 2)
```
À poser via `eas secret:create` (toi), comme les autres clés.

## 4. Affichage & navigation (point 3 — front-end) — DÉCISION
- **Option A — react-native-maps (déjà dans l'app).** Zéro nouvelle dépendance
  native. Affiche la polyligne + marqueurs points de vue. Pas de guidage
  turn-by-turn natif (ouvre Plans/Google pour la nav réelle). **Le plus rapide,
  le moins cher.**
- **Option B — Mapbox + Navigation SDK.** Carte 3D sombre sur-mesure + guidage
  vocal intégré. **Mais** : dépendance native lourde (`@rnmapbox/maps`), coût
  Mapbox à l'usage, build natif à reconfigurer, et c'est un gros chantier.
- **Reco V1** : Option A pour sortir vite (afficher la belle route + points de
  vue sur notre carte), Mapbox en phase 2 si le besoin de guidage natif se confirme.

## 5. Plan de livraison
- **Phase 0 (faite ici)** : fondation provider-agnostique — types + service de
  routing (adaptateurs Kurviger/GraphHopper) + service POI Overpass. Aucune clé
  en dur, garde-fous doctrine en commentaire.
- **Phase 1** : écran « Belle route » (départ = position/circuit, distance cible,
  curseur sinuosité) → tracé + points de vue sur react-native-maps. Clés EAS.
- **Phase 2** : Google Places (belvédères notés), Mapbox/guidage, sauvegarde de
  routes favorites côté Supabase.

## 6. Coûts (ordre de grandeur, à confirmer)
- Kurviger / GraphHopper : freemium puis à l'usage. Overpass : gratuit (fair use).
- Mapbox : gratuit jusqu'à un quota, puis à la carte chargée / requête nav.
- Google Places : payant à la requête (réserver à la phase 2).
