/**
 * Les règles NON NÉGOCIABLES du §00 sont ici, une par test, et chacune est
 * falsifiable : on construit la séance qui la ferait tomber si le moteur
 * l'avait oubliée.
 */

import { composerPlanDeRun } from '@/features/rec/planDeRunLogic';

import {
  CARTES_LECTURE_LARGE,
  CARTES_PREMIERES_SEANCES,
  cartesParDefaut,
  composerPresentations,
  donneesDisponibles,
  plafondNiveau,
  type EntreeComposition,
  type FaitsSeance,
} from '../compositionLogic';
import { FICHES, estMoteurDePreuve } from '../registrePresentations';

// ===========================================================================
// Fabriques d'entrée — tout est explicite, rien n'est optionnel.
// ===========================================================================

/** Une séance riche : les cinq niveaux de restitution y sont ouverts. */
const SEANCE_COMPLETE = {
  toursChronometres: 8,
  toursComparables: 6,
  tramesAvecLacet: 4000,
  tramesAvecAcceleration: 4000,
};

/** Un premier tour de chauffe : rien n'est comparable, rien n'est inertiel. */
const SEANCE_MAIGRE = {
  toursChronometres: 1,
  toursComparables: 0,
  tramesAvecLacet: 0,
  tramesAvecAcceleration: 0,
};

const FAITS_RICHES: FaitsSeance = {
  tracePosition: true,
  santeChaine: true,
  etatTraitement: true,
  video: true,
  coachLie: true,
  consigneCoach: true,
  voixCoach: true,
  reperePiste: true,
  acquis: true,
  referencePartagee: true,
  live: true,
  flotteLive: true,
  canauxVehicule: true,
  runsDeLaJournee: 3,
};

const FAITS_NUS: FaitsSeance = {
  tracePosition: false,
  santeChaine: false,
  etatTraitement: false,
  video: false,
  coachLie: false,
  consigneCoach: false,
  voixCoach: false,
  reperePiste: false,
  acquis: false,
  referencePartagee: false,
  live: false,
  flotteLive: false,
  canauxVehicule: false,
  runsDeLaJournee: 1,
};

function entree(patch: Partial<EntreeComposition> = {}): EntreeComposition {
  return {
    surface: 'pilote',
    experience: { seances: 20, journees: 5, circuits: ['chs', 'lfg'], presentationsVues: [] },
    souhait: {
      plan: composerPlanDeRun({
        intention: 'Regarder la sortie du 8',
        circuitNom: 'Haute Saintonge',
        creneau: '14 h 30',
        conditions: null,
      }),
      theme: null,
      ressenti: null,
    },
    disponibilite: { etat: SEANCE_COMPLETE, confiance: 'haute', faits: FAITS_RICHES },
    travailActif: null,
    ...patch,
  };
}

const ids = (c: ReturnType<typeof composerPresentations>): string[] =>
  c.presentations.map((p) => p.id);

const rang = (c: ReturnType<typeof composerPresentations>, id: string): number =>
  ids(c).indexOf(id);

// ===========================================================================

describe('composerPresentations — les règles du §00', () => {
  // -------------------------------------------------------------------------
  it('la réussite passe devant l’opportunité', () => {
    const c = composerPresentations(entree());
    const reussites = c.presentations
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.role === 'reussite');
    const opportunites = c.presentations
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.role === 'opportunite');

    expect(reussites.length).toBeGreaterThan(0);
    expect(opportunites).toHaveLength(1);
    for (const r of reussites) {
      expect(r.i).toBeLessThan(opportunites[0].i);
    }
  });

  it('la réussite ouvre le débrief, avant toute autre carte d’après-run', () => {
    const c = composerPresentations(entree());
    const apres = c.presentations.filter((p) => p.moment === 'apres');
    expect(apres[0].role).toBe('reussite');
  });

  // -------------------------------------------------------------------------
  it('il n’y a qu’une seule opportunité, les autres sont écartées et nommées', () => {
    const c = composerPresentations(entree());
    expect(c.presentations.filter((p) => p.role === 'opportunite')).toHaveLength(1);

    const opportunitesDuRegistre = FICHES.filter(
      (f) => f.role === 'opportunite' && f.surfaces.includes('pilote')
    ).map((f) => f.id);
    const composee = c.presentations.find((p) => p.role === 'opportunite');
    const cachees = opportunitesDuRegistre.filter((id) => id !== composee?.id);

    for (const id of cachees) {
      const e = c.ecartees.find((x) => x.id === id);
      expect(e).toBeDefined();
      expect(e?.motif).toBe('une seule zone à explorer à la fois');
    }
  });

  it('tant que le travail actif n’est pas terminé, c’est LUI, et aucune autre', () => {
    const c = composerPresentations(
      entree({
        travailActif: { id: 'P14', termine: false },
        souhait: {
          plan: null,
          theme: 'rythme', // P12 est sur ce thème : il ne doit pas voler la place
          ressenti: 'a_creuser',
        },
      })
    );
    const opportunites = c.presentations.filter((p) => p.role === 'opportunite');
    expect(opportunites.map((p) => p.id)).toEqual(['P14']);
    expect(opportunites[0].motifs).toContain('le travail ouvert sur cette zone');

    for (const id of ['P10', 'P12']) {
      expect(c.ecartees.find((x) => x.id === id)?.motif).toBe(
        'un travail est en cours ; les autres zones restent fermées'
      );
    }
  });

  it('le travail terminé rend la main : le thème nommé désigne la suivante', () => {
    const c = composerPresentations(
      entree({
        travailActif: { id: 'P14', termine: true },
        souhait: { plan: null, theme: 'rythme', ressenti: 'a_creuser' },
      })
    );
    // P12 « Monnaie du temps » porte le thème « rythme ». P10 le précède au
    // catalogue : sans la préférence de thème, ce serait lui.
    expect(c.presentations.filter((p) => p.role === 'opportunite').map((p) => p.id)).toEqual([
      'P12',
    ]);
  });

  it('un travail ouvert dont la donnée a disparu n’est PAS remplacé en douce', () => {
    // P14 exige la répétition ; une séance de deux tours comparables mais non
    // répétables la retire. Aucune autre opportunité ne prend sa place.
    const c = composerPresentations(
      entree({
        travailActif: { id: 'P14', termine: false },
        disponibilite: {
          etat: { ...SEANCE_COMPLETE, toursChronometres: 2 },
          confiance: 'haute',
          faits: FAITS_RICHES,
        },
      })
    );
    expect(c.presentations.filter((p) => p.role === 'opportunite')).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  it('aucune présentation dont une donnée requise est absente', () => {
    const c = composerPresentations(
      entree({
        disponibilite: { etat: SEANCE_MAIGRE, confiance: 'haute', faits: FAITS_NUS },
      })
    );
    const disponibles = donneesDisponibles(
      entree({ disponibilite: { etat: SEANCE_MAIGRE, confiance: 'haute', faits: FAITS_NUS } })
    ).disponibles;

    for (const p of c.presentations) {
      const fiche = FICHES.find((f) => f.id === p.id);
      expect(fiche).toBeDefined();
      for (const cle of fiche?.donneesRequises ?? []) {
        expect(disponibles.has(cle)).toBe(true);
      }
    }
    // Le delta n'existe pas sur un tour unique : rien qui en dépende ne sort.
    expect(ids(c)).not.toContain('P08');
    expect(ids(c)).not.toContain('P09');
  });

  it('la donnée absente est nommée en langage pilote, pas en jargon', () => {
    const c = composerPresentations(
      entree({ disponibilite: { etat: SEANCE_MAIGRE, confiance: 'haute', faits: FAITS_NUS } })
    );
    const e = c.ecartees.find((x) => x.id === 'P08');
    expect(e?.motif).toBe('donnée absente : deux tours qui couvrent la même distance');
  });

  // -------------------------------------------------------------------------
  it('confiance faible : aucune grandeur mesurée n’est présentée', () => {
    const bas = entree({
      disponibilite: { etat: SEANCE_COMPLETE, confiance: 'faible', faits: FAITS_RICHES },
    });
    const c = composerPresentations(bas);

    for (const p of c.presentations) {
      const fiche = FICHES.find((f) => f.id === p.id);
      expect(fiche?.donneesRequises).not.toContain('delta');
      expect(fiche?.donneesRequises).not.toContain('tours-comparables');
      expect(fiche?.donneesRequises).not.toContain('accelerations');
    }
    expect(c.ecartees.find((x) => x.id === 'P08')?.motif).toBe(
      'confiance de mesure faible sur ce tour : deux tours qui couvrent la même distance'
    );
  });

  it('mais l’écran qui DIT la confiance reste ouvert — il existe pour cela', () => {
    const c = composerPresentations(
      entree({
        disponibilite: { etat: SEANCE_COMPLETE, confiance: 'faible', faits: FAITS_RICHES },
      })
    );
    // P17 « Fiabilité de la conclusion » ne demande que la note elle-même.
    expect(ids(c)).toContain('P17');
  });

  it('une confiance non évaluée n’est pas une confiance basse : elle est absente', () => {
    const c = composerPresentations(
      entree({ disponibilite: { etat: SEANCE_COMPLETE, confiance: null, faits: FAITS_RICHES } })
    );
    expect(ids(c)).not.toContain('P17');
    expect(c.ecartees.find((x) => x.id === 'P17')?.motif).toBe(
      'donnée absente : la fiabilité de la mesure sur ce tour'
    );
    // Le delta, lui, reste lisible : il n'a pas été jugé, il n'est pas condamné.
    expect(ids(c)).toContain('P08');
  });

  // -------------------------------------------------------------------------
  it('jamais P55–P65 au pilote, même avec tout le contexte du monde', () => {
    const c = composerPresentations(entree());
    for (const p of c.presentations) {
      expect(estMoteurDePreuve(p.id)).toBe(false);
    }
    for (const id of ['P55', 'P60', 'P65']) {
      expect(c.ecartees.find((x) => x.id === id)?.motif).toBe(
        'moteur de preuve du coach et du Lab'
      );
    }
  });

  it('aucune fiche d’une autre surface ne remonte au pilote', () => {
    const c = composerPresentations(entree());
    for (const p of c.presentations) {
      expect(FICHES.find((f) => f.id === p.id)?.surfaces).toContain('pilote');
    }
    // P34 et P45 sont des écrans de coach : ils ne franchissent pas la porte.
    expect(ids(c)).not.toContain('P34');
    expect(ids(c)).not.toContain('P45');
  });

  it('le coach, lui, atteint le moteur de preuve', () => {
    const c = composerPresentations(entree({ surface: 'coach' }));
    expect(ids(c)).toContain('P55');
    expect(ids(c)).toContain('P34');
  });

  // -------------------------------------------------------------------------
  it('aucun score global, nulle part dans la sortie', () => {
    const c = composerPresentations(entree());
    const CLE_INTERDITE = /score|classement|percentile|rang|podium|pourcentage/i;
    const VALEUR_INTERDITE = /\/100\b|\d\s?%|score/i;

    const parcourir = (v: unknown, chemin: string): void => {
      if (typeof v === 'string') {
        expect({ chemin, v }).toMatchObject({ v: expect.not.stringMatching(VALEUR_INTERDITE) });
        return;
      }
      if (Array.isArray(v)) {
        v.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
        return;
      }
      if (v !== null && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          expect(CLE_INTERDITE.test(k)).toBe(false);
          parcourir(x, `${chemin}.${k}`);
        }
      }
    };
    parcourir(c, 'composition');
  });

  it('aucun motif ne prescrit, et aucun ne dit « limite »', () => {
    const c = composerPresentations(entree());
    const PROSCRITS =
      /\b(freinez|accélérez|accelerez|vous devriez|il faut|évitez|evitez|limite|limites)\b/i;
    for (const p of c.presentations) {
      for (const m of p.motifs) expect(PROSCRITS.test(m)).toBe(false);
    }
    for (const e of c.ecartees) expect(PROSCRITS.test(e.motif)).toBe(false);
  });
});

// ===========================================================================

describe('la profondeur suit l’expérience, l’accès jamais', () => {
  /**
   * Les deux ne diffèrent QUE par le nombre de séances.
   *
   * Une première écriture donnait au débutant une seule journée et un seul
   * circuit — et le test tombait pour la bonne raison : P48, P49 et P51
   * disparaissaient faute de *données* (plusieurs événements, plusieurs
   * circuits), pas faute d'expérience. La règle sous test porte sur la
   * PROFONDEUR, il fallait donc isoler la seule variable qui la commande.
   */
  const debutant = { seances: 1, journees: 2, circuits: ['chs', 'lfg'], presentationsVues: [] };
  const confirme = { seances: 20, journees: 2, circuits: ['chs', 'lfg'], presentationsVues: [] };

  it('le plafond de lecture monte avec les séances, sans jamais atteindre le Lab', () => {
    expect(plafondNiveau(entree({ experience: debutant }))).toBe(1);
    expect(plafondNiveau(entree({ experience: confirme }))).toBe(2);
    // Le Lab n'est pas le haut de l'échelle du pilote : c'est une autre surface.
    expect(plafondNiveau(entree({ experience: confirme, surface: 'lab' }))).toBe(3);
  });

  it('l’usage vaut le compteur : une preuve déjà ouverte lève le plafond', () => {
    const c = { ...debutant, presentationsVues: ['P18'] };
    expect(plafondNiveau(entree({ experience: c }))).toBe(2);
  });

  it('le nombre de cartes du débrief suit l’expérience', () => {
    expect(cartesParDefaut(entree({ experience: debutant }))).toBe(CARTES_PREMIERES_SEANCES);
    expect(cartesParDefaut(entree({ experience: confirme }))).toBe(CARTES_LECTURE_LARGE);
    // Le Lab n'a pas de budget : « densité autorisée » (§01).
    expect(cartesParDefaut(entree({ experience: confirme, surface: 'lab' }))).toBeNull();
  });

  /** LE CŒUR DE LA RÈGLE. */
  it('le débutant et le pilote de vingt séances reçoivent le MÊME catalogue', () => {
    const a = composerPresentations(entree({ experience: debutant }));
    const b = composerPresentations(entree({ experience: confirme }));
    expect(ids(a)).toEqual(ids(b));
    expect(a.ecartees.map((e) => e.id)).toEqual(b.ecartees.map((e) => e.id));
  });

  it('seul ce qui s’ouvre TOUT SEUL diffère — rien n’est retiré', () => {
    const a = composerPresentations(entree({ experience: debutant }));
    const b = composerPresentations(entree({ experience: confirme }));
    const parDefautA = a.presentations.filter((p) => p.parDefaut).length;
    const parDefautB = b.presentations.filter((p) => p.parDefaut).length;
    expect(parDefautA).toBeLessThan(parDefautB);

    // Ce qui ne s'ouvre pas seul est présent, et dit d'un mot pourquoi.
    for (const p of a.presentations) {
      if (!p.parDefaut) {
        expect(p.motifs.some((m) => m.includes('s’ouvre d’un geste'))).toBe(true);
      }
    }
  });

  it('le débrief du débutant tient dans son budget de cartes', () => {
    const a = composerPresentations(entree({ experience: debutant }));
    const cartes = a.presentations.filter((p) => p.parDefaut && p.moment === 'apres');
    expect(cartes.length).toBeLessThanOrEqual(CARTES_PREMIERES_SEANCES);
  });

  it('le cadrage d’avant-run n’est pas décompté du débrief', () => {
    const a = composerPresentations(entree({ experience: debutant }));
    const avant = a.presentations.filter((p) => p.moment === 'avant');
    expect(avant.length).toBeGreaterThan(0);
    for (const p of avant) expect(p.parDefaut).toBe(true);
  });
});

// ===========================================================================

describe('le souhait départage, il ne filtre pas', () => {
  it('le thème nommé fait remonter les fiches qui l’éclairent', () => {
    const sans = composerPresentations(
      entree({ souhait: { plan: null, theme: null, ressenti: null } })
    );
    const avec = composerPresentations(
      entree({ souhait: { plan: null, theme: 'voiture', ressenti: 'a_creuser' } })
    );
    // P29 « Rotation et stabilité » et P30 « Grip simplifié » portent ce thème.
    expect(rang(avec, 'P30')).toBeLessThan(rang(sans, 'P30'));
    expect(rang(avec, 'P29')).toBeLessThan(rang(sans, 'P29'));
  });

  it('et il n’écarte rien de ce qui reste lisible', () => {
    const sans = composerPresentations(
      entree({ souhait: { plan: null, theme: null, ressenti: null } })
    );
    const avec = composerPresentations(
      entree({ souhait: { plan: null, theme: 'voiture', ressenti: 'a_creuser' } })
    );
    for (const id of ids(sans)) expect(ids(avec)).toContain(id);
  });

  it('le motif cite le thème dans les mots du pilote', () => {
    const c = composerPresentations(
      entree({ souhait: { plan: null, theme: 'freinage', ressenti: 'serre' } })
    );
    const p19 = c.presentations.find((p) => p.id === 'P19');
    expect(p19?.motifs).toContain('vous avez nommé le freinage après ce run');
  });

  it('l’intention posée avant de rouler ouvre l’objectif du run', () => {
    const avec = composerPresentations(entree());
    expect(ids(avec)).toContain('P01');

    const sans = composerPresentations(
      entree({ souhait: { plan: null, theme: null, ressenti: null } })
    );
    expect(ids(sans)).not.toContain('P01');
    expect(sans.ecartees.find((x) => x.id === 'P01')?.motif).toBe(
      'donnée absente : ce que vous aviez posé avant de rouler'
    );
  });

  it('une intention vide n’est pas une intention', () => {
    const c = composerPresentations(
      entree({
        souhait: {
          plan: composerPlanDeRun({
            intention: '   ',
            circuitNom: null,
            creneau: null,
            conditions: null,
          }),
          theme: null,
          ressenti: null,
        },
      })
    );
    expect(ids(c)).not.toContain('P01');
  });

  it('une présentation déjà ouverte n’est pas cachée, elle est déclassée', () => {
    const vierge = composerPresentations(entree());
    const revue = composerPresentations(
      entree({
        experience: {
          seances: 20,
          journees: 6,
          circuits: ['chs', 'lfg'],
          presentationsVues: ['P20'],
        },
      })
    );
    expect(ids(revue)).toContain('P20');
    expect(rang(revue, 'P20')).toBeGreaterThan(rang(vierge, 'P20'));
    expect(revue.presentations.find((p) => p.id === 'P20')?.motifs).toContain(
      'déjà ouverte lors d’une séance précédente'
    );
  });
});

// ===========================================================================

describe('propriétés du moteur', () => {
  it('il est pur : deux appels rendent le même résultat', () => {
    const e = entree();
    expect(composerPresentations(e)).toEqual(composerPresentations(e));
  });

  it('toute fiche du registre est soit composée, soit écartée avec un motif', () => {
    const c = composerPresentations(entree());
    const traitees = new Set([...ids(c), ...c.ecartees.map((e) => e.id)]);
    expect(traitees.size).toBe(FICHES.length);
    for (const e of c.ecartees) expect(e.motif.trim().length).toBeGreaterThan(0);
  });

  it('aucune fiche n’est à la fois composée et écartée', () => {
    const c = composerPresentations(entree());
    const composees = new Set(ids(c));
    for (const e of c.ecartees) expect(composees.has(e.id)).toBe(false);
  });

  it('toute présentation composée porte au moins un motif', () => {
    const c = composerPresentations(entree());
    for (const p of c.presentations) expect(p.motifs.length).toBeGreaterThan(0);
  });

  it('une séance sans rien ne compose que ce qui ne demande rien', () => {
    const c = composerPresentations(
      entree({
        souhait: { plan: null, theme: null, ressenti: null },
        experience: { seances: 0, journees: 1, circuits: [], presentationsVues: [] },
        disponibilite: { etat: SEANCE_MAIGRE, confiance: null, faits: FAITS_NUS },
      })
    );
    // P03 « Ressenti en six touches », P04 « Note vocale », P06 « Confiance du
    // pilote » : trois saisies, qui n'attendent aucune mesure.
    expect(ids(c)).toEqual(['P03', 'P04', 'P06']);
  });

  it('les circuits se dédoublonnent avant d’être comptés', () => {
    const doublons = donneesDisponibles(
      entree({
        experience: {
          seances: 20,
          journees: 6,
          circuits: ['chs', 'chs', ' chs '],
          presentationsVues: [],
        },
      })
    );
    expect(doublons.disponibles.has('plusieurs-circuits')).toBe(false);
  });
});
