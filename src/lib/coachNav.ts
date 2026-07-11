/**
 * coachNav — navigation de l'espace COACH (refonte V3, cadrage COACH §1).
 *
 * Barre d'onglets 5 zones du compagnon téléphone (handoff OXV Coach Mobile),
 * SÉPARÉE de la nav pilote (`appMap.ts`) et pro (`proNav.ts`) : **En direct ·
 * Pilotes · Messages · Agenda · Moi**. Invariants canon :
 *   - Actif = rouge doux coach `#E2685A` (identité coach, JAMAIS le blanc pilote).
 *   - **Aucun or sur la nav** (géré dans CoachTabBar).
 *   - Les 31 écrans coach existants se rangent sous ces 5 onglets, sans move de
 *     fichier : la barre est un overlay additif au-dessus du Stack.
 * `coachNav.test.ts` garantit la cohérence onglets ↔ routes réelles de `(coach)`.
 */

export type CoachZone = 'live' | 'pilotes' | 'messages' | 'agenda' | 'moi';

/** Ordre exact des onglets coach. */
export const COACH_TAB_ORDER = ['live', 'pilotes', 'messages', 'agenda', 'moi'] as const;
export type CoachTabZone = (typeof COACH_TAB_ORDER)[number];

export const COACH_TAB_LABEL: Record<CoachTabZone, string> = {
  live: 'EN DIRECT',
  pilotes: 'PILOTES',
  messages: 'MESSAGES',
  agenda: 'AGENDA',
  moi: 'MOI',
};

/** Route racine atteinte au tap d'un onglet (groupe expo-router inclus). */
export const COACH_TAB_MAIN_ROUTE: Record<CoachTabZone, string> = {
  live: '/(coach)/en-direct',
  pilotes: '/(coach)',
  messages: '/(coach)/messages',
  agenda: '/(coach)/calendrier',
  moi: '/(coach)/profil',
};

/**
 * Segment de route (sans groupe ni slash) → zone. '' = index (Poste, sous
 * Pilotes). Toute route de `(coach)` a une entrée ici (vérifié par le test).
 */
export const COACH_ROUTE_TO_ZONE: Record<string, CoachTabZone> = {
  '': 'pilotes',
  index: 'pilotes',
  // En direct
  'en-direct': 'live',
  // Pilotes (lecture, guidance, CRM lecture)
  pilote: 'pilotes',
  studio: 'pilotes',
  triage: 'pilotes',
  debrief: 'pilotes',
  'file-lecture': 'pilotes',
  lecture: 'pilotes',
  annoter: 'pilotes',
  priorites: 'pilotes',
  rapport: 'pilotes',
  gabarits: 'pilotes',
  assistant: 'pilotes',
  contexte: 'pilotes',
  plan: 'pilotes',
  cycles: 'pilotes',
  reperes: 'pilotes',
  repere: 'pilotes',
  comparer: 'pilotes',
  'comparer-pilotes': 'pilotes',
  // Messages
  messages: 'messages',
  // Agenda (planning, dispos, demandes, roulages)
  calendrier: 'agenda',
  disponibilites: 'agenda',
  demandes: 'agenda',
  roulages: 'agenda',
  // Moi (compte pro)
  profil: 'moi',
  business: 'moi',
  facturation: 'moi',
  'facturation-identite': 'moi',
  'facture-nouvelle': 'moi',
  ar: 'moi',
};

/** Premier segment d'un pathname expo-router (sans groupe). '/studio' → 'studio'. */
function firstSegment(path: string): string {
  return path.replace(/^\/+/, '').split('/')[0] ?? '';
}

/** Zone coach d'une route, ou null si inconnue (écran hors onglets). */
export function coachZoneOfRoute(path: string): CoachZone | null {
  return COACH_ROUTE_TO_ZONE[firstSegment(path)] ?? null;
}

/** La barre coach est-elle visible ? Sur toute route mappée (jamais un +not-found). */
export function shouldShowCoachTabBar(path: string): boolean {
  return coachZoneOfRoute(path) != null;
}
