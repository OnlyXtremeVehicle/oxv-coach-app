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
  // `insights` absent : la séance n'a même pas été calculée.
  it.each(TOUTES)('« %s » est absente quand insights est null', (key) => {
    const d = etatLecture(key, entrees({ insights: null }));
    expect(d.etat).toBe('absent');
    expect(d.raison).toBe('Aucune mesure sur cette séance');
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
