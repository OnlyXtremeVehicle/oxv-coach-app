/**
 * M24 — la synchronisation vidéo, et surtout SON ERREUR.
 *
 * Les trames de ces tests sont posées à la main, à 25 Hz exactement, pour que
 * chaque instant attendu soit CALCULABLE de tête et non relevé après coup :
 * le franchissement du seuil d'arrêt tombe sur 4050 ms parce que la vitesse
 * croît de 0,01 m/s par ms à partir de 4000 ms, pas parce que le code l'a dit.
 *
 * Le canal `gForceX` est posé indépendamment du profil de vitesse : il sert à
 * exercer le détecteur de pic, pas à simuler une physique cohérente.
 */

import {
  COUVERTURE_ANCRAGE_MINIMALE,
  DERIVE_PRESUMEE_APPAREIL_PPM,
  DERIVE_PRESUMEE_GPS_PPM,
  PAS_REGLAGE_MS,
  SEUIL_FREINAGE_FRANC_G,
  VERSION_SYNCHRO_VIDEO,
  decalerOffset,
  detecterEvenements,
  effetDuPas,
  formaterErreurSecondes,
  formaterOffsetSecondes,
  phraseDuPas,
  synchroniserVideo,
  type EntreeSynchro,
  type TrameSynchro,
} from '../synchroVideoLogic';

// La période nominale (25 Hz) vit dans confianceLogic — source unique de la décision fondateur.
import { PERIODE_NOMINALE_MS as PERIODE } from '../confianceLogic';

// ===========================================================================
// Fabrique de trames
// ===========================================================================

type Point = readonly [number, number];

/** Interpolation linéaire sur des points de rupture (t en ms). */
function interpoler(profil: readonly Point[], t: number): number {
  if (t <= profil[0][0]) return profil[0][1];
  const dernier = profil[profil.length - 1];
  if (t >= dernier[0]) return dernier[1];
  for (let i = 1; i < profil.length; i++) {
    const [t1, v1] = profil[i];
    const [t0, v0] = profil[i - 1];
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return dernier[1];
}

/**
 * Profil de vitesse (m/s) : quatre secondes d'arrêt, un départ, un roulage,
 * un second arrêt de quatre secondes, un second départ. Deux départs arrêtés
 * exactement — de quoi rendre le repère AMBIGU, ce que le module doit refuser.
 */
const PROFIL_VITESSE: readonly Point[] = [
  [0, 0],
  [4000, 0],
  [4300, 3],
  [7000, 20],
  [9000, 0],
  [13000, 0],
  [13300, 3],
  [16000, 25],
  [20000, 25],
];

/** Pic de freinage franc à 6000 ms (1,10 g), plateau plus bas pendant la décélération. */
function gDe(t: number): number {
  const pic = Math.max(0, 1.1 - Math.abs(t - 6000) / 1000);
  const plateau = t >= 7000 && t <= 9000 ? 0.9 : 0;
  return Math.max(pic, plateau);
}

function serie(finMs: number, avecItow: boolean): TrameSynchro[] {
  const out: TrameSynchro[] = [];
  for (let t = 0; t <= finMs; t += 40) {
    out.push({
      elapsedMs: t,
      vitesseMs: interpoler(PROFIL_VITESSE, t),
      gForceX: gDe(t),
      itowMs: avecItow ? 300000 + t : null,
    });
  }
  return out;
}

/** Série courte : un seul départ arrêté, un seul pic de freinage. */
const SERIE_COURTE = serie(8000, true);
/** Série longue : deux départs arrêtés, un seul pic de freinage. */
const SERIE_LONGUE = serie(16000, true);

function entree(p: Partial<EntreeSynchro>): EntreeSynchro {
  return {
    trames: p.trames ?? [],
    video: p.video ?? null,
    reperes: p.reperes ?? [],
    offsetManuelMs: p.offsetManuelMs ?? null,
  };
}

// ===========================================================================
// Détection des faits francs
// ===========================================================================

describe('les repères francs que la mesure offre', () => {
  it('trouve le départ arrêté à 4050 ms, instant interpolé entre deux trames', () => {
    const evs = detecterEvenements(SERIE_COURTE);
    const departs = evs.filter((e) => e.type === 'depart-arrete');
    expect(departs).toHaveLength(1);
    expect(departs[0].elapsedMs).toBeCloseTo(4050, 6);
    // 4040 ms d'immobilité (dernière trame à l'arrêt : 4040), puis 11 km/h.
    expect(departs[0].fait).toContain("4,0 s d'immobilité");
    expect(departs[0].fait).toContain('11 km/h');
  });

  it('la netteté du départ ne descend jamais sous la demi-période de mesure', () => {
    const [depart] = detecterEvenements(SERIE_COURTE).filter((e) => e.type === 'depart-arrete');
    expect(depart.incertitudeMs).toBe(Math.max(20, PERIODE / 2));
  });

  it('trouve le freinage le plus franc, et MESURE la largeur de son pic', () => {
    const [freinage] = detecterEvenements(SERIE_COURTE).filter((e) => e.type === 'freinage-franc');
    expect(freinage.elapsedMs).toBe(6000);
    // g ≥ 1,10 − 0,05 sur [5960 ; 6040] : 80 ms de large, demi-largeur 40.
    expect(freinage.incertitudeMs).toBe(40);
    expect(freinage.fait).toContain('1,10 g');
    expect(freinage.fait).toContain('0,08 s');
  });

  it('un freinage mou n’est pas un repère — il n’est pas rendu', () => {
    const mou = SERIE_COURTE.map((t) => ({ ...t, gForceX: SEUIL_FREINAGE_FRANC_G - 0.01 }));
    expect(detecterEvenements(mou).some((e) => e.type === 'freinage-franc')).toBe(false);
  });

  it('un canal de vitesse absent ne fabrique pas de départ', () => {
    const sansVitesse = SERIE_COURTE.map((t) => ({ ...t, vitesseMs: null }));
    expect(detecterEvenements(sansVitesse).some((e) => e.type === 'depart-arrete')).toBe(false);
  });

  it('les trames sont triées sur elapsed_ms, jamais sur l’ordre d’arrivée', () => {
    const melange = [...SERIE_COURTE].reverse();
    expect(detecterEvenements(melange)).toEqual(detecterEvenements(SERIE_COURTE));
  });

  it('la série longue offre bien DEUX départs arrêtés', () => {
    const departs = detecterEvenements(SERIE_LONGUE).filter((e) => e.type === 'depart-arrete');
    expect(departs.map((d) => Math.round(d.elapsedMs))).toEqual([4050, 13050]);
  });
});

// ===========================================================================
// Les trois états de la synchronisation
// ===========================================================================

describe('quand rien ne permet de caler', () => {
  it('le dit, et ne fabrique NI décalage NI erreur', () => {
    const s = synchroniserVideo(entree({}));
    expect(s.version).toBe(VERSION_SYNCHRO_VIDEO);
    expect(s.origine).toBeNull();
    expect(s.offsetMs).toBeNull();
    expect(s.erreurMs).toBeNull();
    expect(s.budget).toEqual([]);
    expect(s.phrase).toBe("Décalage non mesuré — la vidéo n'est pas alignée sur la mesure.");
  });

  it('sans repère pointé, il annonce quand même les repères disponibles', () => {
    const s = synchroniserVideo(entree({ trames: SERIE_COURTE }));
    expect(s.phrase).toBe("Décalage non mesuré — la vidéo n'est pas alignée sur la mesure.");
    expect(s.evenementsDisponibles).toHaveLength(2);
    expect(s.motifs.join(' ')).toContain('2 repère(s) franc(s)');
  });
});

describe('quand le décalage vient de la main, et de rien d’autre', () => {
  const s = synchroniserVideo(entree({ trames: SERIE_COURTE, offsetManuelMs: -400 }));

  it('rend le décalage, et laisse l’erreur à null — jamais un ±0,00 s', () => {
    expect(s.origine).toBe('manuel');
    expect(s.offsetMs).toBe(-400);
    expect(s.erreurMs).toBeNull();
    expect(s.erreurMinoree).toBe(false);
  });

  it('la phrase dit d’où vient le calage, et que l’erreur n’est pas mesurée', () => {
    expect(s.phrase).toBe('Vidéo calée à la main sur −0,40 s — erreur de calage non mesurée.');
  });
});

describe('un repère par événement — l’erreur devient chiffrable', () => {
  const s = synchroniserVideo(
    entree({
      trames: SERIE_COURTE,
      video: { dureeMs: 10000, imagesParSeconde: 30 },
      reperes: [{ positionVideoMs: 1050, evenement: 'depart-arrete' }],
    })
  );

  it('le décalage est la différence des deux horloges, à la milliseconde', () => {
    expect(s.origine).toBe('evenement');
    expect(s.offsetMs).toBe(3000); // 4050 − 1050
    expect(s.ancrages).toHaveLength(1);
    expect(s.ancrages[0].evenement.type).toBe('depart-arrete');
  });

  it('la phrase est celle du cahier — une marge, en secondes', () => {
    expect(s.phrase).toMatch(/^Vidéo calée à ±0,04 s/);
  });

  /**
   * Un seul repère ne permet AUCUN recoupement : la dispersion demande trois
   * points pour avoir un sens. Le poste n'est donc pas établi, et la règle 2
   * de l'en-tête s'applique — l'erreur rendue est un plancher, et le dit.
   *
   * Ce test a d'abord figé l'inverse (`erreurMinoree` à false) : le module
   * écrivait la règle et ne l'appliquait qu'à deux postes sur trois.
   */
  it('un poste non établi rend l’erreur minorée — la règle vaut pour TOUS les postes', () => {
    expect(s.erreurMinoree).toBe(true);
    expect(s.phrase).toContain('au moins');
    expect(s.phrase).toContain('dispersion');
  });

  it('le budget nomme ses quatre postes, et chacun porte son motif', () => {
    expect(s.budget.map((p) => p.cle)).toEqual([
      'cadence-mesure',
      'cadence-video',
      'ancrage',
      'derive',
    ]);
    for (const poste of s.budget) {
      expect(poste.motif.length).toBeGreaterThan(0);
    }
  });

  it('la cadence de mesure vaut la demi-période OBSERVÉE (40 ms → 20 ms)', () => {
    const poste = s.budget.find((p) => p.cle === 'cadence-mesure');
    expect(poste?.ms).toBe(20);
    expect(poste?.mesure).toBe(true);
    expect(poste?.motif).toContain('40 ms');
  });

  it('25 Hz, c’est ±20 ms au mieux : l’erreur ne descend jamais sous ce plancher', () => {
    expect(s.erreurMs).not.toBeNull();
    expect(s.erreurMs as number).toBeGreaterThanOrEqual(PERIODE / 2);
  });

  it('avec UN seul repère, la dérive est PRÉSUMÉE, et le dit', () => {
    expect(s.derive?.mesuree).toBe(false);
    expect(s.derive?.ppm).toBe(DERIVE_PRESUMEE_GPS_PPM);
    expect(s.derive?.fait).toContain('Un seul repère');
  });

  it('sans itow_ms, l’horloge est celle de l’appareil et la dérive présumée s’élargit', () => {
    const sansGps = synchroniserVideo(
      entree({
        trames: SERIE_COURTE.map((t) => ({ ...t, itowMs: null })),
        video: { dureeMs: 10000, imagesParSeconde: 30 },
        reperes: [{ positionVideoMs: 1050, evenement: 'depart-arrete' }],
      })
    );
    expect(sansGps.derive?.ppm).toBe(DERIVE_PRESUMEE_APPAREIL_PPM);
    expect(sansGps.erreurMs as number).toBeGreaterThan(s.erreurMs as number);
  });
});

describe('quand un poste du budget manque, l’erreur rendue est un PLANCHER', () => {
  const s = synchroniserVideo(
    entree({
      trames: SERIE_COURTE,
      video: { dureeMs: 10000, imagesParSeconde: null },
      reperes: [{ positionVideoMs: 1050, evenement: 'depart-arrete' }],
    })
  );

  it('la cadence de l’image inconnue laisse son poste à null', () => {
    const poste = s.budget.find((p) => p.cle === 'cadence-video');
    expect(poste?.ms).toBeNull();
    expect(poste?.mesure).toBe(false);
  });

  it('la phrase dit « au moins », et nomme ce qui manque', () => {
    expect(s.erreurMinoree).toBe(true);
    expect(s.phrase).toContain('au moins');
    expect(s.phrase).toContain("la cadence de l'image n'est pas connue");
  });

  it('une erreur minorée est plus PETITE que la même erreur complète — d’où le mot', () => {
    const complete = synchroniserVideo(
      entree({
        trames: SERIE_COURTE,
        video: { dureeMs: 10000, imagesParSeconde: 30 },
        reperes: [{ positionVideoMs: 1050, evenement: 'depart-arrete' }],
      })
    );
    expect(s.erreurMs as number).toBeLessThan(complete.erreurMs as number);
  });
});

// ===========================================================================
// La dérive
// ===========================================================================

describe('la dérive entre les deux horloges', () => {
  it('deux repères ÉCARTÉS la mesurent, et la pente est rendue en ppm', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_COURTE,
        video: { dureeMs: 3800, imagesParSeconde: 30 },
        reperes: [
          { positionVideoMs: 1050, evenement: 'depart-arrete' },
          { positionVideoMs: 2990, evenement: 'freinage-franc' },
        ],
      })
    );
    expect(s.derive?.mesuree).toBe(true);
    // offsets 3000 et 3010 sur 1940 ms d'écart.
    expect(s.derive?.ppm).toBeCloseTo((10 / 1940) * 1e6, 3);
    expect(s.derive?.fait).toContain('ppm');
  });

  it('deux repères RESSERRÉS ne la mesurent pas — elle redevient présumée', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_COURTE,
        // 1940 ms d'écart sur 20 s de vidéo : moins que la couverture exigée.
        video: { dureeMs: 20000, imagesParSeconde: 30 },
        reperes: [
          { positionVideoMs: 1050, evenement: 'depart-arrete' },
          { positionVideoMs: 2990, evenement: 'freinage-franc' },
        ],
      })
    );
    expect(1940 / 20000).toBeLessThan(COUVERTURE_ANCRAGE_MINIMALE);
    expect(s.derive?.mesuree).toBe(false);
    expect(s.derive?.fait).toContain('trop resserrés');
  });

  it('deux repères posent une pente mais aucune dispersion — et le motif le dit', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_COURTE,
        video: { dureeMs: 3800, imagesParSeconde: 30 },
        reperes: [
          { positionVideoMs: 1050, evenement: 'depart-arrete' },
          { positionVideoMs: 2990, evenement: 'freinage-franc' },
        ],
      })
    );
    expect(s.budget.some((p) => p.cle === 'dispersion')).toBe(false);
    expect(s.motifs.join(' ')).toContain('dispersion reste non mesurée');
  });

  it('trois repères la contredisent : la dispersion devient un poste MESURÉ', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_LONGUE,
        video: { dureeMs: 14000, imagesParSeconde: 30 },
        offsetManuelMs: 3000, // lève l'ambiguïté entre les deux départs
        reperes: [
          { positionVideoMs: 1050, evenement: 'depart-arrete' },
          { positionVideoMs: 3000, evenement: 'freinage-franc' },
          { positionVideoMs: 10040, evenement: 'depart-arrete' },
        ],
      })
    );
    expect(s.ancrages).toHaveLength(3);
    const dispersion = s.budget.find((p) => p.cle === 'dispersion');
    expect(dispersion?.mesure).toBe(true);
    expect(dispersion?.ms as number).toBeGreaterThan(0);
  });
});

// ===========================================================================
// L'ambiguïté, refusée plutôt que tranchée au hasard
// ===========================================================================

describe('deux départs arrêtés, un seul repère pointé', () => {
  it('sans rien pour trancher, le module REFUSE d’ancrer et le dit', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_LONGUE,
        video: { dureeMs: 14000, imagesParSeconde: 30 },
        reperes: [{ positionVideoMs: 1050, evenement: 'depart-arrete' }],
      })
    );
    expect(s.ancrages).toEqual([]);
    expect(s.origine).toBeNull();
    expect(s.motifs.join(' ')).toContain('2 départs arrêtés sont mesurés');
  });

  it('un décalage déjà posé lève l’ambiguïté — le plus proche l’emporte', () => {
    const s = synchroniserVideo(
      entree({
        trames: SERIE_LONGUE,
        video: { dureeMs: 14000, imagesParSeconde: 30 },
        offsetManuelMs: 3000,
        reperes: [{ positionVideoMs: 10050, evenement: 'depart-arrete' }],
      })
    );
    expect(s.origine).toBe('evenement');
    expect(Math.round(s.ancrages[0].evenement.elapsedMs)).toBe(13050);
    expect(s.offsetMs).toBe(3000);
  });

  it('un repère dont le fait n’existe pas dans la mesure est dit, pas comblé', () => {
    const sansFreinage = SERIE_COURTE.map((t) => ({ ...t, gForceX: 0 }));
    const s = synchroniserVideo(
      entree({
        trames: sansFreinage,
        reperes: [{ positionVideoMs: 500, evenement: 'freinage-franc' }],
      })
    );
    expect(s.offsetMs).toBeNull();
    expect(s.motifs.join(' ')).toContain("Aucun freinage franc n'apparaît dans la mesure.");
  });
});

// ===========================================================================
// Mise en forme
// ===========================================================================

describe('la mise en forme française', () => {
  it('l’erreur s’arrondit AU-DESSUS, jamais vers le bas', () => {
    expect(formaterErreurSecondes(80)).toBe('0,08');
    expect(formaterErreurSecondes(80.1)).toBe('0,09');
    expect(formaterErreurSecondes(33.72)).toBe('0,04');
  });

  it('le décalage porte son signe, en secondes', () => {
    expect(formaterOffsetSecondes(-400)).toBe('−0,40 s');
    expect(formaterOffsetSecondes(250)).toBe('+0,25 s');
  });
});

describe('le réglage manuel, et son effet dit', () => {
  it('un pas déplace le décalage d’un pas entier', () => {
    expect(decalerOffset(-400, 1)).toBe(-400 + PAS_REGLAGE_MS);
    expect(decalerOffset(-400, -1)).toBe(-400 - PAS_REGLAGE_MS);
  });

  it('la ligne qui accompagne le geste dit ce qu’un pas déplace', () => {
    expect(phraseDuPas()).toBe("Chaque pas déplace les mesures de 0,10 s sur l'image.");
  });

  it('l’effet du geste est dit à l’indicatif, jamais à l’impératif', () => {
    expect(effetDuPas(1)).toBe("Les mesures avancent de 0,10 s sur l'image.");
    expect(effetDuPas(-1)).toBe("Les mesures reculent de 0,10 s sur l'image.");
  });
});

// ===========================================================================
// Doctrine
// ===========================================================================

describe('doctrine — ce que le module ne dira jamais', () => {
  const sorties = [
    synchroniserVideo(entree({})),
    synchroniserVideo(entree({ trames: SERIE_COURTE })),
    synchroniserVideo(entree({ trames: SERIE_COURTE, offsetManuelMs: -400 })),
    synchroniserVideo(
      entree({
        trames: SERIE_LONGUE,
        video: { dureeMs: 14000, imagesParSeconde: 30 },
        offsetManuelMs: 3000,
        reperes: [
          { positionVideoMs: 1050, evenement: 'depart-arrete' },
          { positionVideoMs: 3000, evenement: 'freinage-franc' },
          { positionVideoMs: 10040, evenement: 'depart-arrete' },
        ],
      })
    ),
  ];

  const textes = sorties.flatMap((s) => [
    s.phrase,
    ...s.motifs,
    ...s.budget.map((p) => `${p.libelle} ${p.motif}`),
    ...s.evenementsDisponibles.map((e) => e.fait),
    ...(s.derive === null ? [] : [s.derive.fait]),
  ]);

  it('jamais le mot « limite »', () => {
    expect(textes.filter((t) => /limite/i.test(t))).toEqual([]);
  });

  it('jamais une synchronisation dite parfaite, ni un ±0,00 s', () => {
    expect(textes.filter((t) => /parfait/i.test(t))).toEqual([]);
    expect(textes.filter((t) => /±0,00/.test(t))).toEqual([]);
  });

  it('aucun verbe prescriptif', () => {
    const prescriptif = /\b(vous devriez|il faut|évitez|freinez|accélérez|recalez|réglez)\b/i;
    expect(textes.filter((t) => prescriptif.test(t))).toEqual([]);
  });

  it('une erreur rendue est toujours strictement positive', () => {
    for (const s of sorties) {
      if (s.erreurMs !== null) expect(s.erreurMs).toBeGreaterThan(0);
    }
  });
});
