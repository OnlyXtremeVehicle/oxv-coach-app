import { analyzeTrackVizSession } from '@/trackviz/analysis';
import { HAUTE_SAINTONGE_TRACK } from '@/trackviz/hauteSaintonge';
import type { TrackVizRecordingSample } from '@/trackviz/types';

/**
 * Garde-fou multi-circuit.
 *
 * L'analyse par segment projette les points GPS sur le tracé de Haute Saintonge,
 * seul circuit dont la géométrie est connue. Pour une séance courue ailleurs, le
 * map-matching renvoie une erreur latérale énorme, l'usage de trajectoire sature,
 * et la marge tombe mécaniquement à zéro. Publier ce zéro reviendrait à présenter
 * une marge de SÉCURITÉ fabriquée comme une mesure — au pilote, et au coach dans
 * son triage.
 *
 * Ces tests verrouillent le refus. Ils échoueront si quelqu'un retire la garde
 * pour « débloquer » un autre circuit sans lui donner sa géométrie.
 */

/** Un échantillon plausible, positionné où on le demande. */
function sample(
  lat: number,
  lon: number,
  elapsedMs: number,
  over: Partial<TrackVizRecordingSample> = {}
): TrackVizRecordingSample {
  return {
    elapsed_ms: elapsedMs,
    latitude: lat,
    longitude: lon,
    speed_kmh: 90,
    g_force_x: 0.2,
    g_force_y: 0.6,
    g_force_z: 1,
    ...over,
  } as TrackVizRecordingSample;
}

/** Une série de points posés SUR le tracé réel, donc analysables. */
function serieSurLeTrace(n = 40): TrackVizRecordingSample[] {
  return Array.from({ length: n }, (_, i) => {
    const p = HAUTE_SAINTONGE_TRACK[i % HAUTE_SAINTONGE_TRACK.length];
    return sample(p.lat, p.lon, i * 200);
  });
}

describe('analyzeTrackVizSession — garde-fou multi-circuit', () => {
  it('analyse une séance réellement courue sur le tracé connu', () => {
    expect(() => analyzeTrackVizSession(serieSurLeTrace())).not.toThrow();
  });

  it('REFUSE une séance courue sur un autre circuit plutôt que de fabriquer des marges', () => {
    // Circuit Ricardo Tormo, Valence — à plus de 600 km de Haute Saintonge.
    const valence = Array.from({ length: 40 }, (_, i) =>
      sample(39.485 + i * 0.0001, -0.63 + i * 0.0001, i * 200)
    );
    expect(() => analyzeTrackVizSession(valence)).toThrow(/hors du tracé fourni/i);
  });

  /**
   * Le message ne nomme PLUS Haute Saintonge, et c'est le sens du 01/09 : la
   * piste vient de la base, elle n'est plus une constante. Il dit ce qui reste
   * vrai quel que soit le tracé reçu — l'écart mesuré, et que le recalage a
   * échoué.
   */
  it('le message dit l’écart constaté et pourquoi rien n’est calculable', () => {
    const ailleurs = Array.from({ length: 20 }, (_, i) => sample(48.8566, 2.3522, i * 200));
    expect(() => analyzeTrackVizSession(ailleurs)).toThrow(/écart médian \d+ m/);
    expect(() => analyzeTrackVizSession(ailleurs)).toThrow(/aucune marge n'est calculable/);
  });

  it('tolère une sortie de piste : quelques dizaines de mètres restent analysables', () => {
    // ~0,0005° de latitude ≈ 55 m : une excursion, pas un autre circuit.
    const avecEcart = HAUTE_SAINTONGE_TRACK.slice(0, 30).map(
      (p: { lat: number; lon: number }, i: number) => sample(p.lat + 0.0005, p.lon, i * 200)
    );
    expect(() => analyzeTrackVizSession(avecEcart)).not.toThrow();
  });

  it('ne refuse pas une séance vide : l’absence n’est pas une erreur de circuit', () => {
    expect(() => analyzeTrackVizSession([])).not.toThrow();
  });
});
