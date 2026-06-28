/**
 * Tests du filtre de sécurité doctrinale (T-1).
 *
 * Garantit :
 *   - le lexique proscrit est VERROUILLÉ (snapshot) ;
 *   - les tournures prescriptives explicites de la doctrine sont bloquées à 100 % ;
 *   - le contenu descriptif autorisé (et la vraie sortie de generateDebrief)
 *     passe sans faux positif ;
 *   - l'API (findProscribedTerms / isDoctrineSafe / assertDoctrineSafe) se
 *     comporte comme contractualisé.
 */

import {
  DOCTRINE_PROSCRIBED_TERMS,
  DoctrineViolationError,
  assertDoctrineSafe,
  findProscribedTerms,
  isDoctrineSafe,
} from '../aiSafetyFilter';
import { generateDebrief } from '../debriefGenerator';
import type { MarginZone } from '@/types/domain';

describe('aiSafetyFilter — lexique verrouillé', () => {
  it('le catalogue est stable (snapshot)', () => {
    expect(DOCTRINE_PROSCRIBED_TERMS).toMatchSnapshot();
  });

  it('contient les interdits explicites de la doctrine', () => {
    const terms = new Set(DOCTRINE_PROSCRIBED_TERMS.map((t) => t.term));
    for (const t of ['freinez', 'accelerez', 'prenez', 'vous devriez', 'il faut', 'evitez']) {
      expect(terms.has(t)).toBe(true);
    }
  });

  it('est trié par longueur décroissante (multi-mots prioritaires)', () => {
    const lengths = DOCTRINE_PROSCRIBED_TERMS.map((t) => t.term.length);
    const sorted = [...lengths].sort((a, b) => b - a);
    expect(lengths).toEqual(sorted);
  });
});

describe('aiSafetyFilter — tournures prescriptives bloquées', () => {
  // Les six exemples interdits cités noir sur blanc dans CLAUDE.md.
  const DOCTRINE_FORBIDDEN: string[] = [
    'Freinez plus tôt.',
    'Accélérez à la sortie.',
    'Prenez une trajectoire plus serrée.',
    'Vous devriez ralentir ici.',
    'Il faut tourner plus tard.',
    'Évitez de braquer trop tôt.',
  ];

  for (const phrase of DOCTRINE_FORBIDDEN) {
    it(`bloque : "${phrase}"`, () => {
      expect(isDoctrineSafe(phrase)).toBe(false);
    });
  }

  it('détecte chaque catégorie', () => {
    expect(findProscribedTerms('Freinez.')[0].category).toBe('imperatif_pilotage');
    expect(findProscribedTerms('Il faut le faire.')[0].category).toBe('obligation');
    expect(findProscribedTerms('Évitez ça.')[0].category).toBe('interdiction');
    expect(findProscribedTerms('Travaillez votre repère de freinage.')[0].category).toBe(
      'conseil_deguise'
    );
  });

  it('insensible aux accents et à la casse', () => {
    expect(isDoctrineSafe('ACCELEREZ maintenant')).toBe(false);
    expect(isDoctrineSafe('Évitez / evitez')).toBe(false);
  });

  it('repère plusieurs violations dans un même texte', () => {
    const found = findProscribedTerms('Freinez plus fort, puis accélérez et visez la corde.');
    const terms = found.map((f) => f.term).sort();
    expect(terms).toEqual(['accelerez', 'freinez', 'visez']);
  });
});

describe('aiSafetyFilter — contenu autorisé (zéro faux positif)', () => {
  // Formulations explicitement autorisées par la doctrine + pièges lexicaux
  // (noms descriptifs dont le radical ressemble à un impératif interdit).
  const AUTHORIZED: string[] = [
    'Une zone à observer la prochaine fois.',
    'À creuser, sans précipitation.',
    'Était-ce volontaire ?',
    'Que sentez-vous à cet endroit ?',
    'Le terrain est plus serré ici, et c’est apprivoisé.',
    "L'accélération était nette en sortie.", // ≠ "accélérez"
    "L'appui latéral montait à 1,1 g.", // ≠ "appuyez"
    'La voiture poussait fort sans broncher.', // ≠ "pousse"/"poussez"
    'Vous gardiez de la marge tout du long.', // ≠ "gardez"
    'La prochaine fois, vous pourrez peut-être explorer une seule zone.', // ≠ "vous pouvez"
    'Continuez à regarder, à votre rythme.', // impératif méta, non directif
    'Une invitation, pas une consigne.',
  ];

  for (const phrase of AUTHORIZED) {
    it(`laisse passer : "${phrase}"`, () => {
      expect(findProscribedTerms(phrase)).toEqual([]);
    });
  }
});

describe('aiSafetyFilter — generateDebrief reste conforme', () => {
  const baseInput = {
    firstName: 'Gabin',
    circuitName: 'Charente',
    sessionStartedAt: '2026-06-27T10:00:00Z',
    marginGlobal: 35,
    marginZone: 'green' as MarginZone,
    marginVehicle: 40,
    marginPilot: 32,
    lapCount: 5,
    bestLapSeconds: 87.234,
    segments: [],
  };

  for (const zone of ['green', 'yellow', 'red'] as const) {
    it(`sortie ${zone} : aucune tournure prescriptive`, () => {
      const out = generateDebrief({
        ...baseInput,
        marginGlobal: zone === 'green' ? 45 : zone === 'yellow' ? 22 : 8,
        marginZone: zone,
      });
      expect(() => assertDoctrineSafe(out.text, `debrief ${zone}`)).not.toThrow();
    });
  }
});

describe('aiSafetyFilter — API assertDoctrineSafe', () => {
  it('ne lève rien sur un texte conforme', () => {
    expect(() => assertDoctrineSafe('Une zone à observer.')).not.toThrow();
  });

  it('lève DoctrineViolationError avec les violations', () => {
    try {
      assertDoctrineSafe('Freinez plus tôt.', 'coach-ai');
      throw new Error('aurait dû lever');
    } catch (e) {
      expect(e).toBeInstanceOf(DoctrineViolationError);
      const err = e as DoctrineViolationError;
      expect(err.violations.map((v) => v.term)).toContain('freinez');
      expect(err.message).toContain('coach-ai');
    }
  });

  it('traite le texte vide comme conforme', () => {
    expect(isDoctrineSafe('')).toBe(true);
    expect(findProscribedTerms('')).toEqual([]);
  });
});
