/**
 * A-FLOW-1 — tests de `flowLogic`.
 *
 * Ces tests vérifient des INVARIANTS, jamais un seuil. C'est une exigence du
 * contrat (docs/architecture/A-FLOW-1_flowService_definition.md §2.1) : les
 * coefficients de la sévérité se calent sur les données RÉELLES (smoke test,
 * distribution Beltoise). Poser ici une valeur attendue « fluide » reviendrait à
 * décréter une frontière que le réel invalidera — et à noter, ce que la doctrine
 * interdit. On teste donc des relations d'ORDRE et de STRUCTURE, qui restent
 * vraies quel que soit le calage :
 *   — une transition justifiée laisse moins de résiduel qu'un à-coup injustifié ;
 *   — un signal lissé laisse moins de résiduel qu'un signal bruité ;
 *   — la même entrée donne la même sortie ;
 *   — l'avenir ne change pas le passé.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  computeFlowTrace,
  explainedJerkGPerS,
  jerkDistribution,
  meanResidualGPerS,
  segmentIntensity,
  DEFAULT_BIN_WIDTH_G_PER_S,
  DEFAULT_SEVERITY_WEIGHTS,
  type FlowPoint,
  type SessionFrame,
} from '@/services/flowLogic';

/* ─────────────────────────────── Outils de fixture ───────────────────────── */

/** Trame synthétique : seules les grandeurs consommées par flowLogic sont posées. */
function trame(
  elapsedMs: number,
  gLat: number | null,
  gLong: number | null,
  speedKmh: number | null
): SessionFrame {
  return { elapsedMs, lat: null, lon: null, speedKmh, gLat, gLong, gVert: null, yawRateRadS: null };
}

/** Cadence nominale RaceBox : 25 Hz → 40 ms. Les tests ne la SUPPOSENT jamais. */
const PAS_MS = 40;

/**
 * Bruit pseudo-aléatoire DÉTERMINISTE (xorshift 32 bits, arithmétique entière
 * exacte) : le test doit être rejouable à l'identique, comme le service.
 */
function bruitDeterministe(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat ^= etat << 13;
    etat >>>= 0;
    etat ^= etat >>> 17;
    etat ^= etat << 5;
    etat >>>= 0;
    return etat / 4294967295 - 0.5;
  };
}

/**
 * Profil de freinage : ligne droite, puis montée en charge de `amplitudeG` sur
 * `tramesRampe` trames, puis maintien. Le PROFIL D'ACCÉLÉRATION est indépendant
 * de la vitesse passée en argument — c'est ce qui permet de comparer deux
 * contextes à jerk brut RIGOUREUSEMENT identique.
 */
function profilFreinage(speedKmh: number, amplitudeG = 1.4, tramesRampe = 6): SessionFrame[] {
  const frames: SessionFrame[] = [];
  for (let i = 0; i < 60; i += 1) {
    let gLong = 0;
    if (i >= 10 && i < 10 + tramesRampe) gLong = -amplitudeG * ((i - 9) / tramesRampe);
    else if (i >= 10 + tramesRampe) gLong = -amplitudeG;
    frames.push(trame(i * PAS_MS, 0, gLong, speedKmh));
  }
  return frames;
}

const maxDe = (valeurs: readonly number[]): number => valeurs.reduce((a, b) => Math.max(a, b), 0);

/* ───────────────────── VERROU 1 — la grandeur : le jerk en g/s ───────────── */

describe('VERROU 1 — jerk sur le dt réel', () => {
  it('g rigoureusement constant → jerk nul partout (aucun jerk fabriqué)', () => {
    const frames = Array.from({ length: 30 }, (_, i) => trame(i * PAS_MS, 0.4, -0.2, 120));
    const points = computeFlowTrace(frames);

    expect(points.length).toBe(29);
    for (const point of points) {
      // À l'échelle du flottant : la moyenne glissante d'une constante laisse un
      // résidu de l'ordre de 1e-15 g/s quand la fenêtre s'élargit. Ce n'est pas
      // une valeur fabriquée, c'est la précision machine — on l'admet, on ne la
      // masque pas par un arrondi dans le service.
      expect(point.jerkMagnitude).toBeCloseTo(0, 12);
      expect(point.jerkResidual).toBe(0);
    }
  });

  it('rampe linéaire douce → jerk ≈ pente, et rien d’inexpliqué', () => {
    // 0 → −0.2 g en 4 s : pente = 0.05 g/s. Une trace lisse, donc |jerk| ≈ 0.
    const nb = 100;
    const pente = 0.2 / ((nb - 1) * PAS_MS * 1e-3);
    const frames = Array.from({ length: nb }, (_, i) =>
      trame(i * PAS_MS, 0, -0.2 * (i / (nb - 1)), 120)
    );
    const points = computeFlowTrace(frames);

    for (const point of points) {
      // Le lissage causal ne peut pas dépasser la pente : il la retarde au pire.
      expect(point.jerkMagnitude).toBeLessThanOrEqual(pente + 1e-9);
      expect(point.jerkResidual).toBe(0);
    }
    // Une fois la fenêtre causale remplie, la dérivée retrouve exactement la pente.
    expect(points[points.length - 1].jerkMagnitude).toBeCloseTo(pente, 9);
  });

  it('créneau franc → pic LOCALISÉ valant Δg / dt', () => {
    // Lissage désactivé pour lire la dérivée nue : c'est la vérification de la
    // formule elle-même, pas du filtre.
    const frames = Array.from({ length: 20 }, (_, i) =>
      trame(i * PAS_MS, 0, i >= 10 ? -0.9 : 0, 60)
    );
    const points = computeFlowTrace(frames, { smoothingWindowMs: 0 });

    const nonNuls = points.filter((p) => p.jerkMagnitude > 0);
    expect(nonNuls).toHaveLength(1);
    expect(nonNuls[0].elapsedMs).toBe(10 * PAS_MS);
    expect(nonNuls[0].jerkMagnitude).toBeCloseTo(0.9 / (PAS_MS / 1000), 9);
  });

  it('dérive sur le dt RÉEL et non sur un pas supposé', () => {
    // Même Δg, deux intervalles différents → deux jerks différents, dans le
    // rapport exact des durées. Un pas supposé à 40 ms donnerait la même valeur.
    const rapide = computeFlowTrace([trame(0, 0, 0, 60), trame(40, 0, -0.4, 60)], {
      smoothingWindowMs: 0,
    });
    const lent = computeFlowTrace([trame(0, 0, 0, 60), trame(120, 0, -0.4, 60)], {
      smoothingWindowMs: 0,
    });

    expect(rapide[0].jerkMagnitude).toBeCloseTo(0.4 / 0.04, 9);
    expect(lent[0].jerkMagnitude).toBeCloseTo(0.4 / 0.12, 9);
    expect(rapide[0].jerkMagnitude / lent[0].jerkMagnitude).toBeCloseTo(3, 9);
  });
});

/* ───────── VERROU 2 — normalisation par la sévérité : le jerk INATTENDU ──── */

describe('VERROU 2 — le résiduel, pas le jerk absolu', () => {
  it('INVARIANT CENTRAL : à jerk brut IDENTIQUE, la transition justifiée laisse un résiduel quasi nul, l’à-coup injustifié non', () => {
    // C'est LE test qui protège de « punir les rapides ». Les deux séries ont le
    // MÊME profil d'accélération, donc le MÊME jerk brut, bit pour bit : le jerk
    // absolu est incapable de les distinguer. Seul le contexte change.
    //   — à 210 km/h, monter 1,4 g en 240 ms est ce que la piste EXIGE : la zone
    //     de freinage est avalée en un souffle, la transition est justifiée ;
    //   — à 55 km/h, le même geste sur la même durée est un à-coup : rien dans la
    //     géométrie ne demandait cette brutalité.
    const justifie = computeFlowTrace(profilFreinage(210));
    const injustifie = computeFlowTrace(profilFreinage(55));

    const jerkJustifie = maxDe(justifie.map((p) => p.jerkMagnitude));
    const jerkInjustifie = maxDe(injustifie.map((p) => p.jerkMagnitude));
    const residuelJustifie = maxDe(justifie.map((p) => p.jerkResidual));
    const residuelInjustifie = maxDe(injustifie.map((p) => p.jerkResidual));

    // Le jerk BRUT est strictement le même : il confond les deux pilotes.
    expect(jerkJustifie).toBe(jerkInjustifie);
    expect(jerkJustifie).toBeGreaterThan(0);

    // Le RÉSIDUEL les sépare, et dans le bon sens.
    expect(residuelJustifie).toBeCloseTo(0, 6);
    expect(residuelInjustifie).toBeGreaterThan(jerkInjustifie / 2);
    expect(residuelInjustifie).toBeGreaterThan(10 * residuelJustifie + 1);

    // Et la mesure agrégée suit la même séparation.
    expect(meanResidualGPerS(justifie)).toBe(0);
    expect(meanResidualGPerS(injustifie) as number).toBeGreaterThan(0);
  });

  it('à vitesse ÉGALE, le même à-coup sous forte charge laisse moins de résiduel qu’à vide', () => {
    // Second facteur de la sévérité : le |g| soutenu. Une correction au milieu
    // d'un appui à 1 g accompagne une transition physique réelle ; la même
    // correction voiture à plat n'est expliquée par rien.
    const construire = (gLatSoutenu: number): SessionFrame[] =>
      Array.from({ length: 60 }, (_, i) =>
        trame(i * PAS_MS, gLatSoutenu, i >= 30 ? -0.28 : 0, 120)
      );

    const charge = computeFlowTrace(construire(1.0), { smoothingWindowMs: 0 });
    const aVide = computeFlowTrace(construire(0), { smoothingWindowMs: 0 });

    const jerkCharge = maxDe(charge.map((p) => p.jerkMagnitude));
    const jerkAVide = maxDe(aVide.map((p) => p.jerkMagnitude));
    expect(jerkCharge).toBeCloseTo(jerkAVide, 9); // même à-coup

    const residuelCharge = maxDe(charge.map((p) => p.jerkResidual));
    const residuelAVide = maxDe(aVide.map((p) => p.jerkResidual));
    expect(residuelAVide).toBeGreaterThan(residuelCharge);
  });

  it('le résiduel n’est JAMAIS négatif (aucun crédit de fluidité)', () => {
    const points = computeFlowTrace(profilFreinage(210));
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) expect(point.jerkResidual).toBeGreaterThanOrEqual(0);
  });

  it('la sévérité croît avec la vitesse, puis SATURE au plafond', () => {
    const vitesses = [0, 40, 90, 150, 220];
    const budgets = vitesses.map(
      (speedKmh) => explainedJerkGPerS({ speedKmh, gSustained: 0.5 }) as number
    );
    // Croissance NON DÉCROISSANTE, et jamais au-delà du plafond. La saturation
    // n'est pas une limite du modèle, c'est le garde-fou : sans elle le budget
    // dépassait tout jerk atteignable et le résiduel devenait identiquement nul
    // en vitesse — une exonération automatique des pilotes rapides, soit le
    // symétrique exact de l'injustice que le verrou 2 corrige.
    for (let i = 1; i < budgets.length; i += 1) {
      expect(budgets[i]).toBeGreaterThanOrEqual(budgets[i - 1]);
      expect(budgets[i]).toBeLessThanOrEqual(DEFAULT_SEVERITY_WEIGHTS.maxExplainedGPerS);
    }
    // La croissance est RÉELLE tant qu'on est sous le plafond.
    expect(budgets[1]).toBeGreaterThan(budgets[0]);
  });

  it('la sévérité croît avec le |g| soutenu, sous le plafond', () => {
    const charges = [0, 0.3, 0.8, 1.2, 1.8];
    // Vitesse modérée : on reste sous le plafond, la croissance est observable.
    const budgets = charges.map(
      (gSustained) => explainedJerkGPerS({ speedKmh: 60, gSustained }) as number
    );
    for (let i = 1; i < budgets.length; i += 1) {
      expect(budgets[i]).toBeGreaterThan(budgets[i - 1]);
    }
  });

  it('le budget expliqué ne dépasse JAMAIS son plafond, même à vitesse et charge extrêmes', () => {
    // C'est l'invariant qui empêche le résiduel d'être identiquement nul : au
    // sommet de l'enveloppe, la géométrie n'explique plus tout.
    const extreme = explainedJerkGPerS({ speedKmh: 300, gSustained: 3 }) as number;
    expect(extreme).toBeLessThanOrEqual(DEFAULT_SEVERITY_WEIGHTS.maxExplainedGPerS);
  });

  it('la sévérité est un PARAMÈTRE : changer la longueur de transition change la sortie', () => {
    // Le calage se fera sur le réel : le service doit y être sensible sans être
    // rouvert. Une longueur caractéristique plus courte = budget plus large.
    const court = computeFlowTrace(profilFreinage(90), {
      severityWeights: { ...DEFAULT_SEVERITY_WEIGHTS, transitionLengthM: 6 },
    });
    const long = computeFlowTrace(profilFreinage(90), {
      severityWeights: { ...DEFAULT_SEVERITY_WEIGHTS, transitionLengthM: 30 },
    });
    expect(maxDe(long.map((p) => p.jerkResidual))).toBeGreaterThan(
      maxDe(court.map((p) => p.jerkResidual))
    );
  });

  it('sévérité non calculable → null, jamais 0 (0 ferait passer tout le jerk pour inexpliqué)', () => {
    expect(explainedJerkGPerS({ speedKmh: Number.NaN, gSustained: 0.5 })).toBeNull();
    expect(explainedJerkGPerS({ speedKmh: Number.POSITIVE_INFINITY, gSustained: 0.5 })).toBeNull();
    expect(explainedJerkGPerS({ speedKmh: 100, gSustained: Number.NaN })).toBeNull();
    expect(explainedJerkGPerS({ speedKmh: -10, gSustained: 0.5 })).toBeNull();
    expect(
      explainedJerkGPerS(
        { speedKmh: 100, gSustained: 0.5 },
        { ...DEFAULT_SEVERITY_WEIGHTS, transitionLengthM: 0 }
      )
    ).toBeNull();
  });
});

/* ───────────── VERROU 3 — anti-bruit causal, déterministe, exposé ────────── */

describe('VERROU 3 — lissage causal, déterministe, fenêtre exposée', () => {
  /** Signal doux + sa version bruitée, à faible vitesse (donc faible budget). */
  function couplePropreBruite(amplitudeBruit: number): {
    propre: SessionFrame[];
    bruite: SessionFrame[];
  } {
    const bruit = bruitDeterministe(12345);
    const propre: SessionFrame[] = [];
    const bruite: SessionFrame[] = [];
    for (let i = 0; i < 200; i += 1) {
      const t = i * PAS_MS;
      const gLong = -0.15 * Math.sin((i / 200) * Math.PI * 2);
      const gLat = 0.1 * Math.cos((i / 200) * Math.PI * 2);
      propre.push(trame(t, gLat, gLong, 40));
      bruite.push(trame(t, gLat + bruit() * amplitudeBruit, gLong + bruit() * amplitudeBruit, 40));
    }
    return { propre, bruite };
  }

  it('le bruit capteur est atténué par le lissage causal', () => {
    const { propre, bruite } = couplePropreBruite(0.3);

    const residuelPropre = meanResidualGPerS(computeFlowTrace(propre)) as number;
    const residuelBruiteLisse = meanResidualGPerS(computeFlowTrace(bruite)) as number;
    const residuelBruiteNu = meanResidualGPerS(
      computeFlowTrace(bruite, { smoothingWindowMs: 0 })
    ) as number;

    // Sans lissage, la dérivée mesure surtout le capteur : résiduel massif.
    expect(residuelBruiteNu).toBeGreaterThan(1);
    // Avec lissage, le résiduel du signal bruité rejoint celui du signal propre…
    expect(Math.abs(residuelBruiteLisse - residuelPropre)).toBeLessThan(0.25);
    // …et se tient au moins un ordre de grandeur sous le résiduel non filtré.
    expect(residuelBruiteLisse).toBeLessThan(residuelBruiteNu / 10);
  });

  it('smoothingWindowMs est un vrai paramètre : fenêtre plus large → résiduel plus bas', () => {
    const { bruite } = couplePropreBruite(0.3);
    const residuels = [0, 80, 160, 280].map(
      (smoothingWindowMs) =>
        meanResidualGPerS(computeFlowTrace(bruite, { smoothingWindowMs })) as number
    );
    for (let i = 1; i < residuels.length; i += 1) {
      expect(residuels[i]).toBeLessThan(residuels[i - 1]);
    }
  });

  it('DÉTERMINISME : deux appels sur la même entrée donnent des sorties strictement identiques', () => {
    const { bruite } = couplePropreBruite(0.3);
    const a = computeFlowTrace(bruite);
    const b = computeFlowTrace(bruite);

    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    for (let i = 0; i < a.length; i += 1) {
      // Égalité stricte, pas une approximation : une séance doit être rejouable.
      expect(a[i].elapsedMs).toBe(b[i].elapsedMs);
      expect(a[i].jerkMagnitude).toBe(b[i].jerkMagnitude);
      expect(a[i].jerkResidual).toBe(b[i].jerkResidual);
    }
  });

  it('CAUSALITÉ : modifier une trame FUTURE ne change AUCUN point antérieur', () => {
    const base = profilFreinage(120);
    const avant = computeFlowTrace(base);

    // On bouleverse la fin de la série (g et vitesse) — le passé ne doit pas bouger.
    const rang = 40;
    const modifie = base.map((f, i) => (i >= rang ? trame(f.elapsedMs, 1.9, -1.9, 260) : f));
    const apres = computeFlowTrace(modifie);

    const dernierMsIntact = base[rang - 1].elapsedMs;
    const anterieursAvant = avant.filter((p) => p.elapsedMs <= dernierMsIntact);
    const anterieursApres = apres.filter((p) => p.elapsedMs <= dernierMsIntact);

    expect(anterieursAvant.length).toBeGreaterThan(0);
    expect(anterieursApres).toEqual(anterieursAvant);
  });

  it('un trou de capture ne produit PAS de jerk fabriqué, et maxGapMs est exposé', () => {
    // 0 → 40 ms → 400 ms → 440 ms : l'intervalle de 360 ms est un décrochage.
    const frames = [
      trame(0, 0, 0, 100),
      trame(40, 0, -0.1, 100),
      trame(400, 0, -1.2, 100),
      trame(440, 0, -1.25, 100),
    ];

    const parDefaut = computeFlowTrace(frames, { smoothingWindowMs: 0 });
    expect(parDefaut.map((p) => p.elapsedMs)).toEqual([40, 440]);

    // Le paramètre est exposé : une capture à cadence plus lente reste lisible.
    const tolerant = computeFlowTrace(frames, { smoothingWindowMs: 0, maxGapMs: 500 });
    expect(tolerant.map((p) => p.elapsedMs)).toEqual([40, 400, 440]);
  });
});

/* ───────────────────── Vide honnête — jamais un 0 fabriqué ───────────────── */

describe('vide honnête sur données insuffisantes', () => {
  it('0 ou 1 trame → aucune trace', () => {
    expect(computeFlowTrace([])).toEqual([]);
    expect(computeFlowTrace([trame(0, 0.1, -0.2, 100)])).toEqual([]);
  });

  it('dt nul, négatif ou non fini → aucune trace (pas de division inventée)', () => {
    expect(computeFlowTrace([trame(100, 0, 0, 90), trame(100, 0, -0.5, 90)])).toEqual([]);
    expect(computeFlowTrace([trame(100, 0, 0, 90), trame(60, 0, -0.5, 90)])).toEqual([]);
    expect(computeFlowTrace([trame(0, 0, 0, 90), trame(Number.NaN, 0, -0.5, 90)])).toEqual([]);
    expect(
      computeFlowTrace([trame(0, 0, 0, 90), trame(Number.POSITIVE_INFINITY, 0, -0.5, 90)])
    ).toEqual([]);
  });

  it('gLat ou gLong absent → trame EXCLUE, jamais remplacée par 0', () => {
    // Si le null devenait 0, la paire encadrant le trou produirait deux faux pics.
    const frames = [
      trame(0, 0.5, -0.5, 100),
      trame(40, null, -0.5, 100),
      trame(80, 0.5, null, 100),
      trame(120, 0.5, -0.5, 100),
    ];
    const points = computeFlowTrace(frames, { smoothingWindowMs: 0, maxGapMs: 200 });

    // Une seule paire valide subsiste (0 → 120), et le g n'a pas bougé : jerk nul.
    expect(points).toEqual([{ elapsedMs: 120, jerkMagnitude: 0, jerkResidual: 0 }]);
  });

  it('vitesse absente → trame exclue (sans contexte, la part inexpliquée n’existe pas)', () => {
    const frames = [
      trame(0, 0.5, -0.5, 100),
      trame(40, 0.5, -0.9, null),
      trame(80, 0.5, -0.9, 100),
    ];
    const points = computeFlowTrace(frames, { smoothingWindowMs: 0, maxGapMs: 200 });
    expect(points.map((p) => p.elapsedMs)).toEqual([80]);
  });

  it('trames non finies en g → exclues', () => {
    const frames = [
      trame(0, 0.5, -0.5, 100),
      trame(40, Number.NaN, -0.5, 100),
      trame(80, 0.5, -0.5, 100),
    ];
    expect(
      computeFlowTrace(frames, { smoothingWindowMs: 0, maxGapMs: 200 }).map((p) => p.elapsedMs)
    ).toEqual([80]);
  });

  it('trames en doublon ou en désordre → écartées, jamais réordonnées', () => {
    const frames = [
      trame(0, 0, 0, 100),
      trame(40, 0, -0.2, 100),
      trame(40, 0, -0.9, 100), // doublon d'horodatage
      trame(20, 0, -0.9, 100), // antérieure
      trame(80, 0, -0.4, 100),
    ];
    const points = computeFlowTrace(frames, { smoothingWindowMs: 0 });
    expect(points.map((p) => p.elapsedMs)).toEqual([40, 80]);
  });

  it('meanResidualGPerS sur liste vide → null, jamais 0', () => {
    expect(meanResidualGPerS([])).toBeNull();
  });

  it('meanResidualGPerS ignore les points corrompus et renvoie null s’il n’en reste aucun', () => {
    const corrompus = [{ elapsedMs: 0, jerkMagnitude: 1, jerkResidual: Number.NaN }] as FlowPoint[];
    expect(meanResidualGPerS(corrompus)).toBeNull();
  });

  it('meanResidualGPerS est bien une moyenne, en g/s', () => {
    const points: FlowPoint[] = [
      { elapsedMs: 40, jerkMagnitude: 3, jerkResidual: 1 },
      { elapsedMs: 80, jerkMagnitude: 4, jerkResidual: 2 },
      { elapsedMs: 120, jerkMagnitude: 5, jerkResidual: 3 },
    ];
    expect(meanResidualGPerS(points)).toBeCloseTo(2, 12);
  });
});

/* ─────────────────────── VERROU 4 — sorties descriptives ─────────────────── */

describe('VERROU 4 — distribution, segments, mesure nommée', () => {
  const points: FlowPoint[] = [
    { elapsedMs: 40, jerkMagnitude: 0.2, jerkResidual: 0.1 },
    { elapsedMs: 80, jerkMagnitude: 0.7, jerkResidual: 0.4 },
    { elapsedMs: 120, jerkMagnitude: 1.4, jerkResidual: 0.6 },
    { elapsedMs: 160, jerkMagnitude: 2.6, jerkResidual: 1.7 },
  ];

  it('distribution : cases contiguës depuis 0, effectifs conservés', () => {
    const bins = jerkDistribution(points, 0.5);
    expect(bins.map((b) => b.binStart)).toEqual([0, 0.5, 1, 1.5]);
    expect(bins.map((b) => b.count)).toEqual([2, 1, 0, 1]);
    // Aucun point perdu : un histogramme est un dénombrement, pas un résumé.
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(points.length);
  });

  it('distribution : le canal par défaut est le RÉSIDUEL, le brut reste accessible', () => {
    const parDefaut = jerkDistribution(points, 0.5);
    const residuel = jerkDistribution(points, 0.5, 'residual');
    const brut = jerkDistribution(points, 0.5, 'magnitude');

    expect(parDefaut).toEqual(residuel);
    expect(brut.length).toBeGreaterThan(residuel.length); // le brut monte plus haut
    expect(brut.reduce((s, b) => s + b.count, 0)).toBe(points.length);
  });

  it('distribution : liste vide → [] (vide honnête, pas une case à 0)', () => {
    expect(jerkDistribution([], 0.5)).toEqual([]);
  });

  it('distribution : largeur de case invalide → repli sur la résolution par défaut', () => {
    const attendu = jerkDistribution(points, DEFAULT_BIN_WIDTH_G_PER_S);
    expect(jerkDistribution(points, 0)).toEqual(attendu);
    expect(jerkDistribution(points, -1)).toEqual(attendu);
    expect(jerkDistribution(points, Number.NaN)).toEqual(attendu);
  });

  it('segments : médiane du résiduel et densité de preuve, bornes demi-ouvertes', () => {
    const resultat = segmentIntensity(points, [
      { startMs: 0, endMs: 120, label: 'ligne droite' },
      { startMs: 120, endMs: 400, label: 'virage 1' },
    ]);

    expect(resultat).toHaveLength(2);
    // [0, 120) contient 40 et 80 → médiane de (0.1, 0.4).
    expect(resultat[0].label).toBe('ligne droite');
    expect(resultat[0].pointCount).toBe(2);
    expect(resultat[0].medianResidual).toBeCloseTo(0.25, 12);
    // [120, 400) contient 120 et 160 → aucun point compté deux fois.
    expect(resultat[1].pointCount).toBe(2);
    expect(resultat[1].medianResidual).toBeCloseTo(1.15, 12);
    expect(resultat[0].pointCount + resultat[1].pointCount).toBe(points.length);
  });

  it('segments : un segment sans point garde sa place, avec null (jamais 0)', () => {
    const resultat = segmentIntensity(points, [{ startMs: 5000, endMs: 6000 }]);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].label).toBeNull();
    expect(resultat[0].medianResidual).toBeNull();
    expect(resultat[0].pointCount).toBe(0);
  });

  it('segments : bornes incohérentes ou non finies → null, pas une valeur inventée', () => {
    const resultat = segmentIntensity(points, [
      { startMs: 200, endMs: 100 },
      { startMs: Number.NaN, endMs: 100 },
    ]);
    expect(resultat.map((r) => r.medianResidual)).toEqual([null, null]);
    expect(resultat.map((r) => r.pointCount)).toEqual([0, 0]);
  });

  it('segments : aucun segment → [] ; aucun point → segments à null', () => {
    expect(segmentIntensity(points, [])).toEqual([]);
    const vide = segmentIntensity([], [{ startMs: 0, endMs: 1000, label: 'S1' }]);
    expect(vide[0]).toEqual({
      label: 'S1',
      startMs: 0,
      endMs: 1000,
      medianResidual: null,
      pointCount: 0,
    });
  });

  it('la chaîne complète produit de la matière descriptive sur une trace réelle', () => {
    const trace = computeFlowTrace(profilFreinage(55));
    expect(trace.length).toBeGreaterThan(0);
    expect(jerkDistribution(trace).length).toBeGreaterThan(0);
    expect(segmentIntensity(trace, [{ startMs: 0, endMs: 2400 }])[0].pointCount).toBeGreaterThan(0);
    expect(meanResidualGPerS(trace)).not.toBeNull();
  });
});

/* ───────────────────────────── Garde lexicale ────────────────────────────── */

describe('GARDE LEXICALE — aucune note, aucun verdict dans l’API', () => {
  const CHEMIN_SOURCE = join(__dirname, '..', 'flowLogic.ts');
  const source = readFileSync(CHEMIN_SOURCE, 'utf8');

  /**
   * Retire commentaires de bloc et de ligne. Le POURQUOI de l'interdit doit
   * pouvoir s'écrire en prose (« ce module ne produit aucune note ») sans faire
   * échouer la garde : seul le CODE est surveillé. Suffisant ici — le fichier ne
   * contient aucune chaîne littérale portant une séquence de commentaire.
   */
  function sansCommentaires(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  }

  const code = sansCommentaires(source);

  it('la garde surveille bien un fichier non vide', () => {
    expect(code.length).toBeGreaterThan(500);
    expect(code).toContain('computeFlowTrace');
  });

  it.each(['score', 'note', 'rating', 'grade', 'star'])(
    'le mot « %s » n’apparaît nulle part dans le code',
    (interdit) => {
      const trouve = new RegExp(`\\b${interdit}s?\\b`, 'i').test(code);
      expect(trouve).toBe(false);
    }
  );

  it('aucun identifiant EXPORTÉ n’évoque une notation', () => {
    const exportes: string[] = [];
    const motif = /export\s+(?:const|function|interface|type|class|enum)\s+(\w+)/g;
    let trouve = motif.exec(code);
    while (trouve !== null) {
      exportes.push(trouve[1]);
      trouve = motif.exec(code);
    }

    expect(exportes.length).toBeGreaterThan(5);
    const suspects = exportes.filter((nom) =>
      /(score|note|rating|grade|stars|indice|fluidity)/i.test(nom)
    );
    expect(suspects).toEqual([]);
  });

  it('aucune valeur de fluidité chiffrée n’est formatée par ce module', () => {
    // Interdit le patron « fluidité: 78 » sous toutes ses graphies, y compris en
    // commentaire : un exemple de verdict finit toujours par migrer dans l'UI.
    expect(/fluidit[ée]\s*[:=]\s*-?\d/i.test(source)).toBe(false);
  });

  it('le nombre unique exposé porte son unité dans son nom', () => {
    // VERROU 4 : « variation moyenne d'accélération : 1,8 g/s » est un constat ;
    // « 78 » serait un verdict. L'unité dans le nom rend la confusion impossible.
    expect(code).toContain('meanResidualGPerS');
    expect(/export function meanResidualGPerS/.test(code)).toBe(true);
  });
});
