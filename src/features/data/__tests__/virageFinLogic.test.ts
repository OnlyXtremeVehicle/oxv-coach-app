/**
 * Fin de virage — le chevauchement et la rotation disent-ils des FAITS ?
 *
 * Deux dangers spécifiques à ces lectures, que ces tests verrouillent :
 *
 * 1. **Le vocabulaire.** Le libellé imposé est « chevauchement
 *    décélération/rotation estimé » — jamais le terme anglais de la
 *    littérature, jamais une commande du pilote que le boîtier ne mesure pas,
 *    jamais un diagnostic de châssis. Un test scanne le source ET toutes les
 *    chaînes produites.
 *
 * 2. **Le verdict forcé.** Quand le signal ne suffit pas, la sortie doit
 *    proposer des lectures possibles (`alternatives`), pas trancher. Une
 *    valeur non mesurable est `null`, jamais un zéro fabriqué.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  DUREE_DECELERATION_MIN_MS,
  LIBELLE_CHEVAUCHEMENT,
  MIN_ECHANTILLONS,
  SEUIL_ROTATION_DEG_S,
  VERSION_CHEVAUCHEMENT,
  VERSION_ROTATION,
  lireChevauchement,
  lireRotation,
  type EchantillonRotation,
  type EchantillonVirage,
} from '../virageFinLogic';

// ===========================================================================
// Générateurs — séries à 25 Hz (pas de 40 ms), interpolées linéairement
// ===========================================================================

const PAS_MS = 40;

/** Interpole une polyligne `[tMs, valeur]` sur une grille à 25 Hz. */
function polyligne(points: readonly [number, number][], tMs: number): number {
  if (tMs <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t0, v0] = points[i - 1];
    const [t1, v1] = points[i];
    if (tMs <= t1) return v0 + ((v1 - v0) * (tMs - t0)) / (t1 - t0);
  }
  return points[points.length - 1][1];
}

function serieVirage(
  finMs: number,
  gLong: readonly [number, number][],
  gLat: readonly [number, number][]
): EchantillonVirage[] {
  const serie: EchantillonVirage[] = [];
  for (let t = 0; t <= finMs; t += PAS_MS) {
    serie.push({
      tMs: t,
      gLong: polyligne(gLong, t),
      gLat: polyligne(gLat, t),
      vitesse: 30,
    });
  }
  return serie;
}

function serieRotation(finMs: number, lacet: readonly [number, number][]): EchantillonRotation[] {
  const serie: EchantillonRotation[] = [];
  for (let t = 0; t <= finMs; t += PAS_MS) {
    serie.push({ tMs: t, lacetDegParS: polyligne(lacet, t), gLat: null });
  }
  return serie;
}

/** Décélération franche puis relâché progressif PENDANT que le latéral monte. */
function passageAvecChevauchement(): EchantillonVirage[] {
  return serieVirage(
    2000,
    [
      [0, -0.8],
      [800, -0.8],
      [1600, -0.2],
      [2000, 0.1],
    ],
    [
      [0, 0.02],
      [800, 0.05],
      [1600, 1.0],
      [2000, 1.0],
    ]
  );
}

/** Décélération PUIS latéral : les deux phases se succèdent sans se recouvrir. */
function passageSuccessif(): EchantillonVirage[] {
  return serieVirage(
    1600,
    [
      [0, -0.7],
      [760, -0.7],
      [800, 0],
      [1600, 0],
    ],
    [
      [0, 0.02],
      [800, 0.02],
      [1600, 0.9],
    ]
  );
}

// ===========================================================================
// M14 — chevauchement décélération/rotation estimé
// ===========================================================================

describe('lireChevauchement (M14)', () => {
  it('porte le libellé imposé, une version et une confiance', () => {
    const r = lireChevauchement(passageAvecChevauchement());
    expect(r.libelle).toBe('chevauchement décélération/rotation estimé');
    expect(r.libelle).toBe(LIBELLE_CHEVAUCHEMENT);
    expect(r.version).toBe(VERSION_CHEVAUCHEMENT);
    expect(['haute', 'moyenne', 'faible']).toContain(r.confiance);
  });

  it('détecte la fenêtre où décélération et montée du latéral coexistent', () => {
    const r = lireChevauchement(passageAvecChevauchement());
    expect(r.fenetre).not.toBeNull();
    // Le chevauchement vit dans la phase de relâché (après 800 ms), pas au
    // freinage en ligne (latéral quasi nul).
    expect(r.fenetre!.debutMs).toBeGreaterThan(700);
    expect(r.fenetre!.finMs).toBeGreaterThan(r.fenetre!.debutMs);
    expect(r.dureeMs).toBe(r.fenetre!.finMs - r.fenetre!.debutMs);
    expect(r.confiance).toBe('haute');
  });

  it('mesure une pente de relâché positive quand la décélération se relâche', () => {
    const r = lireChevauchement(passageAvecChevauchement());
    // gLong remonte de −0,8 à −0,2 en 800 ms : ~0,75 g/s sur la queue.
    expect(r.penteRelacheGParS).not.toBeNull();
    expect(r.penteRelacheGParS!).toBeGreaterThan(0.3);
    expect(r.penteRelacheGParS!).toBeLessThan(1.5);
  });

  it('place la bascule au premier instant où le latéral dépasse le longitudinal', () => {
    const r = lireChevauchement(passageAvecChevauchement());
    // Croisement analytique |gLat| = |gLong| vers t ≈ 1187 ms.
    expect(r.basculeMs).not.toBeNull();
    expect(r.basculeMs!).toBeGreaterThan(1000);
    expect(r.basculeMs!).toBeLessThan(1400);
  });

  /** LE CAS QUI COMPTE : des phases successives ne font PAS un chevauchement. */
  it('des phases successives rendent une fenêtre nulle, pas une fenêtre inventée', () => {
    const r = lireChevauchement(passageSuccessif());
    expect(r.fenetre).toBeNull();
    expect(r.dureeMs).toBeNull();
    expect(r.basculeMs).toBeNull();
    // C'est un constat sur un signal sain, pas une lecture dégradée.
    expect(r.confiance).not.toBe('faible');
    expect(r.observations.length).toBeGreaterThan(0);
  });

  it('un latéral en plateau (non croissant) n’est pas lu comme un chevauchement', () => {
    const r = lireChevauchement(
      serieVirage(
        1200,
        [
          [0, -0.5],
          [1200, -0.5],
        ],
        [
          [0, 0.5],
          [1200, 0.5],
        ]
      )
    );
    expect(r.fenetre).toBeNull();
    expect(r.observations.join(' ')).toContain('plateau');
  });

  it('sans décélération soutenue, tout est null — jamais un zéro fabriqué', () => {
    const r = lireChevauchement(
      serieVirage(
        1200,
        [
          [0, 0.2],
          [1200, 0.2],
        ],
        [
          [0, 0.1],
          [1200, 0.8],
        ]
      )
    );
    expect(r.fenetre).toBeNull();
    expect(r.dureeMs).toBeNull();
    expect(r.penteRelacheGParS).toBeNull();
    expect(r.basculeMs).toBeNull();
    expect(r.confiance).toBe('faible');
  });

  it('une décélération plus courte que le minimum n’est pas « soutenue »', () => {
    // Deux échantillons sous le seuil : 40 ms, très loin des 300 requis.
    const serie = serieVirage(
      1200,
      [
        [0, 0],
        [560, 0],
        [600, -0.6],
        [640, -0.6],
        [680, 0],
        [1200, 0],
      ],
      [
        [0, 0.3],
        [1200, 0.3],
      ]
    );
    const r = lireChevauchement(serie);
    expect(DUREE_DECELERATION_MIN_MS).toBeGreaterThan(80);
    expect(r.fenetre).toBeNull();
    expect(r.confiance).toBe('faible');
  });

  it('trop peu d’échantillons exploitables : lecture refusée, pas approximée', () => {
    const serie = passageAvecChevauchement().slice(0, MIN_ECHANTILLONS - 1);
    const r = lireChevauchement(serie);
    expect(r.fenetre).toBeNull();
    expect(r.penteRelacheGParS).toBeNull();
    expect(r.confiance).toBe('faible');
  });

  it('les échantillons sans canal longitudinal sont comptés, jamais tus', () => {
    const serie = passageAvecChevauchement().map((e, i) =>
      i % 4 === 0 ? { ...e, gLong: null } : e
    );
    const r = lireChevauchement(serie);
    expect(r.echantillonsIgnores).toBeGreaterThan(0);
    // Un quart du signal manque : la confiance ne peut plus être haute.
    expect(r.confiance).toBe('moyenne');
  });

  it('un latéral entièrement absent rend le chevauchement illisible, pas nul-par-défaut', () => {
    const serie = passageAvecChevauchement().map((e) => ({ ...e, gLat: null }));
    const r = lireChevauchement(serie);
    expect(r.fenetre).toBeNull();
    expect(r.basculeMs).toBeNull();
    // La pente du relâché, elle, reste mesurable : le longitudinal est là.
    expect(r.penteRelacheGParS).not.toBeNull();
  });

  it('l’ordre d’entrée ne change pas la lecture', () => {
    const melange = [...passageAvecChevauchement()].reverse();
    const a = lireChevauchement(passageAvecChevauchement());
    const b = lireChevauchement(melange);
    expect(b.fenetre).toEqual(a.fenetre);
    expect(b.basculeMs).toBe(a.basculeMs);
  });
});

// ===========================================================================
// M15 — rotation
// ===========================================================================

describe('lireRotation (M15)', () => {
  /** Montée, pic, descente : une seule alternance — la forme d'un geste. */
  it('classe une montée-pic-descente comme rotation en un geste', () => {
    const r = lireRotation(
      serieRotation(2000, [
        [0, 0],
        [600, 30],
        [1400, 30],
        [2000, 0],
      ])
    );
    expect(r.lecture).toBe('rotation en un geste');
    expect(r.version).toBe(VERSION_ROTATION);
    expect(r.debutMs).not.toBeNull();
    expect(r.picMs).not.toBeNull();
    expect(r.picDegParS).toBeCloseTo(30, 0);
    expect(r.oscillations).not.toBeNull();
    expect(r.oscillations!).toBeLessThanOrEqual(1);
    expect(r.alternatives).toEqual([]);
  });

  it('trouve la stabilisation après le pic, sur une fenêtre de calme', () => {
    const r = lireRotation(
      serieRotation(2000, [
        [0, 0],
        [600, 30],
        [1400, 30],
        [2000, 0],
      ])
    );
    expect(r.stabilisationMs).not.toBeNull();
    expect(r.stabilisationMs!).toBeGreaterThan(r.picMs!);
    expect(r.confiance).toBe('haute');
  });

  it('compte les alternances au-delà du seuil et lit des corrections multiples', () => {
    const r = lireRotation(
      serieRotation(2400, [
        [0, 0],
        [400, 25],
        [600, 17],
        [800, 26],
        [1000, 16],
        [1200, 25],
        [2400, 0],
      ])
    );
    expect(r.lecture).toBe('corrections multiples observées');
    expect(r.oscillations).not.toBeNull();
    expect(r.oscillations!).toBeGreaterThanOrEqual(2);
    expect(r.alternatives).toEqual([]);
  });

  it('le début est posé au franchissement du seuil de rotation, pas avant', () => {
    const r = lireRotation(
      serieRotation(2000, [
        [0, 0],
        [600, 30],
        [1400, 30],
        [2000, 0],
      ])
    );
    // 0 → 30 en 600 ms : le seuil de 4°/s est franchi vers t ≈ 80 ms.
    expect(r.debutMs).toBeGreaterThan(0);
    expect(r.debutMs!).toBeLessThan(300);
    expect(SEUIL_ROTATION_DEG_S).toBeGreaterThan(0);
  });

  it('trop peu d’échantillons : signal insuffisant, avec des lectures alternatives', () => {
    const r = lireRotation(
      serieRotation(200, [
        [0, 10],
        [200, 20],
      ]).slice(0, 4)
    );
    expect(r.lecture).toBe('signal insuffisant');
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.debutMs).toBeNull();
    expect(r.picMs).toBeNull();
    expect(r.oscillations).toBeNull();
    expect(r.stabilisationMs).toBeNull();
    expect(r.confiance).toBe('faible');
  });

  it('un lacet toujours sous le seuil ne fabrique pas de rotation', () => {
    const r = lireRotation(
      serieRotation(2000, [
        [0, 1],
        [2000, 1],
      ])
    );
    expect(r.lecture).toBe('signal insuffisant');
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.picDegParS).toBeNull();
  });

  it('un canal de lacet entièrement absent est compté et refusé', () => {
    const serie: EchantillonRotation[] = Array.from({ length: 12 }, (_, i) => ({
      tMs: i * PAS_MS,
      lacetDegParS: null,
      gLat: 0.4,
    }));
    const r = lireRotation(serie);
    expect(r.lecture).toBe('signal insuffisant');
    expect(r.echantillonsIgnores).toBe(12);
  });

  it('des instants confondus ne cassent pas la dérivée', () => {
    const base = serieRotation(2000, [
      [0, 0],
      [600, 30],
      [1400, 30],
      [2000, 0],
    ]);
    const avecDoublon = [...base, { tMs: 600, lacetDegParS: 30, gLat: null }];
    const r = lireRotation(avecDoublon);
    expect(Number.isFinite(r.oscillations!)).toBe(true);
    expect(r.lecture).toBe('rotation en un geste');
  });
});

// ===========================================================================
// Vocabulaire — le garde doctrinal du module
// ===========================================================================

describe('vocabulaire — aucune chaîne exportée ne dérive', () => {
  // Construits par concaténation pour ne pas les écrire dans ce dépôt.
  const INTERDITS: readonly string[] = [
    'sous-' + 'virage',
    'sur' + 'virage',
    'trail' + ' braking',
    'trail',
    'péd' + 'ale',
    'press' + 'ion',
    'lim' + 'ite',
    'Frein' + 'ez',
    'Accélér' + 'ez',
    'Vous dev' + 'riez',
    'Il fa' + 'ut',
    'Évit' + 'ez',
  ];

  function chainesDe(valeur: unknown, sac: string[]): void {
    if (typeof valeur === 'string') {
      sac.push(valeur);
    } else if (Array.isArray(valeur)) {
      for (const v of valeur) chainesDe(v, sac);
    } else if (valeur !== null && typeof valeur === 'object') {
      for (const v of Object.values(valeur)) chainesDe(v, sac);
    }
  }

  it('aucun mot proscrit dans les chaînes produites par les deux lectures', () => {
    const sac: string[] = [];
    chainesDe(lireChevauchement(passageAvecChevauchement()), sac);
    chainesDe(lireChevauchement(passageSuccessif()), sac);
    chainesDe(lireChevauchement([]), sac);
    chainesDe(
      lireRotation(
        serieRotation(2400, [
          [0, 0],
          [400, 25],
          [600, 17],
          [800, 26],
          [1000, 16],
          [1200, 25],
          [2400, 0],
        ])
      ),
      sac
    );
    chainesDe(lireRotation([]), sac);
    chainesDe(LIBELLE_CHEVAUCHEMENT, sac);

    expect(sac.length).toBeGreaterThan(0);
    for (const chaine of sac) {
      for (const interdit of INTERDITS) {
        expect(chaine.toLowerCase()).not.toContain(interdit.toLowerCase());
      }
    }
  });

  it('aucun mot proscrit dans le source du module (chaînes ET commentaires)', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'virageFinLogic.ts'), 'utf8');
    for (const interdit of INTERDITS) {
      expect(source.toLowerCase()).not.toContain(interdit.toLowerCase());
    }
  });
});
