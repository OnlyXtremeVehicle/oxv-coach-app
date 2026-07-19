/**
 * Tests arriveeInsigneLogic — garde « insigne une fois par jour » (lot V2-L2,
 * écran 3/8). .ts pur, aucune dépendance MMKV/React (l'écran fait les I/O ;
 * ici, uniquement la décision).
 */

import {
  INSIGNE_DRAWN_KEY,
  shouldAnimateInsigne,
  todayIsoLocal,
} from '../arriveeInsigneLogic';

describe('todayIsoLocal — date locale AAAA-MM-JJ', () => {
  it('formate la date locale, mois/jour sur deux chiffres', () => {
    // 5 mars 2026, 0 h 30 locale : reste le 05, pas de bascule UTC.
    expect(todayIsoLocal(new Date(2026, 2, 5, 0, 30))).toBe('2026-03-05');
  });

  it('gère la fin d’année', () => {
    expect(todayIsoLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('shouldAnimateInsigne — anime une seule fois par jour', () => {
  const today = '2026-07-19';

  it('anime quand rien n’a encore été dessiné (première arrivée jamais)', () => {
    expect(shouldAnimateInsigne(null, today)).toBe(true);
  });

  it('anime quand le dernier tracé date d’un autre jour', () => {
    expect(shouldAnimateInsigne('2026-07-18', today)).toBe(true);
  });

  it('n’anime PAS quand l’insigne a déjà été dessiné aujourd’hui', () => {
    expect(shouldAnimateInsigne(today, today)).toBe(false);
  });

  it('boucle complète : dessiné aujourd’hui → garde tient le reste du jour', () => {
    const drawnOn = todayIsoLocal(new Date(2026, 6, 19, 9, 0));
    // Plus tard le même jour (retour sur l'écran) : plus d'animation.
    expect(shouldAnimateInsigne(drawnOn, todayIsoLocal(new Date(2026, 6, 19, 18, 0)))).toBe(false);
    // Le lendemain : le rituel rejoue.
    expect(shouldAnimateInsigne(drawnOn, todayIsoLocal(new Date(2026, 6, 20, 9, 0)))).toBe(true);
  });
});

describe('INSIGNE_DRAWN_KEY — clé MMKV stable', () => {
  it('est la clé documentée (contrat écran ↔ logique)', () => {
    expect(INSIGNE_DRAWN_KEY).toBe('rec:arrivee:insigneDrawnOn');
  });
});
