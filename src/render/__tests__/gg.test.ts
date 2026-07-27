import { buildGgCloud, reachedEnvelope, type GgSample } from '../gg';

describe('buildGgCloud — garanties', () => {
  it('rend null sans aucun échantillon exploitable — l’absence n’est pas un nuage vide', () => {
    expect(buildGgCloud([])).toBeNull();
    expect(buildGgCloud([{ long: NaN, lat: 0 }])).toBeNull();
    expect(buildGgCloud([{ long: 0, lat: Infinity }])).toBeNull();
  });

  it('compte les échartés sans les confondre avec les retenus', () => {
    const c = buildGgCloud([
      { long: 0.5, lat: 0.2 },
      { long: NaN, lat: 0.2 },
      { long: 0.1, lat: Infinity },
    ])!;
    expect(c.total).toBe(1);
    expect(c.rejected).toBe(2);
  });

  it('n’émet que les cases non vides', () => {
    const c = buildGgCloud([{ long: 0.5, lat: 0.5 }], { resolution: 20 })!;
    expect(c.bins).toHaveLength(1);
    expect(c.bins[0].count).toBe(1);
  });

  it('regroupe les échantillons proches dans la même case', () => {
    const s: GgSample[] = Array.from({ length: 10 }, () => ({ long: 0.51, lat: 0.49 }));
    const c = buildGgCloud(s, { resolution: 10 })!;
    expect(c.bins).toHaveLength(1);
    expect(c.bins[0].count).toBe(10);
    expect(c.peak).toBe(10);
  });

  it('place le centre de case au bon endroit', () => {
    // Domaine [-2, 2], 4 cases → largeur 1 g, centres à -1.5, -0.5, 0.5, 1.5.
    const c = buildGgCloud([{ long: 0.7, lat: -1.2 }], { range: 2, resolution: 4 })!;
    expect(c.bins[0].lat).toBeCloseTo(-1.5, 9);
    expect(c.bins[0].long).toBeCloseTo(0.5, 9);
  });

  it('rabat les échantillons hors domaine sur le bord plutôt que de les effacer', () => {
    const c = buildGgCloud([{ long: 50, lat: -50 }], { range: 2, resolution: 8 })!;
    expect(c.total).toBe(1);
    expect(c.rejected).toBe(0);
    expect(c.bins[0].ix).toBe(0);
    expect(c.bins[0].iy).toBe(7);
  });

  it('rend un ordre stable, indépendant de l’ordre d’entrée', () => {
    const a: GgSample[] = [
      { long: 1, lat: 1 },
      { long: -1, lat: -1 },
      { long: 0, lat: 0.5 },
    ];
    const c1 = buildGgCloud(a, { resolution: 16 })!;
    const c2 = buildGgCloud([...a].reverse(), { resolution: 16 })!;
    expect(c1.bins).toEqual(c2.bins);
  });

  it('refuse une étendue nulle ou négative', () => {
    expect(buildGgCloud([{ long: 0, lat: 0 }], { range: 0 })).toBeNull();
    expect(buildGgCloud([{ long: 0, lat: 0 }], { range: -1 })).toBeNull();
  });

  it('garde toutes les cases dans la grille', () => {
    const s: GgSample[] = [];
    for (let i = 0; i < 500; i++) {
      s.push({ long: Math.sin(i) * 3, lat: Math.cos(i * 1.7) * 3 });
    }
    const c = buildGgCloud(s, { range: 2, resolution: 32 })!;
    for (const b of c.bins) {
      expect(b.ix).toBeGreaterThanOrEqual(0);
      expect(b.ix).toBeLessThan(32);
      expect(b.iy).toBeGreaterThanOrEqual(0);
      expect(b.iy).toBeLessThan(32);
    }
    expect(c.bins.reduce((t, b) => t + b.count, 0)).toBe(c.total);
  });
});

describe('reachedEnvelope — enveloppe ATTEINTE, pas limite', () => {
  it('rend null sans échantillon exploitable', () => {
    expect(reachedEnvelope([])).toBeNull();
    expect(reachedEnvelope([{ long: NaN, lat: NaN }])).toBeNull();
  });

  it('rend un secteur par pas demandé', () => {
    const e = reachedEnvelope([{ long: -1, lat: 0 }], 12)!;
    expect(e).toHaveLength(12);
  });

  // La convention d'axes est VERROUILLÉE : l'inverser retournerait le nuage
  // sans qu'aucune erreur ne soit levée, et un freinage se lirait comme une
  // relance.
  it('place le plein freinage à 0° et l’appui droit à 90°', () => {
    const e = reachedEnvelope([{ long: -1, lat: 0 }], 4)!;
    // 4 secteurs de 90°, centrés sur 45, 135, 225, 315.
    expect(e[0].count).toBe(1); // secteur [0, 90) → freinage
    expect(e[0].reached).toBeCloseTo(1, 9);

    const droite = reachedEnvelope([{ long: 0, lat: 1 }], 4)!;
    expect(droite[0].count + droite[1].count).toBe(1);
    // Exactement 90° tombe à la frontière du secteur 1.
    expect(droite[1].count).toBe(1);

    const relance = reachedEnvelope([{ long: 1, lat: 0 }], 4)!;
    expect(relance[2].count).toBe(1); // 180° → relance

    const gauche = reachedEnvelope([{ long: 0, lat: -1 }], 4)!;
    expect(gauche[3].count).toBe(1); // 270° → appui gauche
  });

  it('retient la plus grande magnitude du secteur', () => {
    const e = reachedEnvelope(
      [
        { long: -0.3, lat: 0 },
        { long: -0.9, lat: 0 },
        { long: -0.5, lat: 0 },
      ],
      4
    )!;
    expect(e[0].reached).toBeCloseTo(0.9, 9);
    expect(e[0].count).toBe(3);
  });

  // Le point doctrinal : ne pas confondre « jamais allé par là » avec
  // « allé par là tout doucement ».
  it('distingue un secteur jamais sollicité d’un secteur peu sollicité', () => {
    const e = reachedEnvelope([{ long: -1, lat: 0 }], 4)!;
    const jamais = e[2];
    expect(jamais.reached).toBe(0);
    expect(jamais.count).toBe(0);

    const doux = reachedEnvelope(
      [
        { long: -1, lat: 0 },
        { long: 0.01, lat: 0 },
      ],
      4
    )!;
    expect(doux[2].count).toBe(1);
    expect(doux[2].reached).toBeGreaterThan(0);
  });

  it('ignore un échantillon parfaitement nul — à l’arrêt, aucune direction n’est sollicitée', () => {
    const e = reachedEnvelope(
      [
        { long: 0, lat: 0 },
        { long: -1, lat: 0 },
      ],
      4
    )!;
    expect(e.reduce((t, s) => t + s.count, 0)).toBe(1);
  });

  it('rend des secteurs alignés et dans [0, 360)', () => {
    const e = reachedEnvelope([{ long: -1, lat: 0 }], 36)!;
    for (const s of e) {
      expect(s.angle).toBeGreaterThanOrEqual(0);
      expect(s.angle).toBeLessThan(360);
      expect(s.reached).toBeGreaterThanOrEqual(0);
    }
    expect(e[0].angle).toBeCloseTo(5, 9);
  });

  it('couvre tous les échantillons répartis sur le cercle', () => {
    const s: GgSample[] = [];
    for (let a = 0; a < 360; a += 5) {
      const r = (a * Math.PI) / 180;
      s.push({ long: -Math.cos(r), lat: Math.sin(r) });
    }
    const e = reachedEnvelope(s, 36)!;
    expect(e.reduce((t, x) => t + x.count, 0)).toBe(s.length);
    for (const sect of e) expect(sect.reached).toBeCloseTo(1, 6);
  });
});
