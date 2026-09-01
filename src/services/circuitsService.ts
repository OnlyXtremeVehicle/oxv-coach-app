/**
 * Service circuits — lit la table `circuits` Supabase avec cache MMKV.
 *
 * Pattern : cache-first avec TTL 24h (les circuits évoluent rarement),
 * fallback en cache stale si Supabase répond avec erreur.
 *
 * En sem. 5, utilisé par l'écran #20 (greeting + référence circuit) et
 * par lapDetectionRunner (finish line dynamique). En sem. 6, utilisé
 * par #14 (Carte du circuit) pour récupérer le SVG du tracé.
 */

import { cacheGet, cacheGetStale, cacheSet, STORAGE_KEYS } from '@/lib/mmkv';
import { supabase } from '@/lib/supabase';
import { lireViragesCircuit, type VirageCircuit } from '@/features/data/viragesCircuit';
import type { LatLon } from '@/circuit/circuitGenerator';

export interface Circuit {
  id: string;
  name: string;
  isOfficial: boolean;
  isDefault: boolean;
  finishLineLat: number;
  finishLineLon: number;
  finishLineRadiusM: number;
  finishLineHeading: number | null;
  lengthKm: number | null;
  turnsCount: number | null;
  trackSvgPath: string | null;
  bboxMinLat: number | null;
  bboxMaxLat: number | null;
  bboxMinLon: number | null;
  bboxMaxLon: number | null;
}

const CIRCUITS_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

export async function fetchCircuits(forceRefresh = false): Promise<Circuit[]> {
  if (!forceRefresh) {
    const cached = cacheGet<Circuit[]>(STORAGE_KEYS.CIRCUITS);
    if (cached) return cached;
  }

  const { data, error } = await supabase
    .from('circuits')
    .select(
      'id, name, is_official, is_default, finish_line_lat, finish_line_lon, finish_line_radius_m, finish_line_heading, length_km, turns_count, track_svg_path, bbox_min_lat, bbox_max_lat, bbox_min_lon, bbox_max_lon'
    )
    .order('is_official', { ascending: false })
    .order('name');

  if (error) {
    // `cacheGetStale` et non `cacheGet` : le repli n'a de sens QUE périmé.
    // `cacheGet` rendait `null` passé le TTL — et, jusqu'au 13/08/2026, il
    // EFFAÇAIT même l'entrée. Le « repli sur cache stale » annoncé ici
    // n'existait donc pas : au circuit, une lecture ratée rendait une liste
    // vide, et il n'y avait plus aucun circuit à armer.
    console.warn(
      '[OXV] fetchCircuits erreur, repli sur le cache (périmé accepté) :',
      error.message
    );
    return cacheGetStale<Circuit[]>(STORAGE_KEYS.CIRCUITS) ?? [];
  }

  const circuits: Circuit[] = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? '',
    isOfficial: row.is_official ?? false,
    isDefault: row.is_default ?? false,
    finishLineLat: Number(row.finish_line_lat ?? 0),
    finishLineLon: Number(row.finish_line_lon ?? 0),
    finishLineRadiusM: Number(row.finish_line_radius_m ?? 30),
    finishLineHeading: row.finish_line_heading !== null ? Number(row.finish_line_heading) : null,
    lengthKm: row.length_km !== null ? Number(row.length_km) : null,
    turnsCount: row.turns_count ?? null,
    trackSvgPath: row.track_svg_path ?? null,
    bboxMinLat: row.bbox_min_lat !== null ? Number(row.bbox_min_lat) : null,
    bboxMaxLat: row.bbox_max_lat !== null ? Number(row.bbox_max_lat) : null,
    bboxMinLon: row.bbox_min_lon !== null ? Number(row.bbox_min_lon) : null,
    bboxMaxLon: row.bbox_max_lon !== null ? Number(row.bbox_max_lon) : null,
  }));

  // ON NE MET JAMAIS UNE LISTE VIDE EN CACHE, ET SURTOUT PAS POUR 24 HEURES.
  //
  // La policy `SELECT` de `circuits` est `TO authenticated`. Une requête émise
  // avant la connexion — et il en part une, `initGeolocation()` au montage de
  // la racine — ne reçoit PAS d'erreur : PostgREST rend 200 avec zéro ligne,
  // la RLS ayant simplement filtré à vide. Vérifié en sondant la base avec la
  // clé anonyme le 03/08/2026.
  //
  // On tombait donc ici avec `circuits = []`, on l'écrivait pour 24 h, et
  // `if (cached) return cached` le resservait ensuite au pilote CONNECTÉ —
  // `[]` étant truthy. Pendant une journée : aucun circuit sélectionnable à
  // l'armement d'une capture, carte du territoire vide, météo du circuit
  // perdue, `getDefaultCircuit()` nul partout. Aucun purgeur ne rattrapait le
  // coup : `cacheClearReadCache` et `cacheClearAll` n'ont aucun appelant.
  //
  // Un vide est presque toujours un vide d'accès, pas un vide de vérité. Le
  // coût de ne pas le mettre en cache est une requête de plus ; le coût de
  // l'inverse est le cœur du produit muet pour la journée.
  if (circuits.length > 0) {
    cacheSet(STORAGE_KEYS.CIRCUITS, circuits, CIRCUITS_CACHE_TTL_MS);
  }
  return circuits;
}

/**
 * Renvoie le circuit officiel principal (Haute Saintonge, sans suffixe "BACKUP").
 * Utilisé comme circuit par défaut en V1.
 */
export async function getDefaultCircuit(): Promise<Circuit | null> {
  const all = await fetchCircuits();
  return (
    // Le circuit explicitement marqué par défaut prime (sinon l'ajout d'un
    // circuit officiel trié avant « Haute Saintonge » détournerait le défaut).
    all.find((c) => c.isOfficial && c.isDefault) ??
    all.find((c) => c.isOfficial && !c.name.toUpperCase().includes('BACKUP')) ??
    all.find((c) => c.isOfficial) ??
    all[0] ??
    null
  );
}

/**
 * Parse la colonne jsonb `circuits.centerline_latlon` (forme attendue : [{lat,lon}]).
 * Filtre les entrées invalides. Renvoie null si dégénéré (< 4 points exploitables).
 */
function parseCenterline(raw: unknown): LatLon[] | null {
  if (!Array.isArray(raw)) return null;
  const pts: LatLon[] = [];
  for (const entry of raw) {
    const o = entry as { lat?: unknown; lon?: unknown };
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) pts.push({ lat, lon });
  }
  return pts.length > 3 ? pts : null;
}

/**
 * Clé de cache d'une géométrie. Une par circuit : les tracés sont indépendants,
 * et en mettre plusieurs sous une même clé ferait perdre les autres à chaque
 * changement de circuit.
 */
function cleCenterline(circuitId: string): string {
  return `${STORAGE_KEYS.CIRCUITS}:centerline:${circuitId}`;
}

/**
 * Durée de fraîcheur d'une géométrie. Sept jours, contre 24 h pour la liste :
 * un tracé ne bouge pas. Il n'a changé qu'une fois dans l'histoire du dépôt, et
 * c'était pour en gagner en précision.
 */
const CENTERLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Lit la géométrie centerline (points lat/lon) d'un circuit, pour le ruban 3D.
 *
 * CACHE-FIRST depuis le 13/08/2026 (7 jours), avec repli sur le cache PÉRIMÉ
 * quand la lecture échoue : hors-ligne, le tracé est la seule vérification
 * visuelle du pilote avant de rouler.
 *
 * La colonne `circuits.centerline_latlon` est absente des types générés
 * (database.types antérieur à son ajout), d'où l'accès non typé localisé ici.
 * Renvoie null si la colonne est absente, illisible, et qu'aucun cache
 * n'existe : l'appelant retombe alors sur sa géométrie de repli (aucun écran
 * vide, aucune donnée inventée).
 */
export async function fetchCircuitCenterline(circuitId: string): Promise<LatLon[] | null> {
  const cle = cleCenterline(circuitId);
  const frais = cacheGet<LatLon[]>(cle);
  if (frais !== null && frais.length > 3) return frais;

  // Colonne centerline_latlon absente des types générés : accès non typé localisé.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('circuits') as any;
  const { data, error } = await table.select('centerline_latlon').eq('id', circuitId).maybeSingle();

  /**
   * LE TRACÉ N'ÉTAIT PAS CACHÉ DU TOUT — posé le 13/08/2026.
   *
   * Hors-ligne, cette lecture rendait `null`, et l'écran d'armement affichait
   * son repli sobre : une icône et un nom. Or le tracé avec sa ligne d'arrivée
   * est la SEULE vérification visuelle dont dispose le pilote avant de rouler —
   * celle qui lui aurait montré, la nuit du 13/08, qu'il s'apprêtait à partir
   * sur la silhouette de Haute Saintonge.
   *
   * Un tracé d'il y a une semaine vaut mieux qu'aucun tracé : la géométrie d'un
   * circuit ne change pas d'un jour à l'autre.
   */
  if (error || !data?.centerline_latlon) {
    return cacheGetStale<LatLon[]>(cle);
  }
  const points = parseCenterline(data.centerline_latlon);
  // On ne met JAMAIS un vide en cache — même raisonnement que pour la liste :
  // un vide est presque toujours un vide d'accès, pas un vide de vérité.
  if (points !== null) cacheSet(cle, points, CENTERLINE_TTL_MS);
  return points;
}

/** Centerline du circuit officiel par défaut (Haute Saintonge en V1). */
export async function fetchDefaultCircuitCenterline(): Promise<LatLon[] | null> {
  const def = await getDefaultCircuit();
  if (!def) return null;
  return fetchCircuitCenterline(def.id);
}

/**
 * Centerline du circuit d'une SESSION : lit `telemetry_sessions.circuit_id`
 * et charge la géométrie de CE circuit. Si la session n'a aucun circuit
 * rattaché (cas courant tant que la capture Valence n'a pas tourné), ou si
 * sa géométrie est illisible, on retombe sur le circuit officiel par défaut.
 * Jamais d'écran vide, jamais de donnée inventée.
 */
export async function fetchSessionCircuitCenterline(sessionId: string): Promise<LatLon[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('telemetry_sessions') as any;
  const { data, error } = await table.select('circuit_id').eq('id', sessionId).maybeSingle();

  const circuitId = !error && data?.circuit_id ? (data.circuit_id as string) : null;
  if (circuitId) {
    const points = await fetchCircuitCenterline(circuitId);
    if (points) return points;
  }
  return fetchDefaultCircuitCenterline();
}

/**
 * Centerline STRICTE du circuit RÉEL d'une séance (extension V2-L1,
 * ADDITIVE — les appelants de `fetchSessionCircuitCenterline` sont
 * inchangés). Contrairement au repli historique ci-dessus, AUCUN fallback
 * sur le circuit par défaut : séance sans `circuit_id`, circuit sans
 * géométrie exploitable ou erreur de lecture → null. Les écrans « données
 * réelles » (Bilan) masquent alors le tracé plutôt que d'afficher la
 * silhouette d'un AUTRE circuit sous le chrono de la séance.
 */
export async function fetchSessionCircuitCenterlineExact(
  sessionId: string
): Promise<LatLon[] | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('telemetry_sessions') as any;
  const { data, error } = await table.select('circuit_id').eq('id', sessionId).maybeSingle();

  const circuitId = !error && data?.circuit_id ? (data.circuit_id as string) : null;
  if (!circuitId) return null;
  return fetchCircuitCenterline(circuitId);
}

/**
 * LES VIRAGES du circuit réel d'une séance — pendant STRICT des deux fonctions
 * ci-dessus : aucun repli sur le circuit par défaut.
 *
 * Ce chemin remplace `BELTOISE_CORNERS`, sept virages écrits en dur qui étaient
 * ceux de Haute Saintonge. Sur une séance de Bouteville, du Bugatti ou d'Albi,
 * l'application cherchait des notes de coach sur des virages qui n'existent pas
 * là — et en nommait un « Saintonge 3 ».
 *
 * Liste VIDE dans les quatre cas que l'appelant n'a pas à distinguer, parce
 * qu'ils appellent la même conduite — n'interroger aucun virage : séance sans
 * `circuit_id`, circuit introuvable, circuit jamais passé au détecteur, ou
 * lecture en erreur.
 */
export async function fetchSessionCircuitCorners(sessionId: string): Promise<VirageCircuit[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = supabase.from('telemetry_sessions') as any;
  const { data: s, error: eS } = await sessions
    .select('circuit_id')
    .eq('id', sessionId)
    .maybeSingle();
  const circuitId = !eS && s?.circuit_id ? (s.circuit_id as string) : null;
  if (!circuitId) return [];

  return fetchCircuitCorners(circuitId);
}

/**
 * Les virages d'un CIRCUIT, tels que le détecteur les a écrits en base.
 *
 * Pendant par circuit de `fetchSessionCircuitCorners`, extrait le 01/09/2026
 * parce que deux appelants en avaient besoin : le bilan part d'une séance,
 * l'écran des repères part d'un circuit choisi dans une liste. Les deux lisent
 * la MÊME colonne, et c'est ce qui garantit qu'un « virage 7 » désigne le même
 * endroit d'un écran à l'autre.
 *
 * Liste vide sur toute panne, comme partout ici : l'appelant affiche un état
 * honnête, jamais un virage inventé.
 */
export async function fetchCircuitCorners(circuitId: string): Promise<VirageCircuit[]> {
  if (typeof circuitId !== 'string' || circuitId.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circuits = supabase.from('circuits') as any;
  const { data, error } = await circuits.select('corners').eq('id', circuitId).maybeSingle();
  if (error) {
    console.warn('[OXV][circuits] fetchCircuitCorners :', error.message);
    return [];
  }
  return lireViragesCircuit(data?.corners ?? null);
}

/**
 * NOM du circuit réel d'une séance. Pendant STRICT de
 * `fetchSessionCircuitCenterlineExact` : aucun repli sur le circuit par défaut.
 *
 * `null` couvre trois cas que l'appelant n'a pas à distinguer, parce qu'ils
 * appellent la même conduite — ne rien dessiner et le dire : séance sans
 * `circuit_id`, circuit introuvable, ou lecture en erreur.
 *
 * Sert à armer la garde de `CircuitMap`. Cette garde existait déjà, mais son
 * champ était OPTIONNEL et aucun appelant ne le passait : elle ne s'est jamais
 * déclenchée. Une garde présente mais inerte rassure à tort.
 */
export async function fetchSessionCircuitName(sessionId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('telemetry_sessions') as any;
  const { data, error } = await table.select('circuit_id').eq('id', sessionId).maybeSingle();

  const circuitId = !error && data?.circuit_id ? (data.circuit_id as string) : null;
  if (!circuitId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circuits = supabase.from('circuits') as any;
  const { data: c, error: e2 } = await circuits.select('name').eq('id', circuitId).maybeSingle();

  if (e2 || !c?.name) return null;
  return c.name as string;
}
