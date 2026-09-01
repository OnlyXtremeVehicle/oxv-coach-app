/**
 * La liste blanche à trois états — jalon 2, phase 3, lot 13.
 *
 * ---
 *
 * CE QUE CES TESTS DÉFENDENT
 *
 * Les six lectures étaient offertes en permanence. Chaque vue décidait seule, à
 * l'ouverture de sa feuille, si elle avait de quoi dessiner — et rendait sinon
 * « Données insuffisantes sur cette séance ».
 *
 * Le pilote voyait donc six portes, les ouvrait une à une, et trouvait six fois
 * la même phrase. Rien n'était faux ; l'information arrivait après le geste au
 * lieu de le précéder.
 *
 * La règle est ici, en un seul endroit. Une règle répartie sur six composants
 * est une règle qu'on applique cinq fois.
 */

import {
  etatLecture,
  productionAutorise,
  SANS_INSIGHTS,
  sectionAffichable,
  type Disponibilite,
  type EntreesLectures,
} from '../disponibilite';
import { READINGS, type ReadingKey } from '../catalogue';
import type { SessionInsights } from '@/circuit/sessionInsights';

const TOUTES: ReadingKey[] = READINGS.map((r) => r.key);

/** Une séance calculée, mais dont AUCUN bloc n'a produit de mesure. */
const VIDE: SessionInsights = {
  telemetry_session_id: 's',
  user_id: 'u',
  engine_version: 'v',
  computed_at: null,
  n_laps: 0,
  n_frames: 0,
  anatomy: null,
  dispersion: null,
  chassis_balance: null,
  load_transfer: null,
  ideal_lap: null,
  data_quality: null,
};

function entrees(p: Partial<EntreesLectures> = {}): EntreesLectures {
  return { insights: VIDE, nbPointsGG: 0, nbPointsFlow: 0, ...p };
}

describe('aucune mesure du tout', () => {
  /**
   * `insights` absent : la séance n'a même pas été calculée — SAUF pour les deux
   * lectures qui n'en lisent jamais. Le G-G et le flow comptent des points venus
   * des trames ; leur fermer la porte au nom d'un bloc qu'elles n'ouvrent pas
   * était le contresens du 01/09.
   */
  const DEPENDANTES = TOUTES.filter((k) => !SANS_INSIGHTS.includes(k));

  /**
   * LA RAISON DIT « NON CALCULÉE », PAS « AUCUNE MESURE ».
   *
   * `session_insights` est écrite par une fonction serveur. Sa ligne absente ne
   * dit rien de ce qu'elle aurait contenu — ni s'il y avait des virages, ni si
   * le gyroscope a répondu. Sur la séance de référence, 26 999 trames et le
   * gyroscope présent sur 100 % d'entre elles, le pilote lisait pourtant
   * « Gyroscope absent » et « Aucune mesure sur cette séance ».
   */
  it.each(DEPENDANTES)('« %s » dit que la lecture n’est pas calculée', (key) => {
    const d = etatLecture(key, entrees({ insights: null }));
    expect(d.etat).toBe('absent');
    expect(d.raison).toBe('LECTURE NON CALCULÉE');
  });

  it.each(DEPENDANTES)('« %s » n’accuse AUCUN capteur sans mesure de capteur', (key) => {
    const d = etatLecture(key, entrees({ insights: null }));
    expect(d.raison).not.toMatch(/gyroscope|inertiel|virage/i);
  });

  it.each(SANS_INSIGHTS)('« %s » reste ouverte sans insights dès qu’elle a des points', (key) => {
    const d = etatLecture(key, entrees({ insights: null, nbPointsGG: 12, nbPointsFlow: 12 }));
    expect(d.etat).toBe('disponible');
  });

  it.each(SANS_INSIGHTS)('« %s » dit SA raison, pas celle des insights', (key) => {
    const d = etatLecture(key, entrees({ insights: null }));
    expect(d.etat).toBe('absent');
    expect(d.raison).toBe('SIGNAL INERTIEL ABSENT');
  });

  // Calculée, mais tous les blocs vides : chaque lecture dit SA raison à elle.
  it.each(TOUTES)('« %s » est absente avec une raison propre quand les blocs sont vides', (key) => {
    const d = etatLecture(key, entrees());
    expect(d.etat).toBe('absent');
    expect(typeof d.raison).toBe('string');
    expect(d.raison!.length).toBeGreaterThan(0);
  });

  it('la section entière s’efface', () => {
    const etats = TOUTES.map((k) => etatLecture(k, entrees()));
    expect(sectionAffichable(etats)).toBe(false);
  });
});

describe('chaque lecture dépend de SA source', () => {
  it('anatomie exige au moins un virage', () => {
    expect(etatLecture('anatomie', entrees()).etat).toBe('absent');
    const avec = { ...VIDE, anatomy: [{ corner_index: 1 } as never] };
    expect(etatLecture('anatomie', entrees({ insights: avec })).etat).toBe('disponible');
  });

  // Un tableau VIDE n'est pas une mesure. C'est le cas qui trompe le plus :
  // le champ existe, il est simplement sans contenu.
  it('un tableau vide ne rend pas la lecture disponible', () => {
    const avec = { ...VIDE, anatomy: [] };
    expect(etatLecture('anatomie', entrees({ insights: avec })).etat).toBe('absent');
  });

  // Idem pour un objet sans aucune clé.
  it('un objet sans clé ne rend pas la lecture disponible', () => {
    const avec = { ...VIDE, dispersion: {} as never };
    expect(etatLecture('dispersion', entrees({ insights: avec })).etat).toBe('absent');
  });

  /**
   * LA FORME IMBRIQUÉE DU MOTEUR DE PRODUCTION — audit M10 du 26/08/2026.
   *
   * `compute-session-insights-v3` écrit `ideal_lap` ainsi :
   *
   *     { theoretical_day: {…}, theoretical_record: {…} }
   *
   * `IdealLap` et `TourIdealViz` lisent `ideal_time_s` / `real_best_s` À PLAT.
   * Compter les clés voyait donc deux clés, déclarait la lecture disponible, et
   * la vue s'ouvrait sur « Données insuffisantes sur cette séance ».
   *
   * C'est LA porte fermée que ce module existe pour supprimer, et elle vivait
   * sur le chemin de production.
   */
  it('la forme imbriquée du moteur v3 n’ouvre pas la porte', () => {
    const v3 = {
      ...VIDE,
      ideal_lap: {
        theoretical_day: { ideal_time_s: 94.3, real_best_s: 94.3, gap_s: 0 },
        theoretical_record: null,
      } as never,
    };
    const d = etatLecture('tour-ideal', entrees({ insights: v3 }));
    expect(d.etat).toBe('absent');
    expect(d.raison).toBe('CHRONOS SECTEUR · NON CALCULÉS');
  });

  // Le contre-test : la forme À PLAT, elle, ouvre bien.
  it('la forme à plat, avec ses deux chronos, ouvre la lecture', () => {
    const plat = {
      ...VIDE,
      ideal_lap: {
        ideal_time_s: 94.3,
        real_best_s: 94.3,
        gap_s: 0,
        best_lap: 3,
        loss_by_sector_pct: [],
        worst_sector: 0,
      },
    };
    expect(etatLecture('tour-ideal', entrees({ insights: plat })).etat).toBe('disponible');
  });

  // Un chrono non fini n'est pas un chrono. `Number.isFinite` vaut `true` sur
  // zéro : c'est la présence des DEUX bornes qui décide, pas leur valeur.
  it('un chrono non fini ne rend pas la lecture disponible', () => {
    const casse = {
      ...VIDE,
      ideal_lap: {
        ideal_time_s: Number.NaN,
        real_best_s: 94.3,
        gap_s: 0,
        best_lap: 3,
        loss_by_sector_pct: [],
        worst_sector: 0,
      },
    };
    expect(etatLecture('tour-ideal', entrees({ insights: casse })).etat).toBe('absent');
  });

  it('gg et flow dépendent de leurs nuages de points, pas des blocs', () => {
    expect(etatLecture('gg', entrees({ nbPointsGG: 1 })).etat).toBe('disponible');
    expect(etatLecture('flow', entrees({ nbPointsFlow: 1 })).etat).toBe('disponible');
    // …et l'un n'ouvre pas l'autre.
    expect(etatLecture('flow', entrees({ nbPointsGG: 1 })).etat).toBe('absent');
    expect(etatLecture('gg', entrees({ nbPointsFlow: 1 })).etat).toBe('absent');
  });

  it('une seule lecture disponible suffit à garder la section', () => {
    const etats = TOUTES.map((k) => etatLecture(k, entrees({ nbPointsGG: 1 })));
    expect(sectionAffichable(etats)).toBe(true);
    expect(etats.filter((d) => d.etat === 'disponible')).toHaveLength(1);
  });
});

describe('l’état demo ne sort jamais en production', () => {
  it('les états réels passent toujours', () => {
    expect(productionAutorise('disponible')).toBe(true);
    expect(productionAutorise('absent')).toBe(true);
  });

  // `__DEV__` est vrai sur ce banc comme en développement. Ce test fige le
  // CONTRAT : demo est le seul état conditionnel.
  it('demo est le seul état conditionné à __DEV__', () => {
    expect(productionAutorise('demo')).toBe(typeof __DEV__ !== 'undefined' && __DEV__ === true);
  });
});

describe('les raisons respectent le ton OXV', () => {
  const raisons = (TOUTES.map((k) => etatLecture(k, entrees())) as Disponibilite[]).map(
    (d) => d.raison ?? ''
  );

  it('aucune prescription — on décrit, on ne dirige pas', () => {
    for (const r of raisons) {
      expect(r).not.toMatch(/vous devez|il faut|veuillez|pensez à|essayez/i);
    }
  });

  it('aucun emoji, aucun tutoiement', () => {
    for (const r of raisons) {
      expect(r).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(r).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });

  // « limite » est proscrit par la doctrine — on dit « marge ».
  it('aucun mot proscrit', () => {
    for (const r of raisons) {
      expect(r).not.toMatch(/\blimite\b/i);
    }
  });
});

/**
 * LE CAS RÉEL DE BOUTEVILLE — celui que le fichier n'éprouvait nulle part.
 *
 * ===========================================================================
 * POURQUOI IL MANQUAIT, ET CE QUE ÇA A COÛTÉ
 * ===========================================================================
 *
 * L'aide `entrees` pose `nbPointsGG: 0` et `nbPointsFlow: 0` par défaut. Tous
 * les cas `insights: null` étaient donc joués avec un nuage VIDE — c'est-à-dire
 * dans la seule configuration où le portillon d'origine avait raison.
 *
 * La séance de référence est l'inverse : `session_insights` ne porte rien, et
 * 26 999 trames portent leurs G. Le pilote lisait « Aucune mesure sur cette
 * séance » devant deux lectures que ses propres trames alimentaient, et aucun
 * test ne pouvait le voir.
 *
 * Un test qui n'exerce que la configuration où le code a raison ne verrouille
 * rien. Celui-ci fige les chiffres RÉELS, mesurés en base le 30/08/2026.
 */
describe('la séance de référence, telle que la base la porte', () => {
  /** 26 999 trames, toutes avec leurs trois G. */
  const BOUTEVILLE = { insights: null, nbPointsGG: 26_999, nbPointsFlow: 22_000 };

  it.each(SANS_INSIGHTS)('« %s » S’OUVRE — ses points viennent des trames', (key) => {
    const d = etatLecture(key, entrees(BOUTEVILLE));
    expect(d.etat).toBe('disponible');
    expect(d.raison).toBeUndefined();
  });

  it('les quatre autres restent fermées, et disent que rien n’est calculé', () => {
    const dependantes = TOUTES.filter((k) => !SANS_INSIGHTS.includes(k));
    for (const key of dependantes) {
      const d = etatLecture(key, entrees(BOUTEVILLE));
      expect(d.etat).toBe('absent');
      expect(d.raison).toBe('LECTURE NON CALCULÉE');
    }
  });

  /**
   * LA CONSÉQUENCE QUI COMPTE : la section entière ne s'efface plus.
   *
   * `sectionAffichable` exige qu'AU MOINS une lecture soit disponible. Avant la
   * correction, la séance de référence n'en avait aucune et la section
   * disparaissait — sur 26 999 trames.
   */
  it('la section reste à l’écran', () => {
    const etats = TOUTES.map((k) => etatLecture(k, entrees(BOUTEVILLE)));
    expect(sectionAffichable(etats)).toBe(true);
  });

  /**
   * Et le cas symétrique, qui garde la correction honnête : une séance SANS
   * trames exploitables ferme bien les deux, malgré l'absence d'insights.
   */
  it('une séance sans trames ferme quand même les deux', () => {
    const etats = SANS_INSIGHTS.map((k) =>
      etatLecture(k, entrees({ insights: null, nbPointsGG: 0, nbPointsFlow: 0 }))
    );
    expect(etats.every((d) => d.etat === 'absent')).toBe(true);
  });
});
