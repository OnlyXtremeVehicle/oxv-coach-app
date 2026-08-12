/**
 * LES COLONNES `numeric` D'UN TOUR ARRIVENT EN CHAÎNE — et tout en dépend.
 *
 * ===========================================================================
 * LE DÉFAUT QUE CE FICHIER EXISTE POUR EMPÊCHER
 * ===========================================================================
 *
 * `fetchSessionLaps` faisait `return (data ?? []) as Lap[]`. Un cast, pas une
 * conversion. PostgREST sérialise `numeric` en CHAÎNE JSON pour préserver la
 * précision décimale — les onze colonnes numériques de `laps` valaient donc
 * `"83.412"` à l'exécution, pendant que le type affirmait `number`.
 *
 * Conséquence relevée le 13/08/2026 : `choixPaireTours.retenu()` teste
 * `Number.isFinite(t.durationSeconds)`, **faux sur une chaîne**. Aucun tour
 * n'était jamais retenu, et la section DELTA affichait « cette séance ne porte
 * pas deux tours chronométrés à comparer » sur toutes les séances, y compris
 * celles de vingt tours.
 *
 * Ça ne plantait pas. Ça mentait — et le mensonge restait invisible tant
 * qu'aucune séance ne portait de tour.
 *
 * Ce test rejoue la forme EXACTE que rend PostgREST, et vérifie les deux bouts
 * de la chaîne : la conversion, puis le fait que la comparaison de tours
 * l'accepte enfin.
 */

import { choisitPaireTours } from '@/features/data/choixPaireTours';
import { fetchSessionLaps } from '../sessionsService';

const reponse: { data: unknown; error: { message: string } | null } = { data: [], error: null };

jest.mock('@/lib/supabase', () => {
  const maillon: Record<string, unknown> = {};
  maillon.select = () => maillon;
  maillon.eq = () => maillon;
  maillon.order = () => maillon;
  maillon.then = (resolve: (v: unknown) => unknown) => Promise.resolve(reponse).then(resolve);
  return { supabase: { from: () => maillon } };
});

/** Une ligne `laps` telle que PostgREST la rend RÉELLEMENT : numeric = string. */
function ligneBrute(n: number, secondes: string) {
  return {
    id: `lap-${n}`,
    session_id: 's1',
    lap_number: n,
    duration_seconds: secondes,
    max_speed_kmh: '182.40',
    avg_speed_kmh: '118.75',
    max_g_lateral: '1.24',
    max_g_braking: '1.05',
    max_g_accel: '0.62',
    distance_meters: '5913.00',
    start_lat: '45.5971530',
    start_lon: '-0.1333830',
    end_lat: '45.5971530',
    end_lon: '-0.1333830',
    is_best_lap: false,
    is_outlap: false,
    is_inlap: false,
  };
}

describe('fetchSessionLaps convertit les numeric en nombres', () => {
  it('duration_seconds arrive en chaîne et ressort en nombre', async () => {
    reponse.data = [ligneBrute(1, '83.412')];
    const [tour] = await fetchSessionLaps('s1');
    expect(typeof tour.duration_seconds).toBe('number');
    expect(tour.duration_seconds).toBeCloseTo(83.412, 3);
  });

  it('les onze colonnes numériques sont converties', async () => {
    reponse.data = [ligneBrute(1, '83.412')];
    const [tour] = await fetchSessionLaps('s1');
    const t = tour as unknown as Record<string, unknown>;
    for (const col of [
      'duration_seconds',
      'max_speed_kmh',
      'avg_speed_kmh',
      'max_g_lateral',
      'max_g_braking',
      'max_g_accel',
      'distance_meters',
      'start_lat',
      'start_lon',
      'end_lat',
      'end_lon',
    ]) {
      expect(typeof t[col]).toBe('number');
    }
  });

  it('un null reste null — on ne fabrique pas un zéro', async () => {
    reponse.data = [{ ...ligneBrute(1, '83.412'), max_g_lateral: null, distance_meters: null }];
    const [tour] = await fetchSessionLaps('s1');
    const t = tour as unknown as Record<string, unknown>;
    expect(t.max_g_lateral).toBeNull();
    expect(t.distance_meters).toBeNull();
  });

  /**
   * `NaN` traverse les gardes `!== null` et ressort en « — » ou en trait de
   * graphique corrompu. Une valeur illisible devient donc `null`, pas `NaN`.
   */
  it('une valeur illisible devient null, jamais NaN', async () => {
    reponse.data = [{ ...ligneBrute(1, '83.412'), max_speed_kmh: 'pas-un-nombre' }];
    const [tour] = await fetchSessionLaps('s1');
    const t = tour as unknown as Record<string, unknown>;
    expect(t.max_speed_kmh).toBeNull();
    expect(Number.isNaN(t.max_speed_kmh as number)).toBe(false);
  });

  it('les colonnes non numériques sont intactes', async () => {
    reponse.data = [ligneBrute(3, '81.900')];
    const [tour] = await fetchSessionLaps('s1');
    expect(tour.lap_number).toBe(3);
    expect(tour.is_outlap).toBe(false);
    expect(tour.session_id).toBe('s1');
  });
});

describe('la comparaison de tours accepte enfin des tours', () => {
  /**
   * LE BOUT DE CHAÎNE QUI COMPTE. Sans conversion, `retenu()` rejetait tout et
   * la section DELTA était vide pour toujours.
   */
  it('deux tours chronométrés donnent une paire', async () => {
    reponse.data = [ligneBrute(1, '83.412'), ligneBrute(2, '81.900')];
    const tours = await fetchSessionLaps('s1');
    const paire = choisitPaireTours(
      tours.map((l) => ({
        lapNumber: l.lap_number,
        durationSeconds: l.duration_seconds,
        isOutlap: l.is_outlap,
        isInlap: l.is_inlap,
      })),
      null
    );
    expect(paire).not.toBeNull();
  });

  /** Le contre-test : les chaînes brutes, elles, ne donnaient rien. */
  it('les mêmes tours NON convertis ne donnaient aucune paire — c’était le défaut', () => {
    const bruts = [ligneBrute(1, '83.412'), ligneBrute(2, '81.900')].map((l) => ({
      lapNumber: l.lap_number,
      durationSeconds: l.duration_seconds as unknown as number,
      isOutlap: l.is_outlap,
      isInlap: l.is_inlap,
    }));
    expect(choisitPaireTours(bruts, null)).toBeNull();
  });
});
