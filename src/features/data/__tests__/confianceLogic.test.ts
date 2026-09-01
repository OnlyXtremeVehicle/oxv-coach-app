/**
 * La note dit-elle toujours pourquoi ?
 *
 * Tout l'intérêt d'une confiance PAR ZONE est de ne rien laisser se cacher :
 * ni une zone aveugle derrière une moyenne flatteuse, ni une note sans ses
 * causes, ni un canal absent déguisé en canal propre. Ces tests protègent
 * d'abord ces trois points — puis les seuils, qui sont des conventions
 * nommées et doivent le rester.
 */

import {
  decouperZones,
  evaluerConfianceTour,
  evaluerZone,
  FREQUENCE_NOMINALE_HZ,
  NB_ZONES_DEFAUT,
  PERIODE_NOMINALE_MS,
  pireNiveau,
  SEUIL_COUVERTURE_FAIBLE_PCT,
  SEUIL_HACC_DEGRADE_M,
  SEUIL_PART_DEGRADEE_FAIBLE,
  SEUIL_PDOP_DEGRADE,
  SEUIL_SATELLITES_MIN,
  SEUIL_TROU_MS,
  VERSION_CONFIANCE_ZONE,
  type TrameQualite,
  type ZoneDistance,
} from '../confianceLogic';

/** Une trame propre : fix valide, hAcc 1 m, PDOP 1.5, 14 satellites. */
function trame(
  elapsedMs: number,
  distanceM: number | null,
  extra?: Partial<TrameQualite>
): TrameQualite {
  return {
    elapsedMs,
    distanceM,
    gpsAccuracyM: 1,
    pdop: 1.5,
    satellites: 14,
    fixValid: true,
    ...extra,
  };
}

/**
 * Un défilement propre à 25 Hz : une trame toutes les 40 ms, la distance
 * avançant d'un mètre par trame (soit 25 m/s — un rythme de piste plausible).
 */
function defilement(
  debutM: number,
  finM: number,
  extra?: Partial<TrameQualite>,
  pasMs: number = PERIODE_NOMINALE_MS
): TrameQualite[] {
  const trames: TrameQualite[] = [];
  let t = 0;
  for (let d = debutM; d <= finM; d += 1) {
    trames.push(trame(t, d, extra));
    t += pasMs;
  }
  return trames;
}

const ZONE_100: ZoneDistance = { debutM: 0, finM: 100, nom: 'Z1' };

describe('decouperZones', () => {
  it('découpe en zones contiguës qui referment le tour', () => {
    const zones = decouperZones(1200, 4);
    expect(zones).toHaveLength(4);
    expect(zones[0]).toEqual({ debutM: 0, finM: 300, nom: 'Z1' });
    expect(zones[3].finM).toBe(1200);
    for (let i = 1; i < zones.length; i++) {
      expect(zones[i].debutM).toBeCloseTo(zones[i - 1].finM, 9);
    }
  });

  it('rend le découpage par défaut', () => {
    expect(decouperZones(1000)).toHaveLength(NB_ZONES_DEFAUT);
  });

  it('rend vide plutôt que d’inventer des bornes', () => {
    expect(decouperZones(0)).toEqual([]);
    expect(decouperZones(-50)).toEqual([]);
    expect(decouperZones(NaN)).toEqual([]);
    expect(decouperZones(1000, 0)).toEqual([]);
    expect(decouperZones(1000, 2.5)).toEqual([]);
  });
});

describe('une zone bien mesurée', () => {
  it('est haute, sans motif, couverte, au rythme nominal', () => {
    const z = evaluerZone(defilement(0, 100), ZONE_100, true);
    expect(z.niveau).toBe('haute');
    expect(z.motifs).toEqual([]);
    expect(z.couverturePct).toBeCloseTo(100, 1);
    expect(z.nbTrous).toBe(0);
    expect(z.frequenceHzObservee).toBeCloseTo(FREQUENCE_NOMINALE_HZ, 3);
  });

  /** created_at est un ordre d'insertion : l'ordre d'arrivée ne compte pas. */
  it('ne dépend pas de l’ordre d’arrivée des trames — tri sur elapsedMs', () => {
    const propres = defilement(0, 100);
    const melangees = [...propres].reverse();
    const a = evaluerZone(propres, ZONE_100, true);
    const b = evaluerZone(melangees, ZONE_100, true);
    expect(b).toEqual(a);
  });
});

describe('jamais une note sans ses motifs', () => {
  it('toute zone non haute porte au moins un motif', () => {
    const cas: TrameQualite[][] = [
      defilement(0, 100, { gpsAccuracyM: SEUIL_HACC_DEGRADE_M + 3 }),
      defilement(0, 100, { pdop: SEUIL_PDOP_DEGRADE + 2 }),
      defilement(0, 40),
      [trame(0, 10)],
    ];
    for (const trames of cas) {
      const z = evaluerZone(trames, ZONE_100, true);
      expect(z.niveau).not.toBe('haute');
      expect(z.motifs.length).toBeGreaterThan(0);
    }
  });
});

describe('les canaux de qualité', () => {
  it('une précision GPS dégradée sur la majorité des trames rend faible, motif à l’appui', () => {
    const z = evaluerZone(
      defilement(0, 100, { gpsAccuracyM: SEUIL_HACC_DEGRADE_M + 5 }),
      ZONE_100,
      true
    );
    expect(z.niveau).toBe('faible');
    expect(z.motifs.some((m) => m.includes('précision GPS dégradée'))).toBe(true);
    expect(z.motifs.some((m) => m.includes(`hAcc > ${SEUIL_HACC_DEGRADE_M} m`))).toBe(true);
  });

  it('une dégradation minoritaire rend moyenne, pas faible', () => {
    // 101 trames propres, 10 dégradées : part ≈ 9 %, sous le seuil faible.
    const propres = defilement(0, 100);
    const degradees = propres.slice(0, 10).map((t) => ({
      ...t,
      gpsAccuracyM: SEUIL_HACC_DEGRADE_M + 5,
    }));
    const trames = [...degradees, ...propres.slice(10)];
    const z = evaluerZone(trames, ZONE_100, true);
    expect(z.niveau).toBe('moyenne');
    expect(z.motifs.some((m) => m.includes('précision GPS dégradée'))).toBe(true);
  });

  it('un fix non valide se compte, et retire sa part de couverture', () => {
    const trames = defilement(0, 100).map((t, i) => (i < 60 ? { ...t, fixValid: false } : t));
    const z = evaluerZone(trames, ZONE_100, true);
    expect(z.niveau).toBe('faible');
    expect(z.motifs.some((m) => m.includes('fix GPS non valide (60 trames)'))).toBe(true);
    expect(z.couverturePct).toBeLessThan(SEUIL_COUVERTURE_FAIBLE_PCT);
  });

  it('des satellites insuffisants et un PDOP défavorable se nomment', () => {
    const z = evaluerZone(
      defilement(0, 100, { satellites: SEUIL_SATELLITES_MIN - 2, pdop: SEUIL_PDOP_DEGRADE + 4 }),
      ZONE_100,
      true
    );
    expect(z.niveau).toBe('faible');
    expect(z.motifs.some((m) => m.includes('satellites insuffisants'))).toBe(true);
    expect(z.motifs.some((m) => m.includes('géométrie satellitaire défavorable'))).toBe(true);
  });

  /** Inconnu n'est pas mauvais : un canal absent ne compte ni pour ni contre. */
  it('un canal absent n’est jamais compté comme dégradé', () => {
    const z = evaluerZone(defilement(0, 100, { pdop: null, satellites: null }), ZONE_100, true);
    expect(z.niveau).toBe('haute');
    expect(z.motifs).toEqual([]);
  });

  /** Mais rien à vérifier ≠ tout va bien : sans aucun canal, pas de 'haute'. */
  it('sans aucun canal de qualité, la note plafonne à moyenne', () => {
    const z = evaluerZone(
      defilement(0, 100, { gpsAccuracyM: null, pdop: null, satellites: null, fixValid: null }),
      ZONE_100,
      true
    );
    expect(z.niveau).toBe('moyenne');
    expect(z.motifs.some((m) => m.includes('canaux de qualité non renseignés'))).toBe(true);
  });
});

describe('les trous de liaison et la fréquence', () => {
  it('un trou se compte et troue la couverture', () => {
    // Deux défilements propres, séparés d'un vrai trou (1 s) au milieu de la zone.
    const avant = defilement(0, 40);
    const apres = defilement(60, 100).map((t, i) => ({
      ...t,
      elapsedMs: 41 * PERIODE_NOMINALE_MS + 1000 + i * PERIODE_NOMINALE_MS,
    }));
    const z = evaluerZone([...avant, ...apres], ZONE_100, true);
    expect(z.nbTrous).toBe(1);
    expect(z.motifs.some((m) => m.includes('trous de liaison (1)'))).toBe(true);
    // Les 20 m du trou ne sont pas couverts.
    expect(z.couverturePct).toBeCloseTo(80, 0);
    expect(z.niveau).toBe('moyenne');
  });

  it('une fréquence décrochée du nominal se nomme', () => {
    // Une trame toutes les 80 ms : 12,5 Hz observés.
    const z = evaluerZone(defilement(0, 100, undefined, 80), ZONE_100, true);
    expect(z.frequenceHzObservee).toBeCloseTo(12.5, 3);
    expect(z.motifs.some((m) => m.includes('12,5 Hz'))).toBe(true);
    expect(z.motifs.some((m) => m.includes(`${FREQUENCE_NOMINALE_HZ} Hz`))).toBe(true);
    expect(z.niveau).toBe('moyenne');
  });

  it('la fréquence est null quand trop peu de trames pour la dériver', () => {
    const z = evaluerZone([trame(0, 10), trame(40, 11)], ZONE_100, true);
    expect(z.frequenceHzObservee).toBeNull();
  });
});

describe('ce qui n’est pas mesuré ne se note pas', () => {
  it('une zone sans trame a un niveau null, jamais une note fabriquée', () => {
    const z = evaluerZone([], ZONE_100, true);
    expect(z.niveau).toBeNull();
    expect(z.motifs).toEqual(['aucune trame dans cette zone']);
    expect(z.couverturePct).toBe(0);
    expect(z.frequenceHzObservee).toBeNull();
  });

  it('une trame sans position dérivable est écartée, pas devinée', () => {
    const z = evaluerZone([trame(0, null), trame(40, null)], ZONE_100, true);
    expect(z.niveau).toBeNull();
    expect(z.nbTrames).toBe(0);
  });

  it('une zone sans étendue ne s’évalue pas', () => {
    const z = evaluerZone(defilement(0, 100), { debutM: 50, finM: 50, nom: 'Z0' }, false);
    expect(z.niveau).toBeNull();
    expect(z.motifs[0]).toContain('zone sans étendue');
  });
});

describe('l’agrégat par tour', () => {
  it('porte version et confiance, et la pire zone gagne — jamais une moyenne', () => {
    // Z1 propre, Z2 majoritairement dégradée : l'agrégat est faible.
    const trames = [
      ...defilement(0, 99),
      ...defilement(100, 200, { gpsAccuracyM: SEUIL_HACC_DEGRADE_M + 5 }).map((t) => ({
        ...t,
        elapsedMs: t.elapsedMs + 100 * PERIODE_NOMINALE_MS,
      })),
    ];
    const tour = evaluerConfianceTour(trames, decouperZones(200, 2));
    expect(tour.version).toBe(VERSION_CONFIANCE_ZONE);
    expect(tour.zones[0].niveau).toBe('haute');
    expect(tour.zones[1].niveau).toBe('faible');
    expect(tour.confiance).toBe('faible');
    expect(tour.motifs.some((m) => m.includes('confiance réduite'))).toBe(true);
  });

  it('une zone sans trame ne vote pas, mais se nomme et pèse sur la couverture', () => {
    // Trames sur la première moitié seulement (d = 0 … 99, la zone 2 reste vide).
    const tour = evaluerConfianceTour(defilement(0, 99), decouperZones(200, 2));
    expect(tour.zones[0].niveau).toBe('haute');
    expect(tour.zones[1].niveau).toBeNull();
    expect(tour.confiance).toBe('haute');
    expect(tour.motifs.some((m) => m.includes('1 zone(s) sans trame'))).toBe(true);
    // 99 m couverts sur la zone 1, rien sur la zone 2 : 49,5 % du tour.
    expect(tour.couverturePct).toBeCloseTo(49.5, 1);
  });

  it('sans aucune trame, la confiance est faible et le dit', () => {
    const tour = evaluerConfianceTour([], decouperZones(200, 2));
    expect(tour.confiance).toBe('faible');
    expect(tour.motifs.some((m) => m.includes('aucune zone mesurée'))).toBe(true);
    expect(tour.couverturePct).toBe(0);
  });

  it('les trames non situées se comptent, jamais en silence', () => {
    const trames = [...defilement(0, 100), trame(9999, null), trame(10039, null)];
    const tour = evaluerConfianceTour(trames, decouperZones(100, 1));
    expect(tour.tramesNonSituees).toBe(2);
    expect(tour.motifs.some((m) => m.includes('2 trame(s) sans position dérivable'))).toBe(true);
  });
});

describe('les seuils sont des conventions nommées, et remplaçables', () => {
  it('les valeurs retenues, à valider sur piste', () => {
    expect(FREQUENCE_NOMINALE_HZ).toBe(25);
    expect(SEUIL_TROU_MS).toBeCloseTo(100, 6);
    expect(SEUIL_HACC_DEGRADE_M).toBe(5);
    expect(SEUIL_PDOP_DEGRADE).toBe(4);
    expect(SEUIL_SATELLITES_MIN).toBe(8);
    expect(SEUIL_PART_DEGRADEE_FAIBLE).toBe(0.5);
    expect(SEUIL_COUVERTURE_FAIBLE_PCT).toBe(50);
  });

  it('pireNiveau ordonne faible < moyenne < haute', () => {
    expect(pireNiveau('haute', 'moyenne')).toBe('moyenne');
    expect(pireNiveau('moyenne', 'faible')).toBe('faible');
    expect(pireNiveau('haute', 'haute')).toBe('haute');
  });
});
