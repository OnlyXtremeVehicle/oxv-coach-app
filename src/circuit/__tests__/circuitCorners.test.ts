/**
 * Virages par circuit — tests sur GÉOMÉTRIE RÉELLE (repères multi-circuit,
 * build 23).
 *
 * Trois garanties, une par source de virages :
 *   1. Haute Saintonge → la topologie NOMMÉE (7 virages Beltoise), sans
 *      jamais toucher au réseau ;
 *   2. autre circuit → virages DÉRIVÉS du tracé réel : la fixture est la
 *      centerline de Ricardo Tormo (Valence) reconstruite depuis
 *      `src/circuit/data/ricardo-tormo.geojson` — les 3 ways OSM chaînées,
 *      soit les MÊMES 135 points que la colonne `circuits.centerline_latlon`
 *      en base (cf. docs/SQL_CALIBRATION_RICARDO_TORMO.sql). Le circuit réel
 *      compte 14 virages (9 gauches, 5 droites) : la dérivation doit les
 *      retrouver, pas les inventer ;
 *   3. pas de centerline → [] (l'écran affiche un état honnête).
 *
 * Source géométrie : OpenStreetMap © contributeurs OSM (ODbL).
 */

import fs from 'fs';
import path from 'path';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';

import type { LatLon } from '../circuitGenerator';
import {
  cornersForCircuit,
  deriveCornersFromCenterline,
  hauteSaintongeCorners,
  isHauteSaintonge,
} from '../circuitCorners';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture : centerline Ricardo Tormo, reconstruite comme en base (135 points)
// ─────────────────────────────────────────────────────────────────────────────

interface GeoFeature {
  properties: Record<string, string | undefined>;
  geometry: { type: string; coordinates: unknown };
}

function loadTormoTrackWays(): LatLon[][] {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'ricardo-tormo.geojson'), 'utf8');
  const fc = JSON.parse(raw) as { features: GeoFeature[] };
  const ways = fc.features
    .filter(
      (f) => f.geometry.type === 'LineString' && f.properties.name === 'Circuit Ricardo Tormo'
    )
    .map((f) => (f.geometry.coordinates as [number, number][]).map(([lon, lat]) => ({ lat, lon })));
  if (ways.length === 0)
    throw new Error('Aucune way « Circuit Ricardo Tormo » — GeoJSON inattendu');
  return ways;
}

const samePoint = (a: LatLon, b: LatLon): boolean =>
  Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lon - b.lon) < 1e-9;

/**
 * Chaîne les ways OSM (extrémités partagées dédupliquées) en une seule
 * polyligne — la même opération que le chaînage « 135 points » réalisé pour
 * remplir `circuits.centerline_latlon` en base.
 */
function chainWays(ways: LatLon[][]): LatLon[] {
  const rest = ways.map((w) => [...w]);
  let chain = rest.shift() ?? [];
  while (rest.length > 0) {
    const i = rest.findIndex(
      (w) =>
        samePoint(chain[chain.length - 1], w[0]) ||
        samePoint(chain[chain.length - 1], w[w.length - 1]) ||
        samePoint(chain[0], w[0]) ||
        samePoint(chain[0], w[w.length - 1])
    );
    if (i < 0) throw new Error('Ways non chaînables — GeoJSON inattendu');
    const [w] = rest.splice(i, 1);
    if (samePoint(chain[chain.length - 1], w[0])) chain = [...chain, ...w.slice(1)];
    else if (samePoint(chain[chain.length - 1], w[w.length - 1]))
      chain = [...chain, ...[...w].reverse().slice(1)];
    else if (samePoint(chain[0], w[w.length - 1])) chain = [...w.slice(0, -1), ...chain];
    else chain = [...[...w].reverse().slice(0, -1), ...chain];
  }
  return chain;
}

const TORMO_CENTERLINE = chainWays(loadTormoTrackWays());

// ─────────────────────────────────────────────────────────────────────────────
// 0. La fixture elle-même : même géométrie que la base
// ─────────────────────────────────────────────────────────────────────────────

describe('fixture Ricardo Tormo (chaînage des ways OSM)', () => {
  it('reconstruit les 135 points chaînés de la base, en boucle fermée', () => {
    expect(TORMO_CENTERLINE).toHaveLength(135);
    expect(samePoint(TORMO_CENTERLINE[0], TORMO_CENTERLINE[TORMO_CENTERLINE.length - 1])).toBe(
      true
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Haute Saintonge : topologie nommée, 7 virages
// ─────────────────────────────────────────────────────────────────────────────

describe('isHauteSaintonge', () => {
  it('reconnaît le circuit et ses variantes (accents, BACKUP)', () => {
    expect(isHauteSaintonge({ name: 'Circuit de Haute Saintonge' })).toBe(true);
    expect(isHauteSaintonge({ name: 'CIRCUIT DE HAUTE SAINTONGE — BACKUP' })).toBe(true);
    expect(isHauteSaintonge({ name: 'Circuit de Hauté Saintongé' })).toBe(true);
  });

  it('ne confond pas un autre circuit', () => {
    expect(isHauteSaintonge({ name: 'Circuit Ricardo Tormo' })).toBe(false);
  });
});

describe('cornersForCircuit — Haute Saintonge', () => {
  it('retourne les 7 virages NOMMÉS de la topologie Beltoise', () => {
    const corners = hauteSaintongeCorners();
    expect(corners).toHaveLength(7);
    expect(corners.map((c) => c.index)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(corners.map((c) => c.name)).toEqual(BELTOISE_CORNERS.map((c) => c.name));
    for (const corner of corners) {
      expect(corner.pace).not.toBeNull();
      expect(corner.direction).toBe('unknown');
      expect(corner.radiusM).toBeNull();
    }
  });

  it('ne touche JAMAIS au réseau pour la topologie nommée', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('ne doit pas être appelé'));
    const corners = await cornersForCircuit(
      { id: 'hs-id', name: 'Circuit de Haute Saintonge' },
      fetcher
    );
    expect(corners).toHaveLength(7);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Autre circuit : virages dérivés du tracé réel
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveCornersFromCenterline — Ricardo Tormo (Valence)', () => {
  const corners = deriveCornersFromCenterline(TORMO_CENTERLINE);

  it('retrouve les 14 virages réels du circuit dans sa géométrie', () => {
    // Le circuit Ricardo Tormo compte officiellement 14 virages : 9 gauches,
    // 5 droites. La dérivation par courbure doit les retrouver — ni plus
    // (virages hachés), ni moins (enchaînements fusionnés).
    expect(corners).toHaveLength(14);
    expect(corners.filter((c) => c.direction === 'left')).toHaveLength(9);
    expect(corners.filter((c) => c.direction === 'right')).toHaveLength(5);
  });

  it('numérote 1..N et libelle « Virage N (gauche/droite) »', () => {
    expect(corners.map((c) => c.index)).toEqual(corners.map((_, i) => i + 1));
    for (const corner of corners) {
      expect(corner.name).toBe(
        `Virage ${corner.index} (${corner.direction === 'left' ? 'gauche' : 'droite'})`
      );
      expect(corner.pace).toBeNull();
    }
  });

  it('porte un rayon estimé réel (fini, positif) pour chaque virage', () => {
    for (const corner of corners) {
      expect(corner.radiusM).not.toBeNull();
      expect(corner.radiusM as number).toBeGreaterThan(0);
      expect(Number.isFinite(corner.radiusM)).toBe(true);
    }
  });

  it('est déterministe (même tracé → mêmes virages)', () => {
    expect(deriveCornersFromCenterline(TORMO_CENTERLINE)).toEqual(corners);
  });
});

describe('cornersForCircuit — circuit avec centerline en base', () => {
  it('dérive les virages depuis la centerline lue (fetcher injecté)', async () => {
    const fetcher = jest.fn().mockResolvedValue(TORMO_CENTERLINE);
    const corners = await cornersForCircuit(
      { id: 'tormo-id', name: 'Circuit Ricardo Tormo' },
      fetcher
    );
    expect(fetcher).toHaveBeenCalledWith('tormo-id');
    expect(corners).toHaveLength(14);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pas de centerline : aucun virage inventé
// ─────────────────────────────────────────────────────────────────────────────

describe('cornersForCircuit — sans tracé exploitable', () => {
  it('centerline absente (null) → []', async () => {
    const fetcher = jest.fn().mockResolvedValue(null);
    await expect(cornersForCircuit({ id: 'x', name: 'Circuit inconnu' }, fetcher)).resolves.toEqual(
      []
    );
  });

  it('centerline vide → []', async () => {
    const fetcher = jest.fn().mockResolvedValue([]);
    await expect(cornersForCircuit({ id: 'x', name: 'Circuit inconnu' }, fetcher)).resolves.toEqual(
      []
    );
  });

  it('tracé dégénéré (< 4 points) → []', () => {
    expect(deriveCornersFromCenterline(TORMO_CENTERLINE.slice(0, 3))).toEqual([]);
  });
});
