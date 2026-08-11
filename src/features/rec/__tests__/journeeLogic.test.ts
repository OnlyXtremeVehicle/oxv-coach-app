/**
 * Le cumul de la journée ne fabrique rien et ne compte jamais deux fois.
 *
 * Deux règles de doctrine sont en jeu, et elles tirent dans le même sens : un
 * fait absent est absent — jamais un zéro affiché —, et un chiffre montré au
 * pilote doit correspondre à ce qu'il a réellement fait.
 */

import {
  CUMUL_VIDE,
  ajouterRun,
  dayCompteKey,
  dayCumulKey,
  faitsJournee,
  journeeAPlusieursRuns,
  lireCumul,
  localDayIso,
} from '../journeeLogic';

describe('ajouterRun — jamais de run fantôme', () => {
  it('cumule tours et minutes', () => {
    const a = ajouterRun(CUMUL_VIDE, { tours: 8, dureeMs: 12 * 60_000 });
    const b = ajouterRun(a, { tours: 5, dureeMs: 9 * 60_000 });
    expect(b).toEqual({ runs: 2, tours: 13, minutes: 21 });
  });

  /**
   * LE CAS QUI COMPTE. `rec/fin` peut se remonter — retour arrière, reprise de
   * l'application, rendu qui se rejoue. Un run vide ne doit pas incrémenter le
   * compteur de sorties, sinon la journée gonfle toute seule.
   */
  it('un run sans tour ET sans durée n’est pas un run', () => {
    expect(ajouterRun(CUMUL_VIDE, { tours: 0, dureeMs: 0 })).toEqual(CUMUL_VIDE);
    expect(ajouterRun(CUMUL_VIDE, { tours: null, dureeMs: null })).toEqual(CUMUL_VIDE);
  });

  it('un run sans tour mais qui a duré compte comme sortie', () => {
    // Rouler sans boucler un tour arrive : sortie écourtée, drapeau rouge.
    expect(ajouterRun(CUMUL_VIDE, { tours: 0, dureeMs: 7 * 60_000 })).toEqual({
      runs: 1,
      tours: 0,
      minutes: 7,
    });
  });

  it('n’ajoute jamais un nombre absurde', () => {
    const c = ajouterRun(CUMUL_VIDE, { tours: Number.NaN, dureeMs: Number.POSITIVE_INFINITY });
    expect(c).toEqual(CUMUL_VIDE);
    const d = ajouterRun(CUMUL_VIDE, { tours: -3, dureeMs: -1000 });
    expect(d).toEqual(CUMUL_VIDE);
  });
});

describe('lireCumul — le stockage local survit aux mises à jour, pas les formes', () => {
  it('relit une forme correcte', () => {
    expect(lireCumul('{"runs":3,"tours":21,"minutes":48}')).toEqual({
      runs: 3,
      tours: 21,
      minutes: 48,
    });
  });

  it('une forme d’hier ne propage pas un NaN jusqu’à l’écran', () => {
    // « NaN Tours » serait pire que rien. Tout ce qui n'est pas un entier fini
    // et positif retombe à zéro.
    expect(lireCumul('{"runs":"trois","tours":null,"minutes":{}}')).toEqual(CUMUL_VIDE);
    expect(lireCumul('pas du json')).toEqual(CUMUL_VIDE);
    expect(lireCumul(null)).toEqual(CUMUL_VIDE);
    expect(lireCumul('')).toEqual(CUMUL_VIDE);
  });

  it('tronque plutôt que d’afficher des décimales', () => {
    expect(lireCumul('{"runs":2.9,"tours":7.4,"minutes":31.8}')).toEqual({
      runs: 2,
      tours: 7,
      minutes: 31,
    });
  });
});

describe('faitsJournee — un fait absent est absent', () => {
  it('ne rend jamais « 0 tour »', () => {
    const faits = faitsJournee({ runs: 1, tours: 0, minutes: 7 });
    expect(faits.map((f) => f.cle)).toEqual(['runs', 'minutes']);
  });

  it('rien du tout sur une journée vide', () => {
    expect(faitsJournee(CUMUL_VIDE)).toEqual([]);
  });

  it('accorde le singulier et le pluriel', () => {
    const un = faitsJournee({ runs: 1, tours: 1, minutes: 3 });
    expect(un.find((f) => f.cle === 'runs')?.label).toBe('Sortie');
    expect(un.find((f) => f.cle === 'tours')?.label).toBe('Tour');
    const plusieurs = faitsJournee({ runs: 2, tours: 9, minutes: 30 });
    expect(plusieurs.find((f) => f.cle === 'runs')?.label).toBe('Sorties');
    expect(plusieurs.find((f) => f.cle === 'tours')?.label).toBe('Tours');
  });
});

describe('journeeAPlusieursRuns — ne pas dire deux fois la même chose', () => {
  it('faux sur la première sortie', () => {
    // Sur le premier run, cumul et run disent le même chiffre. Les afficher
    // tous deux, sous deux titres différents, ferait douter des deux.
    expect(journeeAPlusieursRuns({ runs: 1, tours: 8, minutes: 12 })).toBe(false);
    expect(journeeAPlusieursRuns(CUMUL_VIDE)).toBe(false);
  });

  it('vrai dès la deuxième', () => {
    expect(journeeAPlusieursRuns({ runs: 2, tours: 13, minutes: 21 })).toBe(true);
  });
});

describe('les clés', () => {
  /**
   * LE JOUR EST CELUI DU PILOTE, JAMAIS UTC. À Valence en juillet, un run de
   * 23 h 30 appartient à la journée qu'il vient de vivre — pas à celle du
   * lendemain que le fuseau lui donnerait.
   */
  it('la date est locale', () => {
    const soir = new Date(2026, 6, 15, 23, 30, 0);
    expect(localDayIso(soir)).toBe('2026-07-15');
  });

  it('le cumul est par date, la garde par séance', () => {
    expect(dayCumulKey('2026-07-15')).toBe('day-cumul:2026-07-15');
    expect(dayCompteKey('abc-123')).toBe('day-compte:abc-123');
  });

  it('deux séances du même jour ont deux gardes distinctes', () => {
    // C'est ce qui empêche un remontage de recompter, tout en laissant le
    // second run réel s'ajouter.
    expect(dayCompteKey('run-1')).not.toBe(dayCompteKey('run-2'));
  });
});
