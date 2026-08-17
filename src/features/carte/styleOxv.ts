/**
 * Le style de carte OXV — la charte appliquée au fond de plan.
 *
 * ===========================================================================
 * POURQUOI UN STYLE ÉCRIT À LA MAIN
 * ===========================================================================
 *
 * C'est la raison même de la migration vers MapLibre. Apple Maps et Google Maps
 * ne se stylent pas : leur fond arrivait avec ses propres gris, ses propres
 * bleus, sa propre typographie — et sur `PROVIDER_DEFAULT`, avec DEUX rendus
 * différents selon la plateforme. Un dépôt qui mesure ses rapports de contraste
 * et réserve l'or au chrono ne peut pas laisser un tiers décider de la moitié
 * de la surface d'un écran.
 *
 * Ici, chaque teinte vient de `palette` — aucune valeur écrite en dur.
 *
 * ===========================================================================
 * CE QUE LE FOND DE PLAN N'A PAS LE DROIT DE FAIRE
 * ===========================================================================
 *
 * **Il ne porte AUCUNE couleur de donnée.** Les cinq teintes QDI et l'or du
 * chrono restent réservées à ce qui se superpose à la carte — marqueurs,
 * tracés, points. Un fond qui emprunterait un bleu de donnée le viderait de son
 * sens partout ailleurs.
 *
 * Le fond travaille donc en GRIS, du plus sombre (la terre) au plus clair (les
 * routes principales), pour que tout ce qui est posé dessus ressorte sans
 * effort. C'est la même hiérarchie que les fonds de carte : `bg.base` porte la
 * terre, et les routes montent vers `text.dim` sans jamais l'atteindre.
 *
 * ===========================================================================
 * LA SOURCE — PROTOMAPS AUTO-HÉBERGÉ
 * ===========================================================================
 *
 * Décision fondateur : tuiles Protomaps servies par OXV, aucun tiers.
 *
 * MapLibre **Native** ne lit PAS le format `.pmtiles` — vérifié le 17/08/2026 :
 * zéro occurrence de `pmtiles` dans le binding, SDK natif 6.26.0, et aucun moyen
 * d'enregistrer un protocole depuis JavaScript (`addProtocol` n'existe que dans
 * MapLibre GL JS). Le fichier doit donc être servi par un point d'entrée HTTP
 * qui traduit `{z}/{x}/{y}` en lecture par plage — côté `oxv-site`, pas ici.
 *
 * `EXPO_PUBLIC_TILES_URL` porte ce point d'entrée. **Tant qu'elle est absente,
 * ce module rend un style SANS source** : la carte affiche le fond titane et
 * rien d'autre. C'est délibéré — pointer vers une URL inexistante produirait des
 * erreurs réseau en boucle et un écran qui paraît cassé, là où un fond nu se
 * lit comme « la carte n'est pas encore branchée ».
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

import { palette } from '@/theme/v2';

/**
 * Nom de la source dans le style. Les couches y font référence : le changer
 * sans changer les couches rendrait une carte vide, sans erreur.
 */
const SOURCE = 'oxv';

/**
 * Couches du schéma « basemap » de Protomaps.
 *
 * À CONFIRMER CONTRE LE `.pmtiles` RÉELLEMENT PRODUIT : ces noms sont ceux du
 * schéma standard. Un fichier généré avec un autre schéma (OpenMapTiles, par
 * exemple) porte `transportation` là où celui-ci porte `roads`, et les couches
 * concernées resteraient invisibles — sans la moindre erreur pour le signaler.
 */
const COUCHES = {
  terre: 'earth',
  eau: 'water',
  routes: 'roads',
  batiments: 'buildings',
} as const;

/** L'URL du service de tuiles, ou `null` s'il n'est pas encore déployé. */
export function urlTuiles(): string | null {
  const u = process.env.EXPO_PUBLIC_TILES_URL;
  return typeof u === 'string' && u.trim().length > 0 ? u.trim() : null;
}

/**
 * Le style OXV. Sans service de tuiles, rend le fond seul plutôt qu'un style
 * qui échouerait à charger.
 */
export function styleOxv(): StyleSpecification {
  const url = urlTuiles();

  // Le fond est TOUJOURS peint, source ou pas : c'est lui qui garantit qu'aucun
  // blanc n'apparaît pendant le chargement des tuiles. Une carte qui blanchit
  // une fraction de seconde casse l'écran sombre autour d'elle.
  const fond = {
    id: 'fond',
    type: 'background' as const,
    paint: { 'background-color': palette.night },
  };

  if (url === null) {
    return { version: 8, sources: {}, layers: [fond] };
  }

  return {
    version: 8,
    sources: {
      [SOURCE]: {
        type: 'vector',
        tiles: [`${url.replace(/\/$/, '')}/{z}/{x}/{y}.mvt`],
        minzoom: 0,
        maxzoom: 14,
        // Attribution OBLIGATOIRE : les tuiles dérivent d'OpenStreetMap, sous
        // ODbL. Le dépôt porte déjà une garde à ce sujet (`attributionOsm`), et
        // elle vaut aussi pour un fond auto-hébergé — s'héberger soi-même
        // n'affranchit pas de la licence.
        attribution: '© OpenStreetMap, © Protomaps',
      },
    },
    layers: [
      fond,
      {
        id: 'terre',
        type: 'fill',
        source: SOURCE,
        'source-layer': COUCHES.terre,
        paint: { 'fill-color': palette.night },
      },
      {
        id: 'eau',
        // L'eau est le SEUL élément que l'œil attend plus sombre que la terre :
        // un fond de carte sombre inverse le réflexe des cartes claires, où
        // l'eau est plus claire. On garde le gris, jamais un bleu — le bleu est
        // la trajectoire.
        type: 'fill',
        source: SOURCE,
        'source-layer': COUCHES.eau,
        paint: { 'fill-color': palette.separator },
      },
      {
        id: 'batiments',
        type: 'fill',
        source: SOURCE,
        'source-layer': COUCHES.batiments,
        // Les bâtiments ne se lisent qu'en ville et de près : ils s'effacent
        // au-delà, pour ne pas encombrer une vue de territoire.
        minzoom: 14,
        paint: { 'fill-color': palette.cardBorderProminent, 'fill-opacity': 0.6 },
      },
      {
        id: 'routes',
        type: 'line',
        source: SOURCE,
        'source-layer': COUCHES.routes,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': palette.legend,
          // La largeur suit le zoom, pas l'importance de la route : le schéma
          // des classes reste à confirmer contre le fichier réel, et une
          // interpolation par zoom donne un résultat juste dans tous les cas.
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 1.4, 16, 3],
        },
      },
    ],
  };
}
