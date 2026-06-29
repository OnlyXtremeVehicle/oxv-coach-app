/**
 * proNav — navigation de l'espace Pilote Pro (PR-78).
 *
 * Barre d'onglets SÉPARÉE de la nav pilote (`appMap.ts`) : l'espace `/(pro)` a son
 * propre jeu d'onglets (Paddock · Performance · Média · Équipe · Partage) sans
 * toucher au contrat des 5 zones pilote. Mêmes invariants canon :
 *   - Compte = icône haut-droite, JAMAIS un onglet (absent de PRO_TAB_ORDER).
 *   - L'or est interdit sur la nav (géré dans ProTabBar).
 * Le test `proNav.test.ts` garantit la cohérence onglets ↔ routes réelles de `(pro)`.
 */

export type ProZone =
  | 'pro-paddock'
  | 'pro-performance'
  | 'pro-media'
  | 'pro-equipe'
  | 'pro-partage';

/** Ordre exact des onglets pro. */
export const PRO_TAB_ORDER = [
  'pro-paddock',
  'pro-performance',
  'pro-media',
  'pro-equipe',
  'pro-partage',
] as const;
export type ProTabZone = (typeof PRO_TAB_ORDER)[number];

/** Route racine atteinte au tap d'un onglet (groupe expo-router inclus). */
export const PRO_TAB_MAIN_ROUTE: Record<ProTabZone, string> = {
  'pro-paddock': '/(pro)',
  'pro-performance': '/(pro)/performance',
  'pro-media': '/(pro)/media',
  'pro-equipe': '/(pro)/equipe',
  'pro-partage': '/(pro)/partage',
};

export const PRO_TAB_LABEL: Record<ProTabZone, string> = {
  'pro-paddock': 'PADDOCK',
  'pro-performance': 'PERFORMANCE',
  'pro-media': 'MÉDIA',
  'pro-equipe': 'ÉQUIPE',
  'pro-partage': 'PARTAGE',
};

/**
 * Segment de route (sans groupe ni slash) → zone pro. Le segment '' correspond à
 * l'index (Paddock Pro). Toute route de `(pro)` a une entrée ici.
 */
export const PRO_ROUTE_TO_ZONE: Record<string, ProTabZone> = {
  '': 'pro-paddock',
  index: 'pro-paddock',
  // Sous-ecran du Paddock pro (candidature ambassadeur).
  ambassadeur: 'pro-paddock',
  performance: 'pro-performance',
  // Sous-écran de Performance (recherche de séances) — surligne l'onglet Performance.
  bibliotheque: 'pro-performance',
  media: 'pro-media',
  equipe: 'pro-equipe',
  partage: 'pro-partage',
};

/** Premier segment d'un pathname expo-router (sans groupe). '/media' → 'media'. */
function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

/** Zone pro d'une route, ou null si inconnue (écran hors onglets). */
export function proZoneOfRoute(path: string): ProZone | null {
  return PRO_ROUTE_TO_ZONE[firstSegment(path)] ?? null;
}

/**
 * La barre d'onglets pro est-elle visible ? Affichée sur les racines d'onglet
 * uniquement (les écrans hors onglet n'affichent pas la barre).
 */
export function shouldShowProTabBar(path: string): boolean {
  return proZoneOfRoute(path) != null;
}
