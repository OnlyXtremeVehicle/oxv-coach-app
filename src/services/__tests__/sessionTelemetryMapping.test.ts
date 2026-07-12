/**
 * VERROU DE CONVENTION D'AXES — écriture ↔ lecture ↔ QDI.
 *
 * La vérité vient du WRITE PATH (captureFrameMapping, V1 prod) et de trackviz :
 *   g_force_x = LONGITUDINAL (x > 0 = freinage) · g_force_y = LATÉRAL.
 * Le contrat SessionFrame expose gLong POSITIF = accélération. Un mapping
 * inversé fausse le QDI entier (fluidité sur le mauvais axe, appuis en virage
 * comptés comme freinages) — c'est arrivé ; ce test empêche la récidive.
 */

import { updateMaxima, EMPTY_MAXIMA } from '@/services/captureFrameMapping';
import { frameRowToSessionFrame } from '@/services/sessionTelemetryMapping';
import type { RaceBoxData } from '@/types/telemetry';

/** Trame minimale : freinage appuyé (X = +0,9 g) + virage droite (Y = +0,6 g). */
function fakeRaceBox(gForceX: number, gForceY: number): RaceBoxData {
  return {
    imu: { gForceX, gForceY, gForceZ: 1, rotRateX: 0, rotRateY: 0, rotRateZ: 0 },
    motion: { speed: 120, heading: 0, headingValid: true },
  } as unknown as RaceBoxData;
}

describe('convention d’axes G (écriture ↔ lecture)', () => {
  it('write path : X = longitudinal, Y = latéral (maxima)', () => {
    const m = updateMaxima(EMPTY_MAXIMA, fakeRaceBox(0.9, 0.6));
    expect(m.maxGLongitudinal).toBeCloseTo(0.9); // |gForceX|
    expect(m.maxGLateral).toBeCloseTo(0.6); // |gForceY|
  });

  it('lecture : gLat = g_force_y, gLong = −g_force_x (freinage → gLong négatif)', () => {
    // En base : freinage x=+0.9 (convention trackviz x>0 = freinage), virage y=+0.6.
    const f = frameRowToSessionFrame({
      elapsed_ms: 1000,
      latitude: 45,
      longitude: 0,
      speed_kmh: 120,
      g_force_x: 0.9,
      g_force_y: 0.6,
      g_force_z: 1,
    });
    expect(f.gLat).toBeCloseTo(0.6); // latéral = Y
    expect(f.gLong).toBeCloseTo(-0.9); // freinage = gLong NÉGATIF (contrat)
  });

  it('accélération en base (x négatif) → gLong positif (contrat SessionFrame)', () => {
    const f = frameRowToSessionFrame({
      elapsed_ms: 0,
      latitude: null,
      longitude: null,
      speed_kmh: null,
      g_force_x: -0.4,
      g_force_y: 0,
      g_force_z: null,
    });
    expect(f.gLong).toBeCloseTo(0.4);
  });

  it('g manquants → null (jamais 0 inventé)', () => {
    const f = frameRowToSessionFrame({
      elapsed_ms: 0,
      latitude: null,
      longitude: null,
      speed_kmh: null,
      g_force_x: null,
      g_force_y: null,
      g_force_z: null,
    });
    expect(f.gLat).toBeNull();
    expect(f.gLong).toBeNull();
    expect(f.gVert).toBeNull();
  });
});
