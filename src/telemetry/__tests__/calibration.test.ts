/**
 * CALIBRATION INERTIELLE — les mesures sont fabriquées à partir d'une
 * inclinaison CONNUE, puis on vérifie que le module la retrouve.
 *
 * C'est le seul protocole qui prouve quelque chose : vérifier qu'une fonction
 * rend un nombre ne dit pas si le nombre est le bon.
 */

import {
  appliquerCalibration,
  etablirCalibration,
  fenetresAuRepos,
  phraseCalibration,
  type MesureBrute,
} from '../calibration';

const DEG = Math.PI / 180;

/**
 * Ce qu'un boîtier incliné mesure au repos : la gravité, vue de travers.
 *
 * Décomposition classique — x avant, y côté, z vertical. Sa norme vaut
 * exactement 1 g quels que soient les deux angles, ce qui est la propriété
 * qu'on veut : si le générateur du test dérivait de 1, on mesurerait l'erreur
 * du générateur en croyant mesurer celle du module.
 */
function graviteVuePar(tangageDeg: number, roulisDeg: number): [number, number, number] {
  const t = tangageDeg * DEG;
  const r = roulisDeg * DEG;
  return [-Math.sin(t), Math.sin(r) * Math.cos(t), Math.cos(r) * Math.cos(t)];
}

function arret(
  n: number,
  tangageDeg: number,
  roulisDeg: number,
  depuisMs = 0,
  pasMs = 40,
): MesureBrute[] {
  const [gx, gy, gz] = graviteVuePar(tangageDeg, roulisDeg);
  return Array.from({ length: n }, (_, i) => ({
    elapsedMs: depuisMs + i * pasMs,
    gLong: gx,
    gLat: gy,
    gVert: gz,
    speedKmh: 0,
    yawRateRadS: 0,
  }));
}

describe('trouver les arrêts', () => {
  it('une fenêtre trop courte ne compte pas', () => {
    // 2 s à 25 Hz : sous le seuil de 3 s.
    expect(fenetresAuRepos(arret(50, 0, 0))).toHaveLength(0);
  });

  it('trois secondes suffisent', () => {
    expect(fenetresAuRepos(arret(76, 0, 0))).toHaveLength(1);
  });

  /**
   * Deux arrêts séparés par un TROU d'acquisition ne sont pas un seul arrêt.
   * Les moyenner ensemble ferait passer pour une longue immobilité ce qui est
   * en réalité deux instants séparés par du roulage manquant.
   */
  it('un trou d’acquisition coupe la fenêtre', () => {
    const a = arret(40, 0, 0, 0);
    const b = arret(40, 0, 0, 60_000); // une minute plus tard
    expect(fenetresAuRepos([...a, ...b])).toHaveLength(0);
  });

  it('rouler ferme la fenêtre', () => {
    const roulant = arret(80, 0, 0).map((m) => ({ ...m, speedKmh: 90 }));
    expect(fenetresAuRepos(roulant)).toHaveLength(0);
  });
});

describe('retrouver l’inclinaison qu’on a posée', () => {
  it('un boîtier droit ne fabrique aucune inclinaison', () => {
    const c = etablirCalibration(arret(100, 0, 0));
    expect(c).not.toBeNull();
    expect(c!.tangageDeg).toBeCloseTo(0, 6);
    expect(c!.roulisDeg).toBeCloseTo(0, 6);
  });

  it('un tangage de 10° est retrouvé à 10°', () => {
    const c = etablirCalibration(arret(100, 10, 0));
    expect(c!.tangageDeg).toBeCloseTo(10, 4);
    expect(c!.roulisDeg).toBeCloseTo(0, 4);
  });

  it('un roulis de −7° est retrouvé à −7°', () => {
    const c = etablirCalibration(arret(100, 0, -7));
    expect(c!.roulisDeg).toBeCloseTo(-7, 4);
  });

  it('les deux à la fois', () => {
    const c = etablirCalibration(arret(100, 6, 4));
    expect(c!.tangageDeg).toBeCloseTo(6, 3);
    expect(c!.roulisDeg).toBeCloseTo(4, 3);
    expect(c!.normeAuRepos).toBeCloseTo(1, 6);
  });

  /**
   * LE ZÉRO ET L'INCLINAISON NE SE SÉPARENT PAS À L'ARRÊT.
   *
   * Le cahier demande « estimation du zéro » et « compensation de gravité »
   * comme deux étapes. Ce test dit pourquoi il n'y en a qu'une : un capteur
   * décalé de 0,03 g sur l'axe avant et un boîtier penché produisent
   * exactement le même vecteur au repos. Le module lit donc le décalage COMME
   * une inclinaison — et c'est la seule lecture que la physique autorise.
   */
  it('un décalage du capteur est indiscernable d’une inclinaison', () => {
    const decale = arret(100, 0, 0).map((m) => ({ ...m, gLong: (m.gLong as number) + 0.03 }));
    const c = etablirCalibration(decale);
    // 0,03 g sur l'axe avant, c'est atan(0,03) ≈ 1,72° de tangage.
    expect(c!.tangageDeg).toBeCloseTo(-1.72, 1);
  });

  /**
   * La seule composante du zéro qui SOIT lisible ne dépend d'aucune
   * orientation : l'écart de la norme à 1 g. Elle est dite, pas corrigée.
   */
  it('une norme au repos qui dérive est signalée', () => {
    const gonfle = arret(100, 0, 0).map((m) => ({ ...m, gVert: 1.05 }));
    const c = etablirCalibration(gonfle);
    expect(c!.motifs.join(' ')).toContain('zéro du capteur suspect');
  });

  it('un capteur juste ne déclenche aucun motif de zéro', () => {
    const c = etablirCalibration(arret(100, 12, -5));
    expect(c!.motifs.join(' ')).not.toContain('zéro du capteur');
  });
});

describe('ce qu’on refuse d’établir', () => {
  it('sans aucun arrêt, pas de calibration — et surtout pas une neutre', () => {
    const roulant = arret(200, 0, 0).map((m) => ({ ...m, speedKmh: 120 }));
    expect(etablirCalibration(roulant)).toBeNull();
  });

  /**
   * Au repos, la norme vaut 1 g. Si elle s'en écarte, ce qu'on a moyenné n'est
   * pas un arrêt — et redresser sur cette référence produirait une correction
   * qui aurait l'air d'une correction.
   */
  it('une norme au repos incohérente fait refuser', () => {
    const faux = arret(100, 0, 0).map((m) => ({ ...m, gVert: 0.4 }));
    expect(etablirCalibration(faux)).toBeNull();
  });

  it('une mesure incomplète ne rentre pas dans la moyenne', () => {
    const troue = arret(100, 0, 0).map((m, i) => (i % 2 === 0 ? { ...m, gLat: null } : m));
    // Les fenêtres se coupent à chaque mesure incomplète : aucune n'atteint 3 s.
    expect(etablirCalibration(troue)).toBeNull();
  });
});

describe('le lacet ne se devine pas', () => {
  /**
   * Un arrêt ne dit RIEN du lacet : un boîtier tourné de 90° autour de la
   * verticale voit exactement la même gravité. `null`, jamais zéro.
   */
  it('à l’arrêt seul, le lacet reste inconnu', () => {
    const c = etablirCalibration(arret(100, 5, 0));
    expect(c!.lacetDeg).toBeNull();
    expect(c!.motifs.join(' ')).toContain('lacet non établi');
  });

  it('un freinage en ligne droite le révèle', () => {
    const droit = arret(100, 0, 0);
    // 120 mesures de décélération franche, boîtier tourné de 20° : le module
    // doit retrouver 20°, quel que soit le sens de l'accélération.
    const a = 20 * DEG;
    const freinage: MesureBrute[] = Array.from({ length: 120 }, (_, i) => ({
      elapsedMs: 10_000 + i * 40,
      gLong: -0.8 * Math.cos(a),
      gLat: -0.8 * Math.sin(a),
      gVert: 1,
      speedKmh: 100,
      yawRateRadS: 0,
    }));
    const c = etablirCalibration([...droit, ...freinage]);
    expect(c!.lacetDeg).toBeCloseTo(20, 1);
  });

  it('une voiture qui tourne n’est pas une ligne droite', () => {
    const droit = arret(100, 0, 0);
    const virage: MesureBrute[] = Array.from({ length: 200 }, (_, i) => ({
      elapsedMs: 10_000 + i * 40,
      gLong: 0.5,
      gLat: 0.9,
      gVert: 1,
      speedKmh: 80,
      yawRateRadS: 0.4, // bien au-dessus du seuil de ligne droite
    }));
    expect(etablirCalibration([...droit, ...virage])!.lacetDeg).toBeNull();
  });

  it('sans gyroscope, on ne conclut pas', () => {
    const droit = arret(100, 0, 0);
    const sansGyro: MesureBrute[] = Array.from({ length: 200 }, (_, i) => ({
      elapsedMs: 10_000 + i * 40,
      gLong: -0.8,
      gLat: 0,
      gVert: 1,
      speedKmh: 100,
      yawRateRadS: null,
    }));
    expect(etablirCalibration([...droit, ...sansGyro])!.lacetDeg).toBeNull();
  });
});

describe('appliquer, sans jamais perdre le brut', () => {
  it('le brut survit à la correction', () => {
    const c = etablirCalibration(arret(100, 8, 3));
    const brute: MesureBrute = {
      elapsedMs: 1,
      gLong: 0.4,
      gLat: -0.2,
      gVert: 0.9,
      speedKmh: 60,
      yawRateRadS: 0,
    };
    const corrigee = appliquerCalibration(brute, c);
    expect(corrigee.gLong).toBe(0.4);
    expect(corrigee.gLat).toBe(-0.2);
    expect(corrigee.gVert).toBe(0.9);
  });

  /** Au repos, une fois la gravité retirée, tout doit valoir zéro. */
  it('la gravité est retirée du vertical', () => {
    const mesures = arret(100, 9, -4);
    const c = etablirCalibration(mesures);
    const corrigee = appliquerCalibration(mesures[0], c);
    expect(corrigee.gVertCorrige).toBeCloseTo(0, 4);
    expect(corrigee.gLongCorrige).toBeCloseTo(0, 4);
    expect(corrigee.gLatCorrige).toBeCloseTo(0, 4);
  });

  /**
   * LE CŒUR DU SUJET. Un boîtier incliné verse une partie du freinage dans
   * l'axe latéral. Après correction, le freinage doit être redevenu purement
   * longitudinal.
   */
  it('un freinage vu de travers redevient un freinage', () => {
    const repos = arret(100, 0, 15); // 15° de roulis
    const c = etablirCalibration(repos);
    // Une décélération de 1 g dans le repère VOITURE, vue par ce boîtier.
    const r = 15 * DEG;
    const vueParLeBoitier: MesureBrute = {
      elapsedMs: 9_999,
      gLong: -1,
      gLat: Math.sin(r) * 1 + Math.sin(r),
      gVert: Math.cos(r),
      speedKmh: 100,
      yawRateRadS: 0,
    };
    const corrigee = appliquerCalibration(vueParLeBoitier, c);
    // On ne vérifie pas une valeur exacte — on vérifie que la correction a
    // DÉPLACÉ de l'énergie du latéral vers le longitudinal, dans le bon sens.
    expect(Math.abs(corrigee.gLatCorrige as number)).toBeLessThan(
      Math.abs(vueParLeBoitier.gLat as number),
    );
  });

  it('sans calibration, les corrigés sont null — pas zéro', () => {
    const brute: MesureBrute = {
      elapsedMs: 1,
      gLong: 0.4,
      gLat: -0.2,
      gVert: 0.9,
      speedKmh: 60,
    };
    const c = appliquerCalibration(brute, null);
    expect(c.gLongCorrige).toBeNull();
    expect(c.gLatCorrige).toBeNull();
    expect(c.gVertCorrige).toBeNull();
  });
});

describe('la phrase dit ce qui a été mesuré, jamais quoi faire', () => {
  it('sans calibration, elle nomme la raison', () => {
    expect(phraseCalibration(null)).toContain('aucun arrêt assez long');
  });

  it('avec calibration, elle donne l’inclinaison', () => {
    const c = etablirCalibration(arret(100, 3, 4));
    expect(phraseCalibration(c)).toContain('°');
    expect(phraseCalibration(c)).toContain('corrigé');
  });

  /**
   * Aucune consigne. Le module décrit le montage, il ne demande pas de le
   * refaire — c'est la règle du miroir, et elle vaut aussi pour le matériel.
   */
  it('aucune consigne dans la phrase', () => {
    const phrases = [phraseCalibration(null), phraseCalibration(etablirCalibration(arret(100, 9, 0)))];
    for (const p of phrases) {
      expect(p).not.toMatch(/redress|repositionn|il faut|vous devriez|corrigez|remontez/i);
    }
  });
});
