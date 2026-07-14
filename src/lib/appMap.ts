/**
 * appMap — source unique de vérité de la navigation pilote.
 *
 * Mappe chaque route réelle de `app/(app)/*` vers une zone. La barre d'onglets, le
 * Paddock contextuel et le Data Lab lisent cette table — fini les menus improvisés.
 *
 * Nav = celle des MAQUETTES Claude Design refonte-v2 (§6 IA · décision fondateur
 * 2026-07-12, remplace l'ancienne nav OXV Platform) :
 *   - 5 onglets dans cet ordre : Miroir · Data Lab · Carnet · Découverte · Compte.
 *   - Miroir = la lecture de soi (Paddock, Bilan, Signature/QDI, Progression).
 *   - Data Lab = l'analyse (carte, virage, tours, heatmap, replay, télémétrie).
 *   - Carnet = espace perso (ressenti, conditions, repères/objectifs).
 *   - Découverte = marketplace / social (coachs, partenaires, roulages, mon coach).
 *   - Compte = réglages (profil, garage, boîtier, données, notifications, support).
 *   - Compte EST désormais le 5e onglet (dans les maquettes) — l'icône compte
 *     reste possible en en-tête, mais la nav de fond le porte.
 *   - L'or est interdit sur la nav (géré dans AppTabBar).
 */

export type Zone = 'miroir' | 'datalab' | 'carnet' | 'decouverte' | 'compte';

/** Ordre exact des onglets (maquettes refonte-v2 §5). */
export const TAB_ORDER = ['miroir', 'datalab', 'carnet', 'decouverte', 'compte'] as const;
export type TabZone = (typeof TAB_ORDER)[number];

/** Route racine atteinte au tap d'un onglet (groupe expo-router inclus). */
export const TAB_MAIN_ROUTE: Record<TabZone, string> = {
  miroir: '/(app)',
  datalab: '/(app)/data-lab',
  carnet: '/(app)/carnet',
  decouverte: '/(app)/coachs',
  compte: '/(app)/compte',
};

/**
 * Segment de route (sans groupe ni slash) → zone. Le segment '' correspond à
 * l'index (Paddock, home Miroir). Toute route a une entrée ici (pas d'orpheline).
 */
export const ROUTE_TO_ZONE: Record<string, Zone> = {
  // ── MIROIR — la lecture de soi
  '': 'miroir',
  index: 'miroir',
  paddock: 'miroir',
  'pass-oxv': 'miroir',
  bilan: 'miroir',
  trace: 'miroir',
  debrief: 'miroir',
  'debrief-presentiel': 'miroir',
  signature: 'miroir',
  regularite: 'miroir',
  progression: 'miroir',
  stats: 'miroir',
  comparateur: 'miroir',
  'empreinte-saison': 'miroir',
  passeport: 'miroir',
  'carte-licence': 'miroir',
  // Amorce/fin de séance (la barre s'efface pendant le flux, cf. CAPTURE_FLOW) —
  // rattachées au Miroir (le pipeline séance → bilan).
  session: 'miroir',
  roulage: 'miroir',
  'entre-runs': 'miroir',
  'pilotage-fini': 'miroir',
  // « Vos données sont en sécurité » (ex-route `donnees-securite`, réaffectée
  // à l'écran RGPD du Compte) : étape du flux capture, barre masquée.
  preservation: 'miroir',
  'bilan-pret': 'miroir',

  // ── DATA LAB — l'analyse
  'data-lab': 'datalab',
  'data-lab-canvas': 'datalab',
  conditions: 'datalab',
  carte: 'datalab',
  virage: 'datalab',
  'virage-comparer': 'datalab',
  tours: 'datalab',
  heatmap: 'datalab',
  replay: 'datalab',
  telemetry: 'datalab',
  insights: 'datalab',
  insight: 'datalab',

  // ── CARNET — espace perso (sans donnée ni couleur QDI)
  carnet: 'carnet',
  'prochaine-fois': 'carnet',
  objectifs: 'carnet',
  programme: 'carnet',

  // ── DÉCOUVERTE — marketplace / social
  club: 'decouverte',
  coachs: 'decouverte',
  coach: 'decouverte',
  'mon-coach': 'decouverte',
  'mes-demandes': 'decouverte',
  amis: 'decouverte',
  'cote-a-cote': 'decouverte',
  partenaires: 'decouverte',
  catalogue: 'decouverte',
  'carte-oxv': 'decouverte',
  'belle-route': 'decouverte',
  'mes-routes': 'decouverte',
  'creer-trace': 'decouverte',
  galerie: 'decouverte',
  roulages: 'decouverte',
  partage: 'decouverte',
  'carte-trophee': 'decouverte',

  // ── COMPTE — réglages (5e onglet dans les maquettes)
  compte: 'compte',
  profil: 'compte',
  settings: 'compte',
  'mon-equipement': 'compte',
  consentements: 'compte',
  garage: 'compte',
  support: 'compte',
  notifications: 'compte',
  'donnees-securite': 'compte',
  legal: 'compte',
  circuits: 'compte',
  circuit: 'compte',
  // Journée sur circuit (jour J) + amorce matériel — rattachées au Compte (§7.13).
  preparation: 'compte',
  equipement: 'compte',
  placement: 'compte',
};

/** Premier segment d'un pathname expo-router (sans groupe). '/virage' → 'virage'. */
function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

/** Zone d'une route, ou null si inconnue (écrans système/debug). */
export function zoneOfRoute(path: string): Zone | null {
  return ROUTE_TO_ZONE[firstSegment(path)] ?? null;
}

/** Écrans d'analyse détaillée rangés sous le Data Lab. */
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
  'preservation',
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
