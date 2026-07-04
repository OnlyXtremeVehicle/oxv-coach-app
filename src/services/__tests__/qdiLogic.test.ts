import {
  QDI_ALGO_VERSION,
  computeAcceleration,
  computeFluidite,
  computeFreinage,
  computeQdi,
  computeRegularite,
  computeTrajectoire,
  medianBranches,
  type QdiFrame,
  type QdiLapWindow,
} from '@/services/qdiLogic';

function frames(gLats: number[], gLongs?: number[]): QdiFrame[] {
  return gLats.map((g, i) => ({
    elapsedMs: i * 40,
    lat: null,
    lon: null,
    gLat: g,
    gLong: gLongs ? (gLongs[i] ?? 0) : 0,
  }));
}

describe('computeRegularite (écart-type entre tours)', () => {
  it('tours identiques → 100 ; null sous 3 tours (honnêteté)', () => {
    expect(computeRegularite([90, 90, 90, 90])).toBe(100);
    expect(computeRegularite([90, 91])).toBeNull();
    expect(computeRegularite([])).toBeNull();
  });

  it('plus dispersé = score plus bas (monotone)', () => {
    const tight = computeRegularite([90, 90.5, 91, 90.2])!;
    const loose = computeRegularite([85, 95, 90, 100])!;
    expect(tight).toBeGreaterThan(loose);
  });
});

describe('computeFluidite (douceur latérale, proxy IMU)', () => {
  it('null sous 50 trames valides', () => {
    expect(computeFluidite(frames(Array(30).fill(0.5)))).toBeNull();
  });

  it('G_lat lisse bat G_lat haché', () => {
    const smooth = Array.from({ length: 200 }, (_, i) => Math.sin(i / 20));
    const jerky = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 0.8 : -0.8));
    expect(computeFluidite(frames(smooth))!).toBeGreaterThan(computeFluidite(frames(jerky))!);
  });
});

describe('phases longitudinales (freinage / accélération)', () => {
  it('null sans au moins 3 phases (honnêteté)', () => {
    expect(computeFreinage(frames(Array(100).fill(0)))).toBeNull();
    expect(computeAcceleration(frames(Array(100).fill(0)))).toBeNull();
  });

  it('freinage progressif bat freinage brutal', () => {
    // 4 phases de freinage : descente régulière vs oscillation brutale
    const gentle: number[] = [];
    const harsh: number[] = [];
    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < 12; i++) {
        gentle.push(-0.3 - i * 0.01);
        harsh.push(i % 2 === 0 ? -0.3 : -0.9);
      }
      for (let i = 0; i < 10; i++) {
        gentle.push(0);
        harsh.push(0);
      }
    }
    const sGentle = computeFreinage(frames(Array(gentle.length).fill(0), gentle))!;
    const sHarsh = computeFreinage(frames(Array(harsh.length).fill(0), harsh))!;
    expect(sGentle).toBeGreaterThan(sHarsh);
  });
});

describe('computeTrajectoire (répétabilité des lignes)', () => {
  const lapWindow = (i: number): QdiLapWindow => ({
    startMs: i * 100_000,
    endMs: (i + 1) * 100_000 - 1,
    durationSeconds: 100,
  });

  function circleLap(lapIndex: number, radiusM: number, offsetM: number): QdiFrame[] {
    // Cercle ~500 m de rayon autour d'un point, décalé de offsetM vers l'est.
    const out: QdiFrame[] = [];
    const latC = 45.0;
    const lonC = 0.5 + offsetM / (111_320 * Math.cos((latC * Math.PI) / 180));
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * 2 * Math.PI;
      out.push({
        elapsedMs: lapIndex * 100_000 + i * 1000,
        lat: latC + (Math.cos(a) * radiusM) / 111_320,
        lon: lonC + (Math.sin(a) * radiusM) / (111_320 * Math.cos((latC * Math.PI) / 180)),
        gLat: null,
        gLong: null,
      });
    }
    return out;
  }

  it('null avec moins de 2 tours exploitables', () => {
    expect(computeTrajectoire(circleLap(0, 500, 0), [lapWindow(0)])).toBeNull();
  });

  it('lignes identiques battent lignes décalées', () => {
    const same = [...circleLap(0, 500, 0), ...circleLap(1, 500, 0)];
    const shifted = [...circleLap(0, 500, 0), ...circleLap(1, 500, 6)];
    const windows = [lapWindow(0), lapWindow(1)];
    expect(computeTrajectoire(same, windows)!).toBeGreaterThan(
      computeTrajectoire(shifted, windows)!
    );
    expect(computeTrajectoire(same, windows)).toBe(100);
  });
});

describe('computeQdi (assemblage) + medianBranches (référence self-only)', () => {
  it('estampille algo_version et rend null les branches sans données', () => {
    const res = computeQdi([], []);
    expect(res.algoVersion).toBe(QDI_ALGO_VERSION);
    expect(res.trajectoire).toBeNull();
    expect(res.fluidite).toBeNull();
    expect(res.freinage).toBeNull();
    expect(res.acceleration).toBeNull();
    expect(res.regularite).toBeNull();
  });

  it('médiane par branche, null si aucun historique de la branche', () => {
    const m = medianBranches([
      { trajectoire: 60, fluidite: null, freinage: 40, acceleration: 80, regularite: 70 },
      { trajectoire: 80, fluidite: null, freinage: 60, acceleration: 90, regularite: 90 },
      { trajectoire: 70, fluidite: null, freinage: 50, acceleration: 70, regularite: 80 },
    ]);
    expect(m.trajectoire).toBe(70);
    expect(m.fluidite).toBeNull();
    expect(m.freinage).toBe(50);
    expect(m.regularite).toBe(80);
  });
});
