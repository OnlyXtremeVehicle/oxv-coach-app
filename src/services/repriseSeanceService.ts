/**
 * REPRISE D'UNE SÉANCE RESTÉE OUVERTE.
 *
 * ===========================================================================
 * POURQUOI CE SERVICE EXISTE
 * ===========================================================================
 *
 * Une séance peut rester en `recording` pour des raisons qui ne se voient pas :
 * l'application tuée par le système en piste, un plantage, une clôture partie
 * en quarantaine. C'est arrivé la nuit du 13/08/2026 — 26 999 trames et trois
 * tours parfaitement écrits, et une séance invisible parce que son statut
 * n'avait jamais bougé.
 *
 * Le diagnostic existait (`adminQualityService` sait compter les séances
 * ouvertes). **La réparation n'a jamais été écrite.** On savait détecter, on ne
 * savait pas guérir.
 *
 * ===========================================================================
 * CE QU'ELLE FAIT, ET CE QU'ELLE NE FABRIQUE PAS
 * ===========================================================================
 *
 * Elle clôt la séance À PARTIR DE SES PROPRES TRAMES, jamais d'estimations :
 *
 *   ended_at        started_at + le dernier `elapsed_ms` observé
 *   total_frames    le compte réel en base
 *   max_speed_kmh   le maximum des trames
 *   max_g_*         les maxima des trames
 *   distance_km     l'intégration de la vitesse sur les trames
 *
 * `duration_seconds` n'est PAS écrite : c'est une colonne générée, et l'écrire
 * est précisément ce qui empêchait toute clôture d'aboutir.
 *
 * Une séance SANS trame n'est pas clôturée mais ABANDONNÉE : il n'y a rien à
 * conclure d'un enregistrement vide, et lui donner un statut « terminée »
 * ferait entrer une séance creuse dans la Saison et les moyennes.
 *
 * ===========================================================================
 * QUAND ELLE S'EXÉCUTE
 * ===========================================================================
 *
 * Au lancement de l'application, APRÈS l'authentification, et jamais pendant
 * une capture active — clore la séance qu'on est en train d'enregistrer serait
 * le comble. Best-effort et silencieuse : un échec laisse la séance en l'état,
 * qui est exactement là où elle était.
 */

import { supabase } from '@/lib/supabase';

/** Ce qu'une reprise a fait, pour le journal et les tests. */
export interface BilanReprise {
  /** Séances clôturées sur leurs données réelles. */
  cloturees: string[];
  /** Séances sans aucune trame, marquées abandonnées. */
  abandonnees: string[];
}

/**
 * Âge minimal d'une séance ouverte avant qu'on la reprenne.
 *
 * Une capture LÉGITIME est en `recording` : la reprendre reviendrait à couper
 * le pilote en pleine piste depuis un autre appareil. Trois heures dépassent
 * largement la plus longue journée de roulage, timeout d'interruption compris.
 */
const AGE_MINIMAL_MS = 3 * 60 * 60 * 1000;

interface AgregatsTrames {
  trames: number;
  dernierElapsedMs: number;
  vmax: number | null;
  gLat: number | null;
  gLong: number | null;
  distanceKm: number | null;
}

/**
 * Relève les agrégats d'une séance depuis ses trames.
 *
 * La pagination est explicite : une séance de vingt minutes porte 27 000
 * trames, et PostgREST plafonne ses réponses. Sans elle, on calculerait une
 * distance et un maximum sur le premier millier seulement — une donnée fausse,
 * ce qui est pire qu'une donnée absente.
 */
async function agregatsDesTrames(sessionId: string): Promise<AgregatsTrames | null> {
  const PAGE = 1000;
  let offset = 0;
  let trames = 0;
  let dernierElapsedMs = 0;
  let vmax: number | null = null;
  let gLat: number | null = null;
  let gLong: number | null = null;
  let distanceM = 0;
  let precedentMs: number | null = null;

  for (;;) {
    const { data, error } = await supabase
      .from('telemetry_frames')
      .select('elapsed_ms, speed_kmh, g_force_x, g_force_y')
      .eq('session_id', sessionId)
      .order('elapsed_ms', { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) return null;
    const lignes = data ?? [];
    if (lignes.length === 0) break;

    for (const l of lignes) {
      const ms = Number(l.elapsed_ms);
      const v = l.speed_kmh === null ? null : Number(l.speed_kmh);
      trames += 1;
      if (Number.isFinite(ms)) dernierElapsedMs = Math.max(dernierElapsedMs, ms);
      if (v !== null && Number.isFinite(v)) {
        vmax = vmax === null ? v : Math.max(vmax, v);
        // Intégration `v × dt`, avec le même plafond de pas que l'odomètre
        // embarqué : au-delà de deux secondes il n'y a pas eu d'échantillon, et
        // prolonger la dernière vitesse inventerait des mètres.
        if (precedentMs !== null && Number.isFinite(ms)) {
          const dt = Math.min(ms - precedentMs, 2000);
          if (dt > 0) distanceM += (v / 3.6) * (dt / 1000);
        }
      }
      if (Number.isFinite(ms)) precedentMs = ms;
      const gy = l.g_force_y === null ? null : Math.abs(Number(l.g_force_y));
      const gx = l.g_force_x === null ? null : Math.abs(Number(l.g_force_x));
      if (gy !== null && Number.isFinite(gy)) gLat = gLat === null ? gy : Math.max(gLat, gy);
      if (gx !== null && Number.isFinite(gx)) gLong = gLong === null ? gx : Math.max(gLong, gx);
    }

    if (lignes.length < PAGE) break;
    offset += PAGE;
  }

  return {
    trames,
    dernierElapsedMs,
    vmax,
    gLat,
    gLong,
    // Arrondi au décamètre, et `null` plutôt que zéro : une distance nulle
    // n'est pas une mesure, c'est une absence de mouvement.
    distanceKm: distanceM > 0 ? Math.round(distanceM / 10) / 100 : null,
  };
}

/**
 * Reprend les séances du pilote restées ouvertes.
 *
 * @param userId  le pilote — on ne touche JAMAIS aux séances d'un autre
 * @param maintenantMs instant courant (injectable pour les tests)
 */
export async function reprendreSeancesOuvertes(
  userId: string,
  maintenantMs: number = Date.now()
): Promise<BilanReprise> {
  const bilan: BilanReprise = { cloturees: [], abandonnees: [] };
  try {
    const { data, error } = await supabase
      .from('telemetry_sessions')
      .select('id, started_at')
      .eq('user_id', userId)
      .eq('status', 'recording')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error || !data) return bilan;

    for (const s of data) {
      const debut = new Date(s.started_at as string).getTime();
      if (!Number.isFinite(debut)) continue;
      // Trop récente : c'est peut-être une capture en cours ailleurs.
      if (maintenantMs - debut < AGE_MINIMAL_MS) continue;

      const ag = await agregatsDesTrames(s.id as string);
      if (ag === null) continue;

      if (ag.trames === 0) {
        // Rien à conclure d'un enregistrement vide. `aborted` dit qu'une
        // tentative a eu lieu ; `completed` prétendrait qu'elle a produit
        // quelque chose.
        const { error: e } = await supabase
          .from('telemetry_sessions')
          .update({ status: 'aborted', ended_at: s.started_at as string })
          .eq('id', s.id)
          .eq('user_id', userId);
        if (!e) bilan.abandonnees.push(s.id as string);
        continue;
      }

      const fin = new Date(debut + ag.dernierElapsedMs).toISOString();
      const { error: e } = await supabase
        .from('telemetry_sessions')
        .update({
          status: 'completed',
          ended_at: fin,
          total_frames: ag.trames,
          distance_km: ag.distanceKm,
          max_speed_kmh: ag.vmax,
          max_g_lateral: ag.gLat,
          max_g_longitudinal: ag.gLong,
          // `duration_seconds` est GÉNÉRÉE — l'écrire lève 428C9 et fait
          // repartir la clôture en quarantaine. Elle se déduit d'`ended_at`.
        })
        .eq('id', s.id)
        .eq('user_id', userId);
      if (!e) {
        bilan.cloturees.push(s.id as string);
        console.warn(
          `[OXV][reprise] séance ${s.id} clôturée sur ses données réelles (${ag.trames} trames).`
        );
      }
    }
  } catch (e) {
    console.warn('[OXV][reprise] échec :', e instanceof Error ? e.message : e);
  }
  return bilan;
}
