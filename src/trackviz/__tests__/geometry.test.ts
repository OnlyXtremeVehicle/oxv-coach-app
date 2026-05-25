/**
 * Tests de la géométrie trackviz : map-matching, segments, phases,
 * + sanity check sur l'analyse demo.
 */

import { HAUTE_SAINTONGE_SEGMENTS, HAUTE_SAINTONGE_TRACK } from '../hauteSaintonge';
import {
  TrackProjection,
  buildTrackGeometry,
  mapMatchPoint,
  phaseForProgress,
  segmentForProgress,
} from '../geometry';
import { analyzeTrackVizSession, buildDemoTrackVizSamples } from '../analysis';

describe('buildTrackGeometry', () => {
  it('calcule la longueur totale du tracé à partir des points', () => {
    const geom = buildTrackGeometry(HAUTE_SAINTONGE_TRACK);
    expect(geom.trackPoints.length).toBe(HAUTE_SAINTONGE_TRACK.length);
    expect(geom.cumulativeDistances.length).toBe(HAUTE_SAINTONGE_TRACK.length);
    // Beltoise depuis OSM way 54412766 (refactor sem 16) : ~1.5-1.8 km
    expect(geom.totalLengthM).toBeGreaterThan(1000);
    expect(geom.totalLengthM).toBeLessThan(2500);
  });

  it('expose cumulativeDistances croissantes', () => {
    const geom = buildTrackGeometry(HAUTE_SAINTONGE_TRACK);
    for (let i = 1; i < geom.cumulativeDistances.length; i++) {
      expect(geom.cumulativeDistances[i]).toBeGreaterThanOrEqual(geom.cumulativeDistances[i - 1]);
    }
  });
});

describe('mapMatchPoint', () => {
  const geom = buildTrackGeometry(HAUTE_SAINTONGE_TRACK);

  it('projette un point exactement sur le premier point du tracé', () => {
    const res = mapMatchPoint(HAUTE_SAINTONGE_TRACK[0], geom);
    expect(res.progress).toBeCloseTo(0, 2);
    expect(res.lateralErrorM).toBeLessThan(1);
  });

  it('renvoie un progress dans [0, 1]', () => {
    // Point dans le bbox Beltoise (centre approx)
    const res = mapMatchPoint({ lat: 45.2408, lon: -0.092 }, geom);
    expect(res.progress).toBeGreaterThanOrEqual(0);
    expect(res.progress).toBeLessThanOrEqual(1);
  });

  it('détecte une erreur latérale élevée pour un point hors tracé', () => {
    // Un point ~500 m au nord-est du circuit
    const offTrack = { lat: 45.245, lon: -0.085 };
    const res = mapMatchPoint(offTrack, geom);
    expect(res.lateralErrorM).toBeGreaterThan(50);
  });
});

describe('segmentForProgress', () => {
  it('renvoie le bon segment pour les bornes du tracé', () => {
    const first = segmentForProgress(0, HAUTE_SAINTONGE_SEGMENTS);
    expect(first.order).toBe(1);
    const last = segmentForProgress(1, HAUTE_SAINTONGE_SEGMENTS);
    expect(last.order).toBe(HAUTE_SAINTONGE_SEGMENTS.length);
  });

  it('renvoie un segment couvrant le progress donné', () => {
    const mid = segmentForProgress(0.5, HAUTE_SAINTONGE_SEGMENTS);
    expect(mid.progressStart).toBeLessThanOrEqual(0.5);
    expect(mid.progressEnd).toBeGreaterThanOrEqual(0.5);
  });
});

describe('phaseForProgress', () => {
  it("retourne 'apex' au centre d'un virage", () => {
    const seg = HAUTE_SAINTONGE_SEGMENTS[0];
    if (seg.apexProgress === null) {
      return; // skip si pas de virage
    }
    const phase = phaseForProgress(seg.apexProgress, seg);
    expect(phase).toBe('apex');
  });

  it("retourne 'entry' avant l'apex", () => {
    const seg = HAUTE_SAINTONGE_SEGMENTS[0];
    if (seg.apexProgress === null) return;
    const before = seg.progressStart + 0.001;
    expect(phaseForProgress(before, seg)).toBe('entry');
  });

  it("retourne 'exit' après l'apex", () => {
    const seg = HAUTE_SAINTONGE_SEGMENTS[0];
    if (seg.apexProgress === null) return;
    const after = seg.progressEnd - 0.001;
    expect(phaseForProgress(after, seg)).toBe('exit');
  });
});

describe('TrackProjection', () => {
  it('projette le centre du tracé en (0, 0) approximativement', () => {
    const proj = new TrackProjection(HAUTE_SAINTONGE_TRACK);
    const center = HAUTE_SAINTONGE_TRACK[Math.floor(HAUTE_SAINTONGE_TRACK.length / 2)];
    const scene = proj.toScene(center);
    // Les coordonnées en scène doivent être petites (en mètres autour de l'origine)
    expect(Math.abs(scene.x)).toBeLessThan(2000);
    expect(Math.abs(scene.y)).toBeLessThan(2000);
  });
});

describe('analyzeTrackVizSession (sanity sur demo)', () => {
  it('produit ~7 segments analysés sur la session demo (refactor sem 16)', () => {
    const samples = buildDemoTrackVizSamples();
    const result = analyzeTrackVizSession(samples);
    // Tolérance ±1 : un segment court peut avoir < 2 samples et être
    // filtré par analyzeSegment. Confortable pour V1, à durcir V1.1
    // quand on aura un .ubx réel de session.
    expect(result.segments.length).toBeGreaterThanOrEqual(6);
    expect(result.segments.length).toBeLessThanOrEqual(7);
  });

  it('chaque segment a marginPercent dans [0, 100]', () => {
    const samples = buildDemoTrackVizSamples();
    const result = analyzeTrackVizSession(samples);
    for (const seg of result.segments) {
      expect(seg.marginPercent).toBeGreaterThanOrEqual(0);
      expect(seg.marginPercent).toBeLessThanOrEqual(100);
    }
  });

  it('renvoie un summary cohérent', () => {
    const samples = buildDemoTrackVizSamples();
    const result = analyzeTrackVizSession(samples);
    expect(result.summary.sampleCount).toBe(samples.length);
    expect(result.summary.durationSeconds).toBeGreaterThan(0);
    expect(result.summary.maxSpeedKmh).toBeGreaterThan(100);
  });
});
