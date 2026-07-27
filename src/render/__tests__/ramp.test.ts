import { buildRamp, hexVersRgb, oklabVersRgb, rgbVersHex, rgbVersOklab, type Rgb } from '../ramp';

const NOIR: Rgb = { r: 0, g: 0, b: 0 };
const BLANC: Rgb = { r: 1, g: 1, b: 1 };

describe('conversions sRGB ↔ Oklab', () => {
  // Le critère n'est pas un nombre de décimales arbitraire mais le seul qui ait
  // un sens ici : la dérive doit rester sous le PAS DE QUANTIFICATION 8 bits
  // (1/255). En deçà, l'aller-retour ne peut pas changer un seul octet affiché.
  it('fait l’aller-retour sans changer un seul octet affiché', () => {
    const PAS_8_BITS = 1 / 255;
    const echantillons: Rgb[] = [
      NOIR,
      BLANC,
      { r: 1, g: 0, b: 0 },
      { r: 0, g: 1, b: 0 },
      { r: 0, g: 0, b: 1 },
      { r: 0.2, g: 0.55, b: 0.87 },
      { r: 0.83, g: 0.69, b: 0.22 },
    ];
    for (const c of echantillons) {
      const retour = oklabVersRgb(rgbVersOklab(c));
      expect(Math.abs(retour.r - c.r)).toBeLessThan(PAS_8_BITS / 2);
      expect(Math.abs(retour.g - c.g)).toBeLessThan(PAS_8_BITS / 2);
      expect(Math.abs(retour.b - c.b)).toBeLessThan(PAS_8_BITS / 2);
      // Et la preuve directe : l'octet écrit est identique.
      expect(rgbVersHex(retour)).toBe(rgbVersHex(c));
    }
  });

  it('place le noir en L=0 et le blanc en L=1', () => {
    expect(rgbVersOklab(NOIR).L).toBeCloseTo(0, 6);
    expect(rgbVersOklab(BLANC).L).toBeCloseTo(1, 6);
  });

  it('donne a et b nuls sur un gris — un gris n’a pas de teinte', () => {
    const lab = rgbVersOklab({ r: 0.5, g: 0.5, b: 0.5 });
    expect(lab.a).toBeCloseTo(0, 6);
    expect(lab.b).toBeCloseTo(0, 6);
  });

  it('borne les couleurs hors gamut plutôt que de rendre des composantes folles', () => {
    const c = oklabVersRgb({ L: 0.5, a: 0.6, b: -0.6 });
    for (const v of [c.r, c.g, c.b]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('buildRamp — garanties', () => {
  it('rend null en dessous de deux arrêts — une rampe ne s’invente pas', () => {
    expect(buildRamp([])).toBeNull();
    expect(buildRamp([{ at: 0, color: NOIR }])).toBeNull();
  });

  it('rend exactement les couleurs d’arrêt à leurs positions', () => {
    const rouge: Rgb = { r: 0.9, g: 0.2, b: 0.2 };
    const bleu: Rgb = { r: 0.2, g: 0.4, b: 0.9 };
    const r = buildRamp([
      { at: 0, color: rouge },
      { at: 1, color: bleu },
    ])!;
    expect(r.at(0)).toEqual(rouge);
    expect(r.at(1)).toEqual(bleu);
  });

  it('borne aux extrémités hors de [0, 1]', () => {
    const r = buildRamp([
      { at: 0, color: NOIR },
      { at: 1, color: BLANC },
    ])!;
    expect(r.at(-5)).toEqual(NOIR);
    expect(r.at(42)).toEqual(BLANC);
  });

  it('résiste à NaN sans rendre une couleur folle', () => {
    const r = buildRamp([
      { at: 0, color: NOIR },
      { at: 1, color: BLANC },
    ])!;
    expect(r.at(NaN)).toEqual(NOIR);
  });

  it('trie les arrêts fournis en désordre', () => {
    const r = buildRamp([
      { at: 1, color: BLANC },
      { at: 0, color: NOIR },
    ])!;
    expect(r.stops.map((s) => s.at)).toEqual([0, 1]);
    expect(r.at(0)).toEqual(NOIR);
  });

  it('gère quatre arrêts et respecte chaque palier', () => {
    const stops = [
      { at: 0, color: { r: 0.1, g: 0.1, b: 0.4 } },
      { at: 0.33, color: { r: 0.2, g: 0.6, b: 0.8 } },
      { at: 0.66, color: { r: 0.9, g: 0.8, b: 0.3 } },
      { at: 1, color: { r: 0.95, g: 0.95, b: 0.95 } },
    ];
    const r = buildRamp(stops)!;
    for (const s of stops) expect(r.at(s.at)).toEqual(s.color);
  });

  it('supporte deux arrêts confondus sans diviser par zéro', () => {
    const r = buildRamp([
      { at: 0, color: NOIR },
      { at: 0.5, color: BLANC },
      { at: 0.5, color: NOIR },
      { at: 1, color: BLANC },
    ])!;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const c = r.at(t);
      expect(Number.isFinite(c.r)).toBe(true);
      expect(Number.isFinite(c.g)).toBe(true);
      expect(Number.isFinite(c.b)).toBe(true);
    }
  });
});

describe('buildRamp — le point du module : régularité perceptuelle', () => {
  it('progresse en luminance de façon monotone entre deux arrêts', () => {
    const r = buildRamp([
      { at: 0, color: NOIR },
      { at: 1, color: BLANC },
    ])!;
    let precedent = -Infinity;
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const L = rgbVersOklab(r.at(Math.min(t, 1))).L;
      expect(L).toBeGreaterThanOrEqual(precedent - 1e-9);
      precedent = L;
    }
  });

  it('progresse en luminance par pas RÉGULIERS — ce que sRGB ne fait pas', () => {
    const r = buildRamp([
      { at: 0, color: NOIR },
      { at: 1, color: BLANC },
    ])!;
    const pas: number[] = [];
    for (let i = 0; i < 20; i++) {
      const a = rgbVersOklab(r.at(i / 20)).L;
      const b = rgbVersOklab(r.at((i + 1) / 20)).L;
      pas.push(b - a);
    }
    const min = Math.min(...pas);
    const max = Math.max(...pas);
    expect(max - min).toBeLessThan(1e-6);
  });

  // Le défaut que ce module existe pour éviter : la bande sombre au passage
  // entre deux teintes vives, artefact d'une interpolation en sRGB.
  it('ne creuse pas de bande sombre entre deux teintes vives', () => {
    const bleu: Rgb = { r: 0.15, g: 0.35, b: 0.9 };
    const jaune: Rgb = { r: 0.95, g: 0.85, b: 0.2 };
    const r = buildRamp([
      { at: 0, color: bleu },
      { at: 1, color: jaune },
    ])!;

    const lBleu = rgbVersOklab(bleu).L;
    const lJaune = rgbVersOklab(jaune).L;
    const plancher = Math.min(lBleu, lJaune);

    for (let t = 0; t <= 1.0001; t += 0.05) {
      const L = rgbVersOklab(r.at(Math.min(t, 1))).L;
      // Jamais plus sombre que la plus sombre des deux bornes.
      expect(L).toBeGreaterThanOrEqual(plancher - 1e-9);
    }
  });

  it('interpole vraiment — le milieu n’est aucune des deux bornes', () => {
    const r = buildRamp([
      { at: 0, color: { r: 0.1, g: 0.2, b: 0.8 } },
      { at: 1, color: { r: 0.9, g: 0.7, b: 0.1 } },
    ])!;
    const milieu = r.at(0.5);
    expect(milieu).not.toEqual(r.at(0));
    expect(milieu).not.toEqual(r.at(1));
  });
});

describe('formats hexadécimaux', () => {
  it('lit avec ou sans dièse, quelle que soit la casse', () => {
    expect(hexVersRgb('#ffffff')).toEqual(BLANC);
    expect(hexVersRgb('FFFFFF')).toEqual(BLANC);
    expect(hexVersRgb('  #000000 ')).toEqual(NOIR);
  });

  it('rend null sur une entrée invalide plutôt qu’une couleur par défaut', () => {
    expect(hexVersRgb('#fff')).toBeNull();
    expect(hexVersRgb('bleu')).toBeNull();
    expect(hexVersRgb('#gggggg')).toBeNull();
  });

  it('fait l’aller-retour hex → rgb → hex', () => {
    for (const h of ['#000000', '#ffffff', '#1a2b3c', '#d4af37']) {
      expect(rgbVersHex(hexVersRgb(h)!)).toBe(h);
    }
  });
});
