import { analyzeCornerExit, consistency } from '../accel';
import { brakingDispersion, detectBrakingZones } from '../braking';
import { exploitationRate, reachedHull, trailBrakingOverlap, type GgPoint } from '../gg';
import {
  computeKinematics,
  cumulativeDistance,
  curvature,
  lateralAcceleration,
  longitudinalAcceleration,
  savitzkyGolay,
  type Sample,
} from '../kinematics';
import { buildGrid, resampleOnGrid } from '../resample';
import { apexIndex, segmentLap } from '../segment';

const G = 9.80665;

// ---------------------------------------------------------------------------
// Cinématique
// ---------------------------------------------------------------------------

describe('cumulativeDistance', () => {
  it('intègre la vitesse par trapèzes', () => {
    // 10 m/s pendant 10 s = 100 m.
    const s: Sample[] = Array.from({ length: 101 }, (_, i) => ({ t: i / 10, speed: 10 }));
    const d = cumulativeDistance(s);
    expect(d[0]).toBe(0);
    expect(d[d.length - 1]).toBeCloseTo(100, 6);
  });

  it('est exacte sur une accélération linéaire — le trapèze n’approxime pas', () => {
    // v = 2t sur 10 s : distance = t² = 100 m.
    const s: Sample[] = Array.from({ length: 1001 }, (_, i) => ({
      t: i / 100,
      speed: 2 * (i / 100),
    }));
    expect(cumulativeDistance(s).at(-1)).toBeCloseTo(100, 6);
  });

  it('ne recule jamais', () => {
    const s: Sample[] = Array.from({ length: 50 }, (_, i) => ({
      t: i / 25,
      speed: Math.abs(Math.sin(i)) * 30,
    }));
    const d = cumulativeDistance(s);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
  });
});

describe('longitudinalAcceleration', () => {
  it('rend null aux bornes — une dérivée n’existe pas d’un seul côté', () => {
    const s: Sample[] = Array.from({ length: 5 }, (_, i) => ({ t: i, speed: i }));
    const a = longitudinalAcceleration(s);
    expect(a[0]).toBeNull();
    expect(a[a.length - 1]).toBeNull();
  });

  it('chiffre correctement une accélération constante', () => {
    // +1 m/s² = 1/9,80665 g.
    const s: Sample[] = Array.from({ length: 20 }, (_, i) => ({ t: i, speed: i }));
    expect(longitudinalAcceleration(s)[5]).toBeCloseTo(1 / G, 9);
  });

  it('rend une valeur négative en décélération', () => {
    const s: Sample[] = Array.from({ length: 20 }, (_, i) => ({ t: i, speed: 50 - 2 * i }));
    expect(longitudinalAcceleration(s)[5]).toBeCloseTo(-2 / G, 9);
  });
});

describe('lateralAcceleration — la voie gyroscopique, jamais GForceY', () => {
  it('applique a_lat = v × ω', () => {
    const s: Sample[] = [{ t: 0, speed: 30, yawRate: 0.2 }];
    expect(lateralAcceleration(s)[0]).toBeCloseTo((30 * 0.2) / G, 9);
  });

  // Le point doctrinal : PAS de repli sur l'accéléromètre, biaisé par le dévers.
  it('rend null sans vitesse de lacet plutôt qu’une valeur biaisée', () => {
    expect(lateralAcceleration([{ t: 0, speed: 30 }])[0]).toBeNull();
  });

  it('porte le signe du sens de rotation', () => {
    const d = lateralAcceleration([{ t: 0, speed: 30, yawRate: 0.2 }])[0]!;
    const g = lateralAcceleration([{ t: 0, speed: 30, yawRate: -0.2 }])[0]!;
    expect(Math.sign(d)).toBe(1);
    expect(Math.sign(g)).toBe(-1);
  });
});

describe('curvature — 1/R, jamais R', () => {
  it('vaut ω/v', () => {
    expect(curvature([{ t: 0, speed: 20, yawRate: 0.1 }])[0]).toBeCloseTo(0.005, 9);
  });

  // R divergerait ici ; la courbure vaut simplement zéro.
  it('vaut zéro en ligne droite, sans diverger', () => {
    expect(curvature([{ t: 0, speed: 60, yawRate: 0 }])[0]).toBe(0);
  });

  it('rend null à l’arrêt — la courbure n’y existe pas', () => {
    expect(curvature([{ t: 0, speed: 0.1, yawRate: 0.5 }])[0]).toBeNull();
  });
});

describe('computeKinematics', () => {
  it('étiquette l’origine de chaque grandeur', () => {
    const k = computeKinematics([{ t: 0, speed: 10, yawRate: 0 }]);
    expect(k.origines.speed).toBe('mesure');
    expect(k.origines.aLong).toBe('derivation');
    expect(k.origines.aLat).toBe('derivation');
    expect(k.origines.curvature).toBe('derivation');
  });
});

describe('savitzkyGolay', () => {
  it('préserve une droite — un filtre d’ordre 2 doit être exact dessus', () => {
    const v = Array.from({ length: 30 }, (_, i) => 2 * i + 5);
    const f = savitzkyGolay(v, 7);
    for (let i = 0; i < v.length; i++) expect(f[i]).toBeCloseTo(v[i], 6);
  });

  it('préserve une parabole — ordre 2 également', () => {
    const v = Array.from({ length: 30 }, (_, i) => i * i);
    const f = savitzkyGolay(v, 7);
    for (let i = 3; i < v.length - 3; i++) expect(f[i]).toBeCloseTo(v[i], 6);
  });

  it('réduit le bruit sans écraser le pic', () => {
    const base = Array.from({ length: 60 }, (_, i) => (i === 30 ? 10 : 0));
    const bruite = base.map((x, i) => x + (i % 2 === 0 ? 0.4 : -0.4));
    const f = savitzkyGolay(bruite, 7);
    // Le bruit d'alternance est très atténué hors du pic...
    expect(Math.abs(f[10]!)).toBeLessThan(0.2);
    // ...et le pic reste largement présent.
    expect(f[30]!).toBeGreaterThan(2);
  });

  it('traverse les null sans les inventer', () => {
    const f = savitzkyGolay([null, null, null], 5);
    expect(f.every((x) => x === null)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Ré-échantillonnage
// ---------------------------------------------------------------------------

describe('resample — base distance', () => {
  it('bâtit une grille régulière', () => {
    expect(buildGrid(20, 5)).toEqual([0, 5, 10, 15, 20]);
  });

  it('refuse une grille absurde plutôt que d’en inventer une', () => {
    expect(buildGrid(0, 5)).toEqual([]);
    expect(buildGrid(20, 0)).toEqual([]);
    expect(buildGrid(NaN, 5)).toEqual([]);
  });

  it('interpole linéairement', () => {
    const r = resampleOnGrid({ distance: [0, 10], values: [0, 100] }, [0, 5, 10]);
    expect(r).toEqual([0, 50, 100]);
  });

  // N'EXTRAPOLE PAS : une valeur plausible hors emprise serait une invention.
  it('rend null hors de l’emprise de la trace', () => {
    const r = resampleOnGrid({ distance: [10, 20], values: [1, 2] }, [0, 15, 30]);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeCloseTo(1.5, 9);
    expect(r[2]).toBeNull();
  });

  it('ne comble pas un trou par une moyenne', () => {
    const r = resampleOnGrid({ distance: [0, 10, 20], values: [0, null, 100] }, [5, 15]);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Segmentation
// ---------------------------------------------------------------------------

describe('segmentLap', () => {
  /** Piste : 200 m droits, un virage de 200 m, 200 m droits. Pas de 1 m. */
  function piste(): { c: (number | null)[]; d: number[] } {
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 600; i++) {
      d.push(i);
      c.push(i >= 200 && i < 400 ? 1 / 50 : 0);
    }
    return { c, d };
  }

  it('reconnaît droite, virage, droite', () => {
    const { c, d } = piste();
    const segs = segmentLap(c, d);
    expect(segs.map((s) => s.kind)).toEqual(['droite', 'virage', 'droite']);
  });

  it('situe le virage au bon endroit', () => {
    const { c, d } = piste();
    const v = segmentLap(c, d).find((s) => s.kind === 'virage')!;
    expect(v.distanceFrom).toBeCloseTo(200, 0);
    // Les indices 200 à 399 portent la courbure : cela fait 200 POINTS, donc
    // 199 INTERVALLES. La longueur d'un segment est la distance entre ses
    // bornes, pas le compte de ses points.
    expect(v.distanceTo).toBeCloseTo(399, 0);
    expect(v.length).toBeCloseTo(199, 0);
  });

  it('donne le sens de rotation, et rien sur une droite', () => {
    const { c, d } = piste();
    const segs = segmentLap(c, d);
    expect(segs.find((s) => s.kind === 'virage')!.rotation).toBe('droite');
    expect(segs.find((s) => s.kind === 'droite')!.rotation).toBeNull();
  });

  it('détecte un virage à gauche', () => {
    const { c, d } = piste();
    const gauche = c.map((x) => (x === null ? null : -x));
    expect(segmentLap(gauche, d).find((s) => s.kind === 'virage')!.rotation).toBe('gauche');
  });

  // LE point du module : sans hystérésis, le bruit hacherait le virage.
  it('ne hache pas un virage dont la courbure oscille autour du seuil', () => {
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 600; i++) {
      d.push(i);
      if (i < 200 || i >= 400) c.push(0);
      else c.push(i % 2 === 0 ? 1 / 190 : 1 / 260); // oscille autour de 1/200
    }
    const virages = segmentLap(c, d).filter((s) => s.kind === 'virage');
    expect(virages).toHaveLength(1);
  });

  it('absorbe les segments trop courts', () => {
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 600; i++) {
      d.push(i);
      c.push(i >= 300 && i < 303 ? 1 / 20 : 0); // 3 m de courbure : du bruit
    }
    expect(segmentLap(c, d).filter((s) => s.kind === 'virage')).toHaveLength(0);
  });

  // Le trou du filtre, relevé le 04/08/2026 : le premier segment n'a pas de
  // voisin précédent, donc il échappait à l'absorption. Trois mètres de bruit
  // en tête de tour ressortaient comme un segment ; les trois mêmes mètres au
  // milieu du tour étaient absorbés. Le filtre était troué toujours au même
  // endroit.
  it('absorbe un segment de TÊTE trop court, qui n’a pas de précédent', () => {
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 600; i++) {
      d.push(i);
      c.push(i < 3 ? 1 / 20 : 0); // 3 m de courbure EN TÊTE : du bruit
    }
    const segs = segmentLap(c, d);
    expect(segs.filter((s) => s.kind === 'virage')).toHaveLength(0);
    expect(segs).toHaveLength(1);
    // Le tour reste couvert de bout en bout : absorber n'est pas amputer.
    expect(segs[0].distanceFrom).toBeCloseTo(0, 6);
    expect(segs[0].distanceTo).toBeCloseTo(600, 6);
  });

  it('le segment de tête absorbé prend le sens de celui qui l’accueille', () => {
    // Symétrie de l'absorption arrière, qui conserve le sens du PRÉCÉDENT :
    // sans précédent, c'est le SUIVANT qui donne le sens.
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 600; i++) {
      d.push(i);
      c.push(i < 3 ? 0 : i < 400 ? -1 / 50 : 0); // 3 m droits, puis gauche
    }
    const segs = segmentLap(c, d);
    expect(segs[0].kind).toBe('virage');
    expect(segs[0].rotation).toBe('gauche');
    expect(segs[0].distanceFrom).toBeCloseTo(0, 6);
  });

  it('un tour plus court que le filtre ne rend AUCUN segment', () => {
    // Le contrat annoncé en tête de module : « pas un faux segment couvrant
    // tout le tour, qui laisserait croire à une analyse ». Dix mètres ne se
    // découpent pas en droites et en virages.
    const c: (number | null)[] = [];
    const d: number[] = [];
    for (let i = 0; i <= 10; i++) {
      d.push(i);
      c.push(i >= 4 && i < 7 ? 1 / 20 : 0);
    }
    expect(segmentLap(c, d)).toEqual([]);
  });

  it('rend une liste vide sur une entrée illisible', () => {
    expect(segmentLap([], [])).toEqual([]);
    expect(segmentLap([0], [0])).toEqual([]);
  });
});

describe('apexIndex — la vitesse minimale, un fait mesuré', () => {
  it('trouve le minimum du segment', () => {
    expect(apexIndex([50, 40, 22, 35, 48], 0, 4)).toBe(2);
  });

  it('rend null si rien n’est exploitable', () => {
    expect(apexIndex([null, null], 0, 1)).toBeNull();
  });

  // Le bornage EST la raison d'être des paramètres `from` et `to` : c'est lui
  // qui rend la fonction utilisable segment par segment. Jusqu'au 04/08/2026,
  // les deux tests ci-dessus portaient sur le tableau ENTIER — une
  // implémentation qui aurait ignoré `from` et `to` les aurait passés tous les
  // deux.
  it('cherche DANS le segment, pas dans toute la trace', () => {
    //                0   1   2   3   4   5   6
    const v = [50, 40, 12, 35, 48, 26, 44];
    // Le minimum global est à l'indice 2, hors du segment demandé.
    expect(apexIndex(v, 3, 6)).toBe(5);
    // Et symétriquement, un segment qui s'arrête avant le minimum global.
    expect(apexIndex(v, 0, 1)).toBe(1);
  });

  it('rend null sur un segment vide plutôt que le minimum global', () => {
    expect(apexIndex([50, 40, 12, 35], 3, 2)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Freinage
// ---------------------------------------------------------------------------

describe('detectBrakingZones — seuil −0,3 g', () => {
  /** 5 s de roulage, freinage franc entre 2 et 3 s. */
  function trace(aFreinage: number) {
    const n = 126;
    const time: number[] = [];
    const speed: number[] = [];
    const distance: number[] = [];
    const aLong: (number | null)[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / 25;
      time.push(t);
      const freine = t >= 2 && t < 3;
      aLong.push(freine ? aFreinage : 0);
      speed.push(freine ? 50 - (t - 2) * 10 : 50);
      distance.push(t * 50);
    }
    return { time, speed, distance, aLong };
  }

  it('détecte une zone de freinage franc', () => {
    const { time, speed, distance, aLong } = trace(-0.8);
    const z = detectBrakingZones(aLong, speed, distance, time);
    expect(z).toHaveLength(1);
    expect(z[0].peakG).toBeCloseTo(-0.8, 6);
  });

  // Le motif du seuil : ne pas prendre un lever de pied pour un freinage.
  it('IGNORE un simple frein moteur à −0,2 g', () => {
    const { time, speed, distance, aLong } = trace(-0.2);
    expect(detectBrakingZones(aLong, speed, distance, time)).toHaveLength(0);
  });

  it('rapporte durée, longueur et vitesses aux bornes', () => {
    const { time, speed, distance, aLong } = trace(-0.9);
    const z = detectBrakingZones(aLong, speed, distance, time)[0];
    expect(z.duration).toBeGreaterThan(0.9);
    expect(z.length).toBeGreaterThan(0);
    expect(z.entrySpeed).toBeGreaterThan(z.exitSpeed);
  });

  it('écarte une zone trop brève', () => {
    const time = [0, 0.04, 0.08];
    const r = detectBrakingZones([-0.9, -0.9, -0.9], [50, 49, 48], [0, 2, 4], time, {
      minDuration: 1,
    });
    expect(r).toHaveLength(0);
  });

  it('rend une liste vide sans freinage — un fait, pas une erreur', () => {
    const { time, speed, distance, aLong } = trace(0);
    expect(detectBrakingZones(aLong, speed, distance, time)).toEqual([]);
  });
});

describe('brakingDispersion', () => {
  it('rend moyenne, écart-type, médiane et MAD', () => {
    const r = brakingDispersion([100, 102, 98, 101, 99])!;
    expect(r.mean).toBeCloseTo(100, 6);
    expect(r.median).toBeCloseTo(100, 6);
    expect(r.stdDev).toBeGreaterThan(0);
    expect(r.mad).toBeGreaterThan(0);
  });

  // Le motif de la médiane : un tour bloqué dans le trafic ne doit pas tout
  // décaler.
  it('la médiane résiste à un tour aberrant, la moyenne non', () => {
    const r = brakingDispersion([100, 101, 99, 100, 400])!;
    expect(Math.abs(r.median - 100)).toBeLessThan(2);
    expect(Math.abs(r.mean - 100)).toBeGreaterThan(50);
  });

  it('rend null sous deux points', () => {
    expect(brakingDispersion([100])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sortie de virage
// ---------------------------------------------------------------------------

describe('analyzeCornerExit', () => {
  const speed = [60, 45, 30, 28, 32, 45, 60];
  const aLong = [null, -0.5, -0.3, 0.02, 0.4, 0.5, null];

  it('trouve l’apex — vitesse minimale', () => {
    const r = analyzeCornerExit(speed, aLong, 0, 6);
    expect(r.apexIndex).toBe(3);
    expect(r.minSpeed).toBe(28);
  });

  it('cherche la remise des gaz APRÈS l’apex seulement', () => {
    const r = analyzeCornerExit(speed, aLong, 0, 6);
    expect(r.throttleOnIndexEstimated).toBe(4);
  });

  it('rend null si l’accélération ne redevient jamais franche', () => {
    const r = analyzeCornerExit([50, 40, 30], [null, -0.5, 0.01], 0, 2);
    expect(r.throttleOnIndexEstimated).toBeNull();
  });

  // Même trou que sur `apexIndex` : les quatre tests d'origine portaient tous
  // sur la trace entière. Or un tour porte plusieurs virages, et c'est le
  // bornage qui les distingue.
  it('reste DANS le segment demandé', () => {
    // Deux virages dans la même trace. Le second est plus lent que le premier :
    // une implémentation qui ignorerait `from` verrait toujours le second.
    //                0   1   2   3   4   5   6   7   8   9  10
    const v = [60, 45, 34, 38, 55, 60, 50, 30, 22, 33, 55];
    const a = [null, -0.5, -0.2, 0.3, 0.5, 0.1, -0.4, -0.5, 0.05, 0.45, null];

    const premier = analyzeCornerExit(v, a, 0, 5);
    expect(premier.apexIndex).toBe(2);
    expect(premier.minSpeed).toBe(34);
    expect(premier.exitSpeed).toBe(60);

    const second = analyzeCornerExit(v, a, 6, 10);
    expect(second.apexIndex).toBe(8);
    expect(second.minSpeed).toBe(22);
    expect(second.exitSpeed).toBe(55);
  });

  // Le seuil de relance était une constante privée jusqu'au 04/08/2026, alors
  // que `docs/T1BIS_CALCUL.md:136` annonçait « les seuils sont tous
  // paramétrables ». Ce test tient la promesse du document.
  it('accepte un seuil de relance passé en option', () => {
    const v = [50, 30, 32, 40];
    const a = [null, 0.02, 0.05, 0.4];

    // Au défaut (0,1 g), les 0,05 g ne comptent pas comme une remise des gaz.
    expect(analyzeCornerExit(v, a, 0, 3).throttleOnIndexEstimated).toBe(3);
    // Abaissé à 0,04 g, elle est retenue plus tôt.
    expect(analyzeCornerExit(v, a, 0, 3, { seuilRelanceG: 0.04 }).throttleOnIndexEstimated).toBe(2);
  });

  // `meanAccelG` était calculé, exposé, et vérifié nulle part.
  it('chiffre la relance moyenne sur la fenêtre apex → sortie', () => {
    const v = [50, 30, 35, 45];
    const a = [null, 0.2, 0.4, 0.6];
    // Apex à l'indice 1. Moyenne de 0,2 · 0,4 · 0,6 = 0,4.
    expect(analyzeCornerExit(v, a, 0, 3).meanAccelG).toBeCloseTo(0.4, 9);
  });

  it('la relance moyenne porte TOUTE la fenêtre, freinage résiduel compris', () => {
    // Limite assumée, pas un défaut : la fenêtre est apex → sortie, et la
    // moyenne ne filtre pas le signe. Sur un double apex — une reprise de
    // frein après le premier point de corde — elle est diluée, et rien ne le
    // dit à la lecture. À reprendre au premier jeu de données réel, où l'on
    // saura si ce cas se présente.
    const v = [50, 30, 34, 31, 45];
    const a = [null, 0.4, -0.4, 0.4, 0.4];
    // Apex à l'indice 1. Moyenne de 0,4 · −0,4 · 0,4 · 0,4 = 0,2.
    expect(analyzeCornerExit(v, a, 0, 4).meanAccelG).toBeCloseTo(0.2, 9);
  });

  it('rend tout null sur un segment vide', () => {
    const r = analyzeCornerExit([], [], 0, 5);
    expect(r.apexIndex).toBeNull();
    expect(r.minSpeed).toBeNull();
    expect(r.exitSpeed).toBeNull();
  });
});

describe('consistency', () => {
  it('rend les quatre mesures', () => {
    const r = consistency([90, 91, 89, 90])!;
    expect(r.mean).toBeCloseTo(90, 6);
    expect(r.cv).toBeGreaterThan(0);
    expect(r.median).toBeCloseTo(90, 6);
  });

  it('rend un cv null autour d’une moyenne nulle', () => {
    expect(consistency([-1, 1])!.cv).toBeNull();
  });

  it('rend null sous deux valeurs', () => {
    expect(consistency([90])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Enveloppe d'adhérence
// ---------------------------------------------------------------------------

describe('reachedHull — enveloppe ATTEINTE', () => {
  it('rend un contour ne passant que par des points réels', () => {
    const pts: GgPoint[] = [
      { lat: -1, long: 0 },
      { lat: 1, long: 0 },
      { lat: 0, long: -1 },
      { lat: 0, long: 1 },
      { lat: 0, long: 0 }, // intérieur
    ];
    const e = reachedHull(pts);
    expect(e.hull).toHaveLength(4);
    for (const h of e.hull) {
      expect(pts.some((p) => p.lat === h.lat && p.long === h.long)).toBe(true);
    }
  });

  it('rapporte la magnitude maximale', () => {
    const e = reachedHull([
      { lat: 0.3, long: 0.4 },
      { lat: 0, long: 0 },
      { lat: -0.3, long: 0 },
    ]);
    expect(e.peak).toBeCloseTo(0.5, 9);
  });

  it('rend un contour vide sur des points alignés — pas une aire nulle', () => {
    const e = reachedHull([
      { lat: 0, long: 0 },
      { lat: 1, long: 1 },
      { lat: 2, long: 2 },
    ]);
    expect(e.hull).toEqual([]);
  });

  it('rend un contour vide sous trois points', () => {
    expect(reachedHull([{ lat: 0, long: 0 }]).hull).toEqual([]);
  });
});

describe('exploitationRate', () => {
  it('mesure la part passée près de l’enveloppe', () => {
    const pts: GgPoint[] = [
      { lat: 1, long: 0 },
      { lat: 0.95, long: 0 },
      { lat: 0.1, long: 0 },
      { lat: 0.1, long: 0 },
    ];
    const r = exploitationRate(pts, 0.9)!;
    expect(r.rate).toBeCloseTo(0.5, 6);
    expect(r.count).toBe(4);
  });

  // Le dossier classe cette grandeur « moyennement robuste » : le module le dit.
  it('déclare sa fiabilité plutôt que de la laisser deviner', () => {
    expect(exploitationRate([{ lat: 1, long: 0 }])!.reliability).toBe('moyenne');
  });

  it('rend null sans enveloppe mesurable', () => {
    expect(exploitationRate([])).toBeNull();
    expect(exploitationRate([{ lat: 0, long: 0 }])).toBeNull();
  });
});

describe('trailBrakingOverlap — une forme observée, pas une note', () => {
  it('compte les échantillons portant freinage ET appui', () => {
    const r = trailBrakingOverlap([
      { lat: 0.5, long: -0.4 }, // les deux
      { lat: 0.5, long: 0.2 }, // appui seul
      { lat: 0.05, long: -0.4 }, // freinage seul
      { lat: 0.6, long: -0.3 }, // les deux
    ])!;
    expect(r.fraction).toBeCloseTo(0.5, 6);
  });

  it('rend null sans échantillon', () => {
    expect(trailBrakingOverlap([])).toBeNull();
  });
});
