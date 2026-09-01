/**
 * Virages exploitables d'un CIRCUIT — socle des repères de virage multi-circuit
 * (demande fondateur build 23 : « choisir le circuit avant, page personnalisée
 * selon le circuit — 14 virages ou 7 »).
 *
 * Deux sources, JAMAIS un virage inventé :
 *   - Haute Saintonge (tracé Beltoise) : la topologie NOMMÉE existante
 *     (BELTOISE_CORNERS — 7 virages, noms officiels proposés) ;
 *   - tout autre circuit : virages DÉRIVÉS du tracé réel stocké en base
 *     (circuits.centerline_latlon) par la détection de courbure du
 *     circuitGenerator (port fidèle du module de référence). Libellés
 *     factuels « Virage N (gauche/droite) » ;
 *   - pas de centerline → [] : l'écran affiche un EmptyState honnête.
 *
 * Paramétrage de la dérivation : smoothWin = 0 (aucun lissage). Les
 * centerlines en base viennent d'OSM (tracés propres) ; le lissage par défaut
 * (fenêtre 1) fusionne les enchaînements serrés. Mesuré sur Ricardo Tormo
 * (Valence) : 12 virages avec lissage, 14 sans — pour 14 virages réels du
 * circuit (9 gauches, 5 droites). Vérifié par test sur la fixture
 * src/circuit/data/ricardo-tormo.geojson (même géométrie que la base).
 */

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import type { VirageCircuit } from '@/features/data/viragesCircuit';

import {
  type CornerDirection,
  type LatLon,
  PARAMS_CENTERLINE,
  generateCircuit,
  unprojectFromMeters,
} from './circuitGenerator';

/** Un virage listable d'un circuit (repères coach, écrans par circuit). */
export interface CircuitCorner {
  /** Numéro de virage, 1-based, stable pour un tracé donné. */
  index: number;
  /** « Saintonge 1 » (topologie nommée) ou « Virage 3 (gauche) » (dérivé). */
  name: string;
  /** Sens du virage — 'unknown' pour la topologie nommée (non renseigné). */
  direction: CornerDirection;
  /** Profil nommé Haute Saintonge — null pour un virage dérivé. */
  pace: 'fast' | 'medium' | 'slow' | null;
  /** Rayon estimé (m) depuis la géométrie réelle — null pour la topologie nommée. */
  radiusM: number | null;
}

/** Référence minimale d'un circuit (id + nom) — découple du service Supabase. */
export interface CircuitRef {
  id: string;
  name: string;
}

/** Normalisation d'un nom de circuit : minuscules, sans diacritiques. */
function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Vrai si le circuit est Haute Saintonge (variantes comprises, ex. « BACKUP ») :
 * même tracé physique → même topologie nommée.
 */
export function isHauteSaintonge(circuit: Pick<CircuitRef, 'name'>): boolean {
  return normalizeName(circuit.name).includes('haute saintonge');
}

/** Les 7 virages nommés du tracé Beltoise, au format commun CircuitCorner. */
export function hauteSaintongeCorners(): CircuitCorner[] {
  return BELTOISE_CORNERS.map((c) => ({
    index: c.index,
    name: c.name,
    direction: 'unknown' as const,
    pace: c.pace,
    radiusM: null,
  }));
}

/**
 * Dérive les virages d'un tracé réel (liste de points lat/lon) via la
 * détection de courbure existante. Pur et déterministe : testé sur la
 * fixture Ricardo Tormo. Tracé dégénéré (< 4 points) → [].
 *
 * Le réglage vient de `circuitGenerator.ts` et n'est PAS redéfini ici : la
 * fonction serveur `detect-circuit-corners` lit le même, afin que l'écran du
 * coach et la base ne comptent jamais deux nombres de virages différents pour
 * le même circuit.
 */
export function deriveCornersFromCenterline(points: readonly LatLon[]): CircuitCorner[] {
  if (points.length < 4) return [];
  const circuit = generateCircuit([...points], PARAMS_CENTERLINE);
  return circuit.corners.map((c) => ({
    index: c.index,
    name:
      c.direction === 'unknown'
        ? `Virage ${c.index}`
        : `Virage ${c.index} (${c.direction === 'left' ? 'gauche' : 'droite'})`,
    direction: c.direction,
    pace: null,
    radiusM: Number.isFinite(c.radius_m) ? c.radius_m : null,
  }));
}

/**
 * Les virages d'un circuit donné, DANS L'ORDRE DE PRÉFÉRENCE DES SOURCES :
 *
 *   1. Haute Saintonge → sa topologie nommée (7 virages).
 *   2. `circuits.corners` → ce que le DÉTECTEUR a écrit en base.
 *   3. la centerline → dérivation à la volée, comme avant.
 *   4. rien → `[]`, et l'appelant affiche un état honnête.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI LA BASE PASSE AVANT LE CALCUL — 01/09/2026
 * ---------------------------------------------------------------------------
 *
 * `circuits.corners` est écrite depuis le 30/08 par `detect-circuit-corners` :
 * douze virages à Bouteville, neuf au Bugatti, huit à Albi, chacun avec son
 * sens et son rayon. Cette fonction ne la lisait pas — elle refaisait la
 * détection à CHAQUE ouverture d'écran, sur la centerline.
 *
 * Deux ennuis, dont un seul se voit. Le premier est le coût : `generateCircuit`
 * tourne sur cinq cent quatre-vingt-neuf points au Bugatti, pour retrouver ce
 * que la base porte déjà. Le second est plus grave — deux détections lancées à
 * deux moments avec deux versions du détecteur ne rendent pas forcément le même
 * découpage, et l'écran des repères numéroterait alors les virages autrement
 * que le bilan, le ruban ou les notes du coach. Un repère posé sur « le virage
 * 7 » désignerait deux endroits.
 *
 * La base est la source d'un numéro de virage. Le calcul reste le repli.
 *
 * `fetchCenterline` est injectable pour les tests purs ; par défaut, lecture
 * réelle via circuitsService (import paresseux : le service tire supabase et
 * mmkv, indésirables dans l'environnement Jest node).
 */
export async function cornersForCircuit(
  circuit: CircuitRef,
  fetchCenterline?: (circuitId: string) => Promise<LatLon[] | null>,
  fetchVirages?: (circuitId: string) => Promise<VirageCircuit[]>
): Promise<CircuitCorner[]> {
  if (isHauteSaintonge(circuit)) return hauteSaintongeCorners();

  const service = () =>
    require('@/services/circuitsService') as typeof import('@/services/circuitsService');

  // Le `try` couvre la lecture ET le require paresseux : dans un environnement
  // sans Supabase — les tests purs — l'import lui-même lève. Un repli sur la
  // centerline est alors le bon comportement, pas une erreur à propager.
  let enBase: VirageCircuit[] = [];
  try {
    const lireVirages = fetchVirages ?? ((id: string) => service().fetchCircuitCorners(id));
    enBase = await lireVirages(circuit.id);
  } catch {
    enBase = [];
  }
  if (enBase.length > 0) return enBase.map(depuisVirageCircuit);

  const fetcher = fetchCenterline ?? service().fetchCircuitCenterline;
  const points = await fetcher(circuit.id);
  if (!points || points.length === 0) return [];
  return deriveCornersFromCenterline(points);
}

/**
 * Un virage de la base, dans la forme que les écrans attendent.
 *
 * `pace` reste `null` : c'est un profil ÉDITORIAL de Haute Saintonge, que le
 * détecteur ne produit pas et qu'on n'invente pas. Le nom suit la même règle
 * que partout — celui de la base, ou « Virage N » avec son sens quand la base
 * le donne.
 */
function depuisVirageCircuit(v: VirageCircuit): CircuitCorner {
  const sens = v.sens === 'gauche' ? 'left' : v.sens === 'droite' ? 'right' : 'unknown';
  return {
    index: v.index,
    name:
      v.nom ??
      (sens === 'unknown' ? `Virage ${v.index}` : `Virage ${v.index} (${v.sens as string})`),
    direction: sens,
    pace: null,
    radiusM: v.rayonM,
  };
}

// ---------------------------------------------------------------------------
// LES CORDES — coordonnées réelles, pour résoudre un marqueur en virage
// ---------------------------------------------------------------------------

/**
 * Une corde de virage, avec sa position réelle.
 *
 * ===========================================================================
 * POURQUOI CE BLOC EXISTE
 * ===========================================================================
 *
 * `resoudreMarqueur` (src/telemetry/marqueur.ts) accepte depuis toujours un
 * quatrième argument `cordes`. **Ses deux appelants de production lui
 * passaient un tableau vide** — `filSeanceService.ts:421` et
 * `marqueursSeanceService.ts:110`. Conséquence : `cordeLaPlusProche` itérait
 * sur rien, et `virage` comme `distanceAvantCordeM` valaient TOUJOURS `null`.
 *
 * Le plan V3 en fait pourtant un critère d'acceptation du jalon 6 : *« un
 * marqueur posé se résout-il correctement en tour, VIRAGE et mesures ? »*. Le
 * calcul était juste, complet, testé — et n'a jamais reçu de quoi travailler.
 *
 * Un commentaire de `marqueursSeanceService.ts` affirmait : *« Aucune corde de
 * référence n'existe encore. »* C'était vrai le jour où il a été écrit. Les
 * sept cordes de Haute Saintonge portent depuis des coordonnées GPS relevées
 * sur OSM (way 54412766), et les autres circuits ont leur centerline en base.
 *
 * ===========================================================================
 * DEUX SOURCES, ET AUCUNE N'EST DEVINÉE
 * ===========================================================================
 *
 * Haute Saintonge : `BELTOISE_CORNERS[].apexLat/apexLon`, des relevés, pas des
 * dérivations. On ne recalcule pas ce qui a été mesuré.
 *
 * Les autres : la détection de courbure sur la centerline, puis l'INVERSE de
 * la projection pour revenir en lat/lon. La détection travaille en mètres, la
 * résolution d'un marqueur en degrés — le passage est exact, la projection
 * étant équirectangulaire.
 *
 * **La dette D-43 n'est PAS touchée ici.** Elle porte sur des apex exprimés en
 * fraction d'INDICE de polyline puis lus en fraction de DISTANCE. Ce bloc
 * n'emploie aucune fraction : il rend des coordonnées, et `cordeLaPlusProche`
 * les compare par distance haversine.
 */
export interface CordeCirconstanciee {
  numero: number;
  lat: number;
  lon: number;
}

/** Les cordes de Haute Saintonge — relevés GPS, sept virages nommés. */
export function hauteSaintongeCordes(): CordeCirconstanciee[] {
  return BELTOISE_CORNERS.map((c) => ({
    numero: c.index,
    lat: c.apexLat,
    lon: c.apexLon,
  }));
}

/**
 * Les cordes dérivées d'une centerline réelle.
 *
 * Tracé trop court pour porter un virage → `[]`, et l'appelant affichera
 * `virage: null`. Une corde inventée serait pire qu'une absence : elle
 * situerait le geste du coach à un endroit où le pilote n'est jamais passé.
 */
export function cordesDepuisCenterline(points: readonly LatLon[]): CordeCirconstanciee[] {
  if (points.length < 4) return [];
  const brut = [...points];
  const circuit = generateCircuit(brut, PARAMS_CENTERLINE);
  const apex = circuit.corners.map((c) => circuit.centerline[c.apexIdx]).filter((p) => p != null);
  if (apex.length === 0) return [];
  const enDegres = unprojectFromMeters(apex, brut[0]);
  return enDegres.map((p, i) => ({
    numero: circuit.corners[i].index,
    lat: p.lat,
    lon: p.lon,
  }));
}

/**
 * Les cordes d'un circuit donné, prêtes pour `resoudreMarqueur`.
 *
 * Même contrat que `cornersForCircuit` : `fetchCenterline` injectable pour les
 * tests purs, lecture réelle sinon. Circuit sans centerline → `[]`.
 */
export async function cordesForCircuit(
  circuit: CircuitRef,
  fetchCenterline?: (circuitId: string) => Promise<LatLon[] | null>
): Promise<CordeCirconstanciee[]> {
  if (isHauteSaintonge(circuit)) return hauteSaintongeCordes();

  const fetcher =
    fetchCenterline ??
    (require('@/services/circuitsService') as typeof import('@/services/circuitsService'))
      .fetchCircuitCenterline;

  const points = await fetcher(circuit.id);
  if (!points || points.length === 0) return [];
  return cordesDepuisCenterline(points);
}
