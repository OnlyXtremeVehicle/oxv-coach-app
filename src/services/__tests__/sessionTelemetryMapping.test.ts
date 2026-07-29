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

/**
 * VERROU D'UNITÉ — le lacet, et le facteur 57,3.
 *
 * Le parseur rend `rotRateZ` en DEGRÉS par seconde (l'entier du boîtier divisé
 * par cent), le chemin d'écriture le recopie tel quel dans `rotation_z`, et la
 * banque de calculs attend des RADIANS par seconde.
 *
 * Brancher l'un sur l'autre sans convertir rendrait `κ = ω/v` 57,3 fois trop
 * grande : le segmenteur lirait le tour entier comme un seul virage, et
 * l'accélération latérale afficherait des dizaines de g. Rien ne planterait.
 */
function ligne(rotation_z: number | null | undefined) {
  return {
    elapsed_ms: 0,
    latitude: null,
    longitude: null,
    speed_kmh: null,
    g_force_x: null,
    g_force_y: null,
    g_force_z: null,
    rotation_z,
  };
}

describe('vitesse de lacet — degrés en base, radians dans la banque', () => {
  it('180 °/s font π rad/s', () => {
    expect(frameRowToSessionFrame(ligne(180)).yawRateRadS).toBeCloseTo(Math.PI, 12);
  });

  it('un degré par seconde fait bien moins d’un radian par seconde', () => {
    const r = frameRowToSessionFrame(ligne(1)).yawRateRadS!;
    expect(r).toBeCloseTo(0.017453, 6);
    expect(r).toBeLessThan(0.1);
  });

  /**
   * Le cas réaliste, et celui qui trahirait l'erreur : un virage pris à 30 m/s
   * sur 100 m de rayon tourne à environ 17 °/s. En radians la courbure vaut
   * 0,01 (soit R = 100 m) ; en degrés elle vaudrait 0,57, soit un rayon de
   * 1,75 m — un tourniquet.
   */
  it('un virage de 100 m rendu en courbure donne bien 100 m', () => {
    const w = frameRowToSessionFrame(ligne(17.1887)).yawRateRadS!;
    const vitesseMs = 30;
    expect(w / vitesseMs).toBeCloseTo(0.01, 5);
    expect(1 / (w / vitesseMs)).toBeCloseTo(100, 1);
  });

  it('le signe est conservé — il porte le sens du virage', () => {
    expect(frameRowToSessionFrame(ligne(-45)).yawRateRadS!).toBeLessThan(0);
  });

  it('lacet absent → null, jamais zéro : zéro dirait « la voiture va tout droit »', () => {
    expect(frameRowToSessionFrame(ligne(null)).yawRateRadS).toBeNull();
  });

  /** Colonne non demandée par le `select` : on ne sait pas, donc `null`. */
  it('colonne absente de la requête → null', () => {
    expect(frameRowToSessionFrame(ligne(undefined)).yawRateRadS).toBeNull();
  });
});
