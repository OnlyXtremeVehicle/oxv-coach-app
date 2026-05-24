/**
 * Tests de la projection GPS → SVG.
 *
 * Vérifie la convention (latitude inversée), les coins du bbox, le clamp,
 * et la construction du path SVG.
 */

import {
  type BoundingBox,
  type SvgViewBox,
  geoPolylineToSvg,
  geoToSvg,
  polylineToPathD,
} from '../geoToSvg';

const BELTOISE_BBOX: BoundingBox = {
  minLat: 45.6002,
  maxLat: 45.6023,
  minLon: -0.144,
  maxLon: -0.1379,
};

const VIEWBOX: SvgViewBox = { width: 1000, height: 600 };

describe('geoToSvg', () => {
  it('projette le coin sud-ouest sur (0, height)', () => {
    const p = geoToSvg(BELTOISE_BBOX.minLat, BELTOISE_BBOX.minLon, BELTOISE_BBOX, VIEWBOX);
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(0, 1);
    expect(p!.y).toBeCloseTo(VIEWBOX.height, 1);
  });

  it('projette le coin nord-est sur (width, 0)', () => {
    const p = geoToSvg(BELTOISE_BBOX.maxLat, BELTOISE_BBOX.maxLon, BELTOISE_BBOX, VIEWBOX);
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(VIEWBOX.width, 1);
    expect(p!.y).toBeCloseTo(0, 1);
  });

  it('projette le centre du bbox au centre du viewBox', () => {
    const midLat = (BELTOISE_BBOX.minLat + BELTOISE_BBOX.maxLat) / 2;
    const midLon = (BELTOISE_BBOX.minLon + BELTOISE_BBOX.maxLon) / 2;
    const p = geoToSvg(midLat, midLon, BELTOISE_BBOX, VIEWBOX);
    expect(p!.x).toBeCloseTo(VIEWBOX.width / 2, 1);
    expect(p!.y).toBeCloseTo(VIEWBOX.height / 2, 1);
  });

  it('clamp les points hors bbox sans retourner null', () => {
    const p = geoToSvg(
      BELTOISE_BBOX.maxLat + 0.01,
      BELTOISE_BBOX.maxLon + 0.01,
      BELTOISE_BBOX,
      VIEWBOX
    );
    expect(p).not.toBeNull();
    expect(p!.x).toBe(VIEWBOX.width);
    expect(p!.y).toBe(0);
  });

  it('renvoie null si le bbox est dégénéré', () => {
    const degenerate: BoundingBox = {
      minLat: 45.6,
      maxLat: 45.6,
      minLon: -0.14,
      maxLon: -0.14,
    };
    expect(geoToSvg(45.6, -0.14, degenerate, VIEWBOX)).toBeNull();
  });
});

describe('geoPolylineToSvg', () => {
  it('projette une liste de points en préservant lordre', () => {
    const pts = [
      { lat: BELTOISE_BBOX.minLat, lon: BELTOISE_BBOX.minLon },
      { lat: BELTOISE_BBOX.maxLat, lon: BELTOISE_BBOX.maxLon },
    ];
    const projected = geoPolylineToSvg(pts, BELTOISE_BBOX, VIEWBOX);
    expect(projected).toHaveLength(2);
    expect(projected[0].y).toBeCloseTo(VIEWBOX.height, 1);
    expect(projected[1].y).toBeCloseTo(0, 1);
  });
});

describe('polylineToPathD', () => {
  it('renvoie une chaîne vide pour une polyligne vide', () => {
    expect(polylineToPathD([])).toBe('');
  });

  it('génère M sans L pour un seul point', () => {
    expect(polylineToPathD([{ x: 10, y: 20 }])).toBe('M 10.00,20.00');
  });

  it('génère M puis L pour plusieurs points', () => {
    const d = polylineToPathD([
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      { x: 200, y: 75 },
    ]);
    expect(d).toBe('M 0.00,0.00 L 100.00,50.00 L 200.00,75.00');
  });
});
