import { buildGraphHopperBody, parseGhResponse } from '../scenicRouteService';
import type { ScenicRouteRequest } from '../types';

// Le module ne lit que `./types` (types purs) + process.env/fetch/console au
// runtime : il se charge en Node sans mock. On ne teste ici que la logique pure
// (construction du corps POST GraphHopper + parsing de réponse).

describe('buildGraphHopperBody', () => {
  const start = { lat: 45.2415, lon: -0.0915 }; // Beltoise

  it('encode la sinuosité réelle via custom_model (très sinueuse → MOTORWAY 0.02)', () => {
    const req: ScenicRouteRequest = { start, curviness: 'tres_sinueuse' };
    const body = buildGraphHopperBody(req);
    expect(body.custom_model.priority).toContainEqual({
      if: 'road_class == MOTORWAY',
      multiply_by: '0.02',
    });
  });

  it('met les points en [lon, lat] (et non [lat, lon])', () => {
    const body = buildGraphHopperBody({ start, curviness: 'sinueuse' });
    expect(body.points[0]).toEqual([start.lon, start.lat]);
    // garde-fou explicite : la longitude vient en premier
    expect(body.points[0][0]).toBe(-0.0915);
    expect(body.points[0][1]).toBe(45.2415);
  });

  it('respecte l’ordre départ → waypoints → arrivée, toujours en [lon, lat]', () => {
    const wp = { lat: 45.3, lon: -0.2 };
    const end = { lat: 45.5, lon: -0.5 };
    const body = buildGraphHopperBody({ start, waypoints: [wp], end, curviness: 'douce' });
    expect(body.points).toEqual([
      [start.lon, start.lat],
      [wp.lon, wp.lat],
      [end.lon, end.lat],
    ]);
  });

  it('désactive CH et cible le profil voiture', () => {
    const body = buildGraphHopperBody({ start });
    expect(body['ch.disable']).toBe(true);
    expect(body.profile).toBe('car');
    expect(body.points_encoded).toBe(false);
  });

  it('défaut de sinuosité = sinueuse', () => {
    const dflt = buildGraphHopperBody({ start });
    const sinueuse = buildGraphHopperBody({ start, curviness: 'sinueuse' });
    expect(dflt.custom_model.priority).toEqual(sinueuse.custom_model.priority);
  });
});

describe('parseGhResponse', () => {
  it('mappe une réponse GraphHopper vers une ScenicRoute (coords {lat,lon})', () => {
    const json = {
      paths: [
        {
          distance: 1000, // m → 1 km
          time: 60000, // ms → 1 min
          points: {
            coordinates: [
              [-0.0915, 45.2415],
              [-0.0925, 45.2515],
            ] as [number, number][],
          },
        },
      ],
    };
    const route = parseGhResponse(json, 'graphhopper');
    expect(route).not.toBeNull();
    if (!route) return;
    // coordinates reviennent en {lat, lon} (et non l'ordre brut [lon, lat])
    expect(route.coordinates[0]).toEqual({ lat: 45.2415, lon: -0.0915 });
    expect(route.distanceKm).toBeCloseTo(1, 5);
    expect(route.durationMin).toBeCloseTo(1, 5);
    expect(route.sinuosity).toBeGreaterThanOrEqual(1);
    expect(route.provider).toBe('graphhopper');
  });

  it('renvoie null si moins de deux points', () => {
    const json = {
      paths: [{ distance: 0, time: 0, points: { coordinates: [] as [number, number][] } }],
    };
    expect(parseGhResponse(json, 'graphhopper')).toBeNull();
  });
});
