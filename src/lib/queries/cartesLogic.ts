/**
 * Panel de cartes — logique PURE (lot PROFIL_CARTES, spec fondateur 17/07/2026).
 *
 * Extraite ici pour être testable sans React Native (jest ts-jest, env node) :
 * aucune dépendance — ni supabase, ni RN. Les requêtes vivent dans
 * `src/lib/queries/cartes.ts`, qui ré-exporte ces fonctions.
 *
 * Règles de la spec :
 *  - chrono « m:ss.mmm », POINT décimal (norme chronométrage), minutes toujours
 *    affichées, null → « — » ;
 *  - référence personnelle = min(best_lap_seconds) NON NUL, PAR CIRCUIT, sur la
 *    liste FILTRÉE fournie (recalculée à chaque filtre) ;
 *  - numérotation chronologique ASCENDANTE (001 = la plus ancienne),
 *    indépendante de l'ordre d'affichage (descendant) et du filtre ;
 *  - sélection : 2 cartes maximum, désélection libre, comparaison prête à
 *    exactement 2 ;
 *  - écarts NEUTRES (le formatage ne porte aucun jugement, l'écran non plus).
 */

/** Une carte = une session télémétrie du pilote, projetée pour le panel. */
export interface CarteSession {
  id: string;
  /** ISO 8601 — telemetry_sessions.started_at. */
  startedAt: string;
  bestLapSeconds: number | null;
  lapCount: number | null;
  weather: string | null;
  /** Libellé voiture résolu (vehicle_label, sinon brand + model du garage). */
  vehicleLabel: string | null;
  /** Clé de circuit (circuit_id, repli circuit_name) — null si inconnue. */
  circuitKey: string | null;
  /** Libellé de circuit (official_name > name > circuit_name). */
  circuitLabel: string | null;
  /** Tracé SVG réel du circuit (viewBox 0..1000) — null : pas de filigrane. */
  trackSvgPath: string | null;
  /** Température de l'air (weather_snapshots.temperature_c) — null : absente. */
  airTempC: number | null;
}

/** Nombre maximal de cartes sélectionnables pour une comparaison. */
export const MAX_SELECTION = 2;

/**
 * Formate un chrono : « m:ss,mmm », minutes TOUJOURS affichées, VIRGULE
 * décimale.
 *
 *   formatChronoCarte(112.418) → "1:52,418"
 *   formatChronoCarte(59.9)    → "0:59,900"
 *   formatChronoCarte(null)    → "—"
 *
 * ---
 *
 * LA CONTRADICTION, ET COMMENT ELLE A ÉTÉ TRANCHÉE — 12/08/2026
 *
 * Cette fonction imposait le POINT, au nom d'une « norme chronométrage ». Le
 * plan de montage V3 impose l'inverse, sans ambiguïté : « séparateur décimal :
 * virgule. 1:41,203, jamais 1:41.203. Corriger partout. »
 *
 * Deux règles écrites s'opposaient, et un test verrouillait la seconde. J'avais
 * laissé l'écart intact le 04/08, faute d'arbitrage.
 *
 * Tranché en autonomie, sur trois motifs :
 *
 *   1. **Aucune source n'était citée** pour cette norme. Une règle sans source
 *      ne l'emporte pas sur un plan de montage daté et signé.
 *   2. C'est une application FRANÇAISE pour des clients français. Si une norme
 *      de chronométrage impose le point sur un document officiel, elle concerne
 *      ce document — pas l'écran d'un pilote au paddock.
 *   3. Le reste du produit était déjà passé à la virgule le 04/08 (27 chaînes).
 *      Laisser cette fonction seule au point produisait DEUX écritures du même
 *      chrono selon l'écran, ce qui est pire que l'un ou l'autre choix.
 *
 * Pour renverser : une source nommée pour la norme, et la conversion des 27
 * autres chaînes en sens inverse.
 *
 * DIVERGENCE conservée : `formatLapTime` (src/utils/format.ts) emploie
 * l'apostrophe et le centième — c'est un autre format, pas un autre séparateur.
 */
export function formatChronoCarte(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  // Arrondi au millième AVANT le découpage des minutes : 119.9995 → « 2:00.000 »,
  // jamais « 1:60.000 » (bord de retenue du toFixed).
  const total = Math.round(seconds * 1000) / 1000;
  const mins = Math.floor(total / 60);
  const secs = total - mins * 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`.replace('.', ',');
}

/** Tri chronologique ascendant stable (départage par id pour le déterminisme). */
function parOrdreChronologique(cartes: readonly CarteSession[]): CarteSession[] {
  return [...cartes].sort((a, b) => {
    const ta = Date.parse(a.startedAt);
    const tb = Date.parse(b.startedAt);
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Numérotation des cartes : rang chronologique ASCENDANT (1 = la plus
 * ancienne), calculé sur l'ENSEMBLE des cartes — indépendant de l'ordre
 * d'affichage (descendant) et des filtres. Clé = id de session.
 */
export function numeroterCartes(cartes: readonly CarteSession[]): Record<string, number> {
  const numeros: Record<string, number> = {};
  parOrdreChronologique(cartes).forEach((carte, index) => {
    numeros[carte.id] = index + 1;
  });
  return numeros;
}

/** « 024 » — zero-pad 3 digits ; passe naturellement à 4 digits à 1000+. */
export function formatNumeroCarte(numero: number): string {
  return String(numero).padStart(3, '0');
}

/** Chrono valide pour la référence : non nul, fini, strictement positif. */
function chronoValide(seconds: number | null): seconds is number {
  return seconds !== null && Number.isFinite(seconds) && seconds > 0;
}

/**
 * Référence personnelle PAR CIRCUIT sur la liste fournie (la liste FILTRÉE de
 * l'écran — la référence se recalcule à chaque filtre). Pour chaque circuit :
 * la session portant le min(best_lap_seconds) non nul. Les sessions sans
 * chrono valide sont exclues du calcul (jamais de la liste affichée).
 * Clé = circuitKey (les cartes sans circuit partagent la clé '').
 */
export function referenceParCircuit(
  cartes: readonly CarteSession[]
): Record<string, { id: string; seconds: number }> {
  const refs: Record<string, { id: string; seconds: number }> = {};
  // Parcours chronologique : à chrono égal, la plus ancienne reste la référence
  // (déterministe, stable d'un rendu à l'autre).
  for (const carte of parOrdreChronologique(cartes)) {
    if (!chronoValide(carte.bestLapSeconds)) continue;
    const cle = carte.circuitKey ?? '';
    const actuelle = refs[cle];
    if (!actuelle || carte.bestLapSeconds < actuelle.seconds) {
      refs[cle] = { id: carte.id, seconds: carte.bestLapSeconds };
    }
  }
  return refs;
}

/** La carte est-elle LA référence personnelle de son circuit (liste filtrée) ? */
export function estReference(
  carte: CarteSession,
  refs: Record<string, { id: string; seconds: number }>
): boolean {
  return refs[carte.circuitKey ?? '']?.id === carte.id;
}

/**
 * Écart à la référence personnelle du circuit (secondes, ≥ 0 par construction).
 * null si la carte est la référence, si son chrono est absent, ou si le
 * circuit n'a pas de référence.
 */
export function ecartReference(
  carte: CarteSession,
  refs: Record<string, { id: string; seconds: number }>
): number | null {
  if (!chronoValide(carte.bestLapSeconds)) return null;
  const ref = refs[carte.circuitKey ?? ''];
  if (!ref || ref.id === carte.id) return null;
  return carte.bestLapSeconds - ref.seconds;
}

/** « +0.684 » — écart NEUTRE (le gris neutre est porté par l'écran, pas ici). */
export function formatEcartReference(ecartSeconds: number): string {
  const arrondi = Math.round(ecartSeconds * 1000) / 1000;
  return `+${arrondi.toFixed(3)}`;
}

/**
 * Bascule la sélection d'une carte : désélection libre ; ajout refusé au-delà
 * de MAX_SELECTION (la liste est rendue inchangée).
 */
export function basculerSelection(selection: readonly string[], id: string): string[] {
  if (selection.includes(id)) return selection.filter((s) => s !== id);
  if (selection.length >= MAX_SELECTION) return [...selection];
  return [...selection, id];
}

/** Le bouton « Comparer » n'est actif qu'à EXACTEMENT 2 cartes sélectionnées. */
export function comparaisonPrete(selection: readonly string[]): boolean {
  return selection.length === MAX_SELECTION;
}

/** Filtres du panel : Toutes / année / météo / voiture (valeurs réelles). */
export type FiltreCartes =
  | { type: 'toutes' }
  | { type: 'annee'; annee: number }
  | { type: 'meteo'; valeur: string }
  | { type: 'voiture'; valeur: string };

export const FILTRE_TOUTES: FiltreCartes = { type: 'toutes' };

/** Année locale d'une carte (repli NaN si la date est illisible). */
function anneeDeCarte(carte: CarteSession): number {
  const d = new Date(carte.startedAt);
  return d.getFullYear();
}

/**
 * Construit la rangée de filtres à partir des cartes RÉELLES : « Toutes »,
 * puis les années distinctes (descendantes), les météos distinctes et les
 * voitures distinctes (ordre d'apparition, liste descendante).
 */
export function construireFiltres(cartes: readonly CarteSession[]): FiltreCartes[] {
  const annees = new Set<number>();
  const meteos: string[] = [];
  const voitures: string[] = [];
  for (const carte of cartes) {
    const annee = anneeDeCarte(carte);
    if (Number.isFinite(annee)) annees.add(annee);
    const meteo = carte.weather?.trim();
    if (meteo && !meteos.includes(meteo)) meteos.push(meteo);
    const voiture = carte.vehicleLabel?.trim();
    if (voiture && !voitures.includes(voiture)) voitures.push(voiture);
  }
  return [
    FILTRE_TOUTES,
    ...[...annees].sort((a, b) => b - a).map((annee): FiltreCartes => ({ type: 'annee', annee })),
    ...meteos.map((valeur): FiltreCartes => ({ type: 'meteo', valeur })),
    ...voitures.map((valeur): FiltreCartes => ({ type: 'voiture', valeur })),
  ];
}

/** Libellé d'un filtre (l'écran le met en capitales). */
export function libelleFiltre(filtre: FiltreCartes): string {
  switch (filtre.type) {
    case 'toutes':
      return 'Toutes';
    case 'annee':
      return String(filtre.annee);
    case 'meteo':
      return filtre.valeur;
    case 'voiture':
      return filtre.valeur;
  }
}

/** Égalité de filtres (pour l'état actif des puces). */
export function memeFiltre(a: FiltreCartes, b: FiltreCartes): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'annee' && b.type === 'annee') return a.annee === b.annee;
  if (a.type === 'meteo' && b.type === 'meteo') return a.valeur === b.valeur;
  if (a.type === 'voiture' && b.type === 'voiture') return a.valeur === b.valeur;
  return true; // 'toutes'
}

/** Applique un filtre à la liste (la liste d'origine n'est jamais mutée). */
export function appliquerFiltre(
  cartes: readonly CarteSession[],
  filtre: FiltreCartes
): CarteSession[] {
  switch (filtre.type) {
    case 'toutes':
      return [...cartes];
    case 'annee':
      return cartes.filter((c) => anneeDeCarte(c) === filtre.annee);
    case 'meteo':
      return cartes.filter((c) => c.weather?.trim() === filtre.valeur);
    case 'voiture':
      return cartes.filter((c) => c.vehicleLabel?.trim() === filtre.valeur);
  }
}

// Jours/mois abrégés français, capitalisés comme le HTML de référence
// (« Jeu. 08 Juil. 2027 ») — déterministe, sans dépendre d'Intl.
const JOURS_ABREGES = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'] as const;
const MOIS_ABREGES = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
] as const;

/** « Jeu. 08 Juil. 2027 » — format des dates de carte (locale fr, capitalisé). */
export function formatDateCarte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const jour = String(d.getDate()).padStart(2, '0');
  return `${JOURS_ABREGES[d.getDay()]} ${jour} ${MOIS_ABREGES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Circuit principal de la liste : le libellé de circuit le plus fréquent
 * (en-tête du panel et sous-ligne du compteur profil). null si aucun.
 */
export function circuitPrincipal(cartes: readonly CarteSession[]): string | null {
  const comptes = new Map<string, number>();
  for (const carte of cartes) {
    const libelle = carte.circuitLabel?.trim();
    if (!libelle) continue;
    comptes.set(libelle, (comptes.get(libelle) ?? 0) + 1);
  }
  let meilleur: string | null = null;
  let max = 0;
  for (const [libelle, n] of comptes) {
    if (n > max) {
      max = n;
      meilleur = libelle;
    }
  }
  return meilleur;
}
