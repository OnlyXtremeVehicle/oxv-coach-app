/**
 * Service télémétrie session — charge les frames brutes pour les
 * visualisations pro (diagramme G-G, trace vitesse).
 *
 * Distinct de `analyzeSessionService` (qui orchestre l'analyse trackviz
 * pour stocker les marges en base) : ici on lit les frames pour les
 * afficher tels quels.
 *
 * RLS : le pilote voit ses propres frames. Un coach voit celles du
 * pilote suivi grâce à `telemetry_frames_coach_select` (sem 15).
 */

import { supabase } from '@/lib/supabase';
import {
  echantillonne,
  mapFramesToTrajectory,
  type TrajectoryFramePoint,
  type TrajectoryFrameRow,
} from '@/services/trajectoryLogic';
import {
  frameRowToSessionFrame,
  type FrameRow,
  type SessionFrame,
} from '@/services/sessionTelemetryMapping';
import type { LigneQualite } from '@/features/data/confianceSource';

// Convention d'axes + mapper pur : src/services/sessionTelemetryMapping.ts
// (source unique, testée). Ré-exportés ici pour les consommateurs existants.
export {
  frameRowToSessionFrame,
  type FrameRow,
  type SessionFrame,
} from '@/services/sessionTelemetryMapping';

/**
 * ===========================================================================
 * TROIS REQUÊTES LISAIENT LE DÉBUT D'UN TOUR EN CROYANT LE LIRE ENTIER
 * ===========================================================================
 *
 * Mesuré en base le 01/09/2026, sur la séance de référence de Bouteville : ses
 * trois tours portent 9 013, 8 190 et 8 489 trames. C'est ce qu'il faut lire
 * pour dessiner un tour.
 *
 * `loadLapFrames` et `loadTramesQualiteTour` demandaient `.limit(2000)` en UNE
 * requête ; `loadSessionTrajectory` mille. Le meilleur des cas rendait donc
 * moins d'un quart de tour, et le tracé « SÉANCE ENTIÈRE » moins d'un neuvième
 * de séance — sans erreur, sans avertissement, sans qu'aucun écran puisse le
 * soupçonner : le nombre reçu était plausible.
 *
 * (`loadSessionFrames`, elle, paginait depuis l'origine. Son commentaire de
 * l'époque affirme que PostgREST plafonne ses réponses à mille lignes ; ce
 * réglage n'a PAS été remesuré sur ce projet, et rien ici n'en dépend. La
 * pagination est juste dans les deux cas — c'est précisément pourquoi on pagine
 * au lieu de choisir une limite.)
 *
 * On pagine donc partout. Les plafonds qui subsistent sont des BORNES DE
 * SÉCURITÉ, pas des fenêtres de lecture : ils bornent la boucle, et un appelant
 * qui les atteint le sait en comparant la longueur reçue.
 */
const PAGE_POSTGREST = 1000;

/** La forme minimale d'une réponse PostgREST, sans dépendre de ses génériques. */
interface ReponsePage {
  data: unknown[] | null;
  error: { message: string } | null;
}

/**
 * Lit une requête page par page jusqu'au plafond.
 *
 * `construire(debut, fin)` doit rendre la MÊME requête, bornée par `.range()`.
 * Un tri stable est indispensable — sans `order`, deux pages peuvent se
 * recouvrir ou se manquer.
 */
async function lirePages(
  construire: (debut: number, fin: number) => PromiseLike<ReponsePage>,
  plafond: number,
  ou: string
): Promise<unknown[]> {
  const lignes: unknown[] = [];
  for (let debut = 0; debut < plafond; debut += PAGE_POSTGREST) {
    const fin = Math.min(debut + PAGE_POSTGREST, plafond) - 1;
    const { data, error } = await construire(debut, fin);
    if (error) {
      console.warn(`[OXV][telemetry] ${ou} :`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    lignes.push(...data);
    if (data.length < fin - debut + 1) break; // dernière page
  }
  return lignes;
}

/**
 * Borne de sécurité d'une SÉANCE entière : soixante mille trames, quarante
 * minutes à vingt-cinq hertz. Elle borne la boucle de pagination, elle ne
 * décrit aucune fenêtre de lecture.
 */
export const PLAFOND_TRAMES_SEANCE = 60_000;

/**
 * Points réellement rendus à une trace de séance. Au-delà, on échantillonne à
 * pas constant : la forme est conservée, le début ne l'est pas au détriment de
 * la fin.
 */
export const POINTS_TRACE_MAX = 3000;

/**
 * Trajectoire GPS d'une séance (lat / lon / vitesse), pour la carte et la Vue
 * unifiée. Source UNIQUE de la requête trajectoire — supprime la copie inline
 * qui vivait dans `carte.tsx` et `data-lab-canvas.tsx` (risque de divergence).
 * Filtrage/conversion délégués à `mapFramesToTrajectory` (pur, testé).
 */
export async function loadSessionTrajectory(
  sessionId: string
): Promise<TrajectoryFramePoint[]> {
  const lignes = await lirePages(
    (debut, fin) =>
      supabase
        .from('telemetry_frames')
        .select('latitude, longitude, speed_kmh')
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .range(debut, fin),
    PLAFOND_TRAMES_SEANCE,
    'loadSessionTrajectory'
  );
  return echantillonne(mapFramesToTrajectory(lignes as TrajectoryFrameRow[]), POINTS_TRACE_MAX);
}

/**
 * Charge les frames d'une séance ENTIÈRE, paginées par 1000 (plafond PostgREST :
 * un .limit(5000) seul ne rend que 1000 lignes → un QDI calculé sur l'amorce de
 * séance). Borne de sécurité `maxFrames` (60 000 ≈ 40 min à 25 Hz).
 */
export async function loadSessionFrames(
  sessionId: string,
  maxFrames = PLAFOND_TRAMES_SEANCE
): Promise<SessionFrame[]> {
  const lignes = await lirePages(
    (debut, fin) =>
      supabase
        .from('telemetry_frames')
        // `rotation_z` = vitesse de lacet. Sans elle, `aLat`, `curvature` et tout
        // le découpage en virages sont nuls par construction : la colonne est
        // écrite par la capture depuis le premier jour et n'était jamais relue.
        .select(
          'elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z, rotation_z'
        )
        .eq('session_id', sessionId)
        .order('elapsed_ms', { ascending: true })
        .range(debut, fin),
    maxFrames,
    'loadSessionFrames'
  );
  return (lignes as FrameRow[]).map(frameRowToSessionFrame);
}

/**
 * Renvoie uniquement les points {gLat, gLong, speedKmh} prêts pour
 * le GGDiagram, en filtrant les frames sans données g valides.
 */
export async function loadGGPoints(
  sessionId: string
): Promise<{ gLat: number; gLong: number; speedKmh: number | null }[]> {
  const frames = await loadSessionFrames(sessionId);
  return frames
    .filter((f) => f.gLat !== null && f.gLong !== null)
    .map((f) => ({
      gLat: f.gLat as number,
      gLong: f.gLong as number,
      speedKmh: f.speedKmh,
    }));
}

/**
 * Borne de sécurité d'UN tour — vingt mille trames, treize minutes à
 * vingt-cinq hertz.
 *
 * Elle valait deux mille et servait de `.limit()` en une seule requête, ce qui
 * en faisait une fenêtre de lecture. Les trois tours de Bouteville comptent
 * 9 013, 8 190 et 8 489 trames : les écrans en recevaient deux mille au plus,
 * et lisaient donc le premier quart d'un tour en croyant le lire entier.
 *
 * La requête pagine désormais, et ce nombre ne borne plus que la boucle. Aucun
 * tour réel ne l'atteint ; celui qui l'atteindrait serait un tour resté ouvert,
 * pas un tour long.
 *
 * Il reste EXPORTÉ parce qu'un appelant ne peut détecter une troncature qu'en
 * comparant à lui — `deltaService` le fait, et continue de le faire.
 */
export const PLAFOND_TRAMES_TOUR = 20_000;

/**
 * Charge les frames d'un tour spécifique en filtrant par la fenêtre
 * temporelle de ce tour (laps.started_at -> laps.ended_at convertis
 * en elapsed_ms relativement à session.started_at côté requête).
 *
 * V1 simple : on charge toutes les frames de la session et on filtre
 * côté client par lap_number. À terme on stockera lap_number sur
 * `telemetry_frames` pour requêter direct.
 *
 * **Le résultat peut être TRONQUÉ** — voir `PLAFOND_TRAMES_TOUR`. Un appelant
 * qui en tire une grandeur cumulée (distance, delta) doit le dire à l'écran.
 */
export async function loadLapFrames(sessionId: string, lapNumber: number): Promise<SessionFrame[]> {
  const fenetre = await fenetreElapsedTour(sessionId, lapNumber);
  if (fenetre === null) return [];

  // Filtre les frames sur la fenêtre du tour, page par page.
  const lignes = await lirePages(
    (debut, fin) =>
      supabase
        .from('telemetry_frames')
        .select(
          'elapsed_ms, latitude, longitude, speed_kmh, g_force_x, g_force_y, g_force_z, rotation_z'
        )
        .eq('session_id', sessionId)
        .gte('elapsed_ms', fenetre.debutMs)
        .lte('elapsed_ms', fenetre.finMs)
        .order('elapsed_ms', { ascending: true })
        .range(debut, fin),
    PLAFOND_TRAMES_TOUR,
    'loadLapFrames frames'
  );

  return (lignes as FrameRow[]).map(frameRowToSessionFrame);
}

/**
 * Bornes `elapsed_ms` d'un tour — le préambule commun de `loadLapFrames` et
 * `loadTramesQualiteTour` (une seule conversion de fenêtre, pas deux copies).
 *
 * `null` quand le tour n'est pas retrouvé ou n'a pas de borne exploitable.
 */
async function fenetreElapsedTour(
  sessionId: string,
  lapNumber: number
): Promise<{ debutMs: number; finMs: number } | null> {
  // 1. Récupère les bornes du tour
  const { data: laps, error: lapsError } = await supabase
    .from('laps')
    .select('lap_number, started_at, ended_at')
    .eq('session_id', sessionId)
    .eq('lap_number', lapNumber)
    .maybeSingle();

  if (lapsError || !laps) {
    if (lapsError) console.warn('[OXV][telemetry] loadLapFrames lap :', lapsError.message);
    return null;
  }

  // 2. Récupère la session pour avoir started_at de référence
  const { data: session } = await supabase
    .from('telemetry_sessions')
    .select('started_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return null;

  const sessionStartMs = new Date(session.started_at as string).getTime();
  const lapStartMs = new Date(laps.started_at as string).getTime() - sessionStartMs;
  const lapEndMs = new Date(laps.ended_at as string).getTime() - sessionStartMs;

  /**
   * UN TOUR SANS FIN NE FABRIQUE PLUS UNE URL ABSURDE.
   *
   * Un tour resté ouvert porte `ended_at = null` — le même oubli que celui qui
   * laissait les séances en `recording`. `new Date(null).getTime()` rend `NaN`,
   * et `.lte('elapsed_ms', NaN)` part dans l'URL PostgREST en
   * `elapsed_ms=lte.NaN` : la requête est refusée en 400, le code descend dans
   * son `if (error) return []`, et l'écran conclut « aucune trame GPS » alors
   * que les trames existent.
   *
   * Même famille que le défaut dominant du dépôt : la garde existe, elle avale
   * la panne au lieu de la dire. On refuse ici la borne invalide plutôt que de
   * la laisser voyager.
   */
  if (!Number.isFinite(lapStartMs) || !Number.isFinite(lapEndMs)) {
    console.warn(
      `[OXV][telemetry] loadLapFrames : tour ${lapNumber} sans borne exploitable (started_at/ended_at).`
    );
    return null;
  }

  return { debutMs: lapStartMs, finMs: lapEndMs };
}

/**
 * Canaux de QUALITÉ DE MESURE d'un tour (LOT confiance par zone, M03+) :
 * `gps_accuracy_m`, `pdop`, `satellites`, `fix_valid` — colonnes réelles de
 * `telemetry_frames`, jamais relues jusqu'ici. La vitesse est demandée avec,
 * parce que la position curviligne se DÉRIVE (∫ v dt, cf. `confianceSource`) :
 * les trames ne portent pas leur distance.
 *
 * Même fenêtre et même pagination que `loadLapFrames`. Elle lisait deux mille
 * trames au plus d'un tour qui en compte huit mille : la couverture de mesure
 * s'annonçait sur le premier quart du tour, et rien à l'écran ne le disait.
 */
export async function loadTramesQualiteTour(
  sessionId: string,
  lapNumber: number
): Promise<LigneQualite[]> {
  const fenetre = await fenetreElapsedTour(sessionId, lapNumber);
  if (fenetre === null) return [];

  const lignes = await lirePages(
    (debut, fin) =>
      supabase
        .from('telemetry_frames')
        .select('elapsed_ms, speed_kmh, gps_accuracy_m, pdop, satellites, fix_valid')
        .eq('session_id', sessionId)
        .gte('elapsed_ms', fenetre.debutMs)
        .lte('elapsed_ms', fenetre.finMs)
        .order('elapsed_ms', { ascending: true })
        .range(debut, fin),
    PLAFOND_TRAMES_TOUR,
    'loadTramesQualiteTour'
  );

  return lignes as LigneQualite[];
}

/**
 * Renvoie une trace vitesse {progress, speedKmh} où progress est la
 * position relative dans la session (0..1).
 *
 * V1 grossier : progress = index / total. À terme, on calculera la
 * progression réelle via map-matching sur la polyline du circuit
 * pour avoir une vitesse-vs-distance plus précise (un tour rapide
 * et un tour lent auront alors des points alignés sur les mêmes
 * progress, ce qui n'est pas garanti avec elapsed_ms).
 */
export async function loadSpeedTracePoints(
  sessionId: string
): Promise<{ progress: number; speedKmh: number }[]> {
  const frames = await loadSessionFrames(sessionId);
  const validFrames = frames.filter((f) => f.speedKmh !== null);
  if (validFrames.length < 2) return [];

  const total = validFrames.length;
  return validFrames.map((f, i) => ({
    progress: i / (total - 1),
    speedKmh: f.speedKmh as number,
  }));
}

/**
 * Renvoie les points {progress, gLong} pour le ThrottleBrakeTrace.
 * gLong > 0 = throttle, gLong < 0 = brake.
 */
export async function loadThrottleBrakePoints(
  sessionId: string
): Promise<{ progress: number; gLong: number }[]> {
  const frames = await loadSessionFrames(sessionId);
  const validFrames = frames.filter((f) => f.gLong !== null);
  if (validFrames.length < 2) return [];

  const total = validFrames.length;
  return validFrames.map((f, i) => ({
    progress: i / (total - 1),
    gLong: f.gLong as number,
  }));
}
