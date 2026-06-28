/**
 * appMap — source unique de vérité de la navigation pilote (OXV Platform).
 *
 * Mappe chaque route réelle de `app/(app)/*` vers une zone (Paddock · Session ·
 * Bilan · Progression · Club · Compte). La barre d'onglets, le Paddock contextuel
 * et le futur Data Lab lisent cette table — fini les menus improvisés.
 *
 * Décisions verrouillées (cf. docs/refonte-app/00_PLATEFORME_OXV.md §4) :
 *   - 5 onglets dans cet ordre : Paddock · Session · Bilan · Progression · Club.
 *   - Compte = icône haut-droite, JAMAIS un onglet (absent de TAB_ORDER).
 *   - L'or est interdit sur la nav (géré dans AppTabBar).
 * Dérivé de `02_AUDIT_ROUTES.md` (colonne « Zone cible »).
 */

export type Zone = 'paddock' | 'session' | 'bilan' | 'progression' | 'club' | 'compte';

/** Ordre exact des onglets. `compte` n'y est PAS (icône, pas un onglet). */
export const TAB_ORDER = ['paddock', 'session', 'bilan', 'progression', 'club'] as const;
export type TabZone = (typeof TAB_ORDER)[number];

/** Route racine atteinte au tap d'un onglet (groupe expo-router inclus). */
export const TAB_MAIN_ROUTE: Record<TabZone, string> = {
  paddock: '/(app)',
  session: '/(app)/session',
  bilan: '/(app)/bilan',
  progression: '/(app)/progression',
  club: '/(app)/club',
};

/**
 * Segment de route (sans groupe ni slash) → zone. Le segment '' correspond à
 * l'index (Paddock). Toute route de l'audit a une entrée ici (pas d'orpheline).
 */
export const ROUTE_TO_ZONE: Record<string, Zone> = {
  // Paddock
  '': 'paddock',
  index: 'paddock',
  paddock: 'paddock',
  'pass-oxv': 'paddock',
  // Session (flux de capture)
  session: 'session',
  equipement: 'session',
  placement: 'session',
  roulage: 'session',
  'entre-runs': 'session',
  'pilotage-fini': 'session',
  'bilan-pret': 'session',
  // Bilan + sous-vues Data Lab
  bilan: 'bilan',
  'data-lab': 'bilan',
  carte: 'bilan',
  virage: 'bilan',
  'virage-comparer': 'bilan',
  tours: 'bilan',
  heatmap: 'bilan',
  replay: 'bilan',
  telemetry: 'bilan',
  insights: 'bilan',
  insight: 'bilan',
  debrief: 'bilan',
  'debrief-presentiel': 'bilan',
  'prochaine-fois': 'bilan',
  circuits: 'bilan',
  circuit: 'bilan',
  partage: 'bilan',
  'carte-trophee': 'bilan',
  // Progression
  progression: 'progression',
  signature: 'progression',
  regularite: 'progression',
  comparateur: 'progression',
  stats: 'progression',
  objectifs: 'progression',
  carnet: 'progression',
  roulages: 'progression',
  // Club
  club: 'club',
  'mon-coach': 'club',
  coachs: 'club',
  coach: 'club',
  'mes-demandes': 'club',
  amis: 'club',
  // Territoire fusionné : `carte-oxv` est l'écran unique (carte + liste) ;
  // `social` / `social-carte` / `lieux` sont des coquilles <Redirect> vers lui
  // (zone 'club' conservée pour un surlignage correct sur deep-link/legacy).
  social: 'club',
  'social-carte': 'club',
  'carte-oxv': 'club',
  partenaires: 'club',
  lieux: 'club',
  'cote-a-cote': 'club',
  'belle-route': 'club',
  'mes-routes': 'club',
  'creer-trace': 'club',
  // Compte (icône, pas un onglet)
  compte: 'compte',
  profil: 'compte',
  settings: 'compte',
  garage: 'compte',
  support: 'compte',
  notifications: 'compte',
  'donnees-securite': 'compte',
  legal: 'compte',
};

/** Premier segment d'un pathname expo-router (sans groupe). '/virage' → 'virage'. */
function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

/** Zone d'une route, ou null si inconnue (écrans système/debug). */
export function zoneOfRoute(path: string): Zone | null {
  return ROUTE_TO_ZONE[firstSegment(path)] ?? null;
}

/** Écrans d'analyse détaillée rangés sous le Bilan (assemblés par le Data Lab). */
const DATA_LAB_SCREENS = [
  'carte',
  'virage',
  'virage-comparer',
  'tours',
  'heatmap',
  'replay',
  'telemetry',
  'insights',
] as const;

export function dataLabScreens(): readonly string[] {
  return DATA_LAB_SCREENS;
}

/**
 * Flux de capture immersif : la barre d'onglets s'efface (focalisation + amorce
 * du silence en piste).
 */
const CAPTURE_FLOW = new Set([
  'equipement',
  'placement',
  'roulage',
  'entre-runs',
  'pilotage-fini',
  'bilan-pret',
]);

/**
 * La barre d'onglets est-elle visible ? Masquée pendant le roulage (silence en
 * piste, doctrine) et sur les écrans du flux de capture.
 */
export function shouldShowTabBar(path: string, pilotState: string): boolean {
  if (pilotState === 'S6_roulage') return false;
  if (CAPTURE_FLOW.has(firstSegment(path))) return false;
  return true;
}
