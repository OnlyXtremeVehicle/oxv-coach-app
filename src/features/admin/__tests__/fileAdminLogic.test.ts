/**
 * LA FILE D'ADMINISTRATION — ce qui presse passe devant, et rien d'autre.
 *
 * Repères de calendrier (UTC, comme `examenSuiviLogic`) :
 *   2026-08-24 lundi · 2026-08-27 jeudi
 */

import {
  GESTE_DOMAINE,
  LIBELLE_DOMAINE,
  type PosteFile,
  classerFile,
  phraseResume,
  resumerFile,
} from '../fileAdminLogic';

const poste = (over: Partial<PosteFile> = {}): PosteFile => ({
  domaine: 'examen_vehicule',
  refId: 'r1',
  titre: 'Un véhicule',
  detail: '',
  depuis: '2026-08-24T00:00:00Z',
  sousEngagement: true,
  ...over,
});

const MAINTENANT = new Date('2026-08-26T12:00:00Z'); // 12 h ouvrées restantes

describe('le tri suit ce qui presse', () => {
  /**
   * L'ENGAGEMENT PASSE AVANT L'ÂGE. Un pilote écarté depuis trois semaines
   * n'est pas plus pressant qu'un recours déposé ce matin : l'un est une
   * occasion, l'autre une promesse.
   */
  it('les diligences passent après les recours, même bien plus anciennes', () => {
    const file = classerFile(
      [
        poste({ refId: 'vieille_diligence', sousEngagement: false, depuis: '2026-01-01T00:00:00Z' }),
        poste({ refId: 'recours_du_jour', sousEngagement: true, depuis: '2026-08-26T09:00:00Z' }),
      ],
      MAINTENANT,
    );
    expect(file.map((p) => p.refId)).toEqual(['recours_du_jour', 'vieille_diligence']);
  });

  it('les échéances dépassées passent devant les échéances proches', () => {
    const file = classerFile(
      [
        poste({ refId: 'proche', depuis: '2026-08-24T00:00:00Z' }),
        poste({ refId: 'depassee', depuis: '2026-08-20T00:00:00Z' }),
      ],
      MAINTENANT,
    );
    expect(file[0].refId).toBe('depassee');
    expect(file[0].etat).toBe('depassee');
  });

  it('à état égal, la plus ancienne passe devant', () => {
    const file = classerFile(
      [
        poste({ refId: 'recente', sousEngagement: false, depuis: '2026-08-20T00:00:00Z' }),
        poste({ refId: 'ancienne', sousEngagement: false, depuis: '2026-08-01T00:00:00Z' }),
      ],
      MAINTENANT,
    );
    expect(file.map((p) => p.refId)).toEqual(['ancienne', 'recente']);
  });

  /**
   * Un poste sans engagement ne court AUCUNE échéance. Lui en calculer une
   * ferait clignoter en rouge ce qui peut attendre lundi, et l'œil finirait
   * par ne plus distinguer.
   */
  it('une diligence n’a pas d’état de délai', () => {
    const file = classerFile([poste({ sousEngagement: false })], MAINTENANT);
    expect(file[0].etat).toBe('sans_engagement');
  });

  it('une file vide reste vide', () => {
    expect(classerFile([], MAINTENANT)).toEqual([]);
  });
});

describe('le résumé compte ce qui compte', () => {
  it('les diligences ne gonflent ni les dépassées ni les proches', () => {
    const file = classerFile(
      [
        poste({ refId: 'a', depuis: '2026-08-01T00:00:00Z' }),
        poste({ refId: 'b', sousEngagement: false, depuis: '2026-08-01T00:00:00Z' }),
        poste({ refId: 'c', sousEngagement: false, depuis: '2026-08-02T00:00:00Z' }),
      ],
      MAINTENANT,
    );
    const r = resumerFile(file);
    expect(r.total).toBe(3);
    expect(r.depassees).toBe(1);
    expect(r.sansEngagement).toBe(2);
  });

  /** Une file vide se dit par son état vide, pas par une bannière qui annonce zéro. */
  it('aucune phrase sur une file vide', () => {
    expect(phraseResume({ total: 0, depassees: 0, proches: 0, sansEngagement: 0 })).toBeNull();
  });

  it('le dépassement prime sur l’imminence dans la phrase', () => {
    const p = phraseResume({ total: 5, depassees: 2, proches: 3, sansEngagement: 0 });
    expect(p).toContain('2 échéances dépassées');
  });

  it('sans urgence, la phrase le dit sans alarmer', () => {
    const p = phraseResume({ total: 4, depassees: 0, proches: 0, sansEngagement: 4 });
    expect(p).toContain('aucune échéance pressante');
  });
});

describe('les libellés', () => {
  it('chaque domaine porte un nom et un geste', () => {
    for (const d of [
      'examen_vehicule',
      'ecurie',
      'inscription_modifiee',
      'intentions',
    ] as const) {
      expect(LIBELLE_DOMAINE[d]).toBeTruthy();
      expect(GESTE_DOMAINE[d]).toBeTruthy();
    }
  });

  /** Le geste dit l'action, jamais l'objet : « Instruire » se comprend seul. */
  it('le geste est un verbe', () => {
    expect(GESTE_DOMAINE.examen_vehicule).toBe('Instruire');
    expect(GESTE_DOMAINE.ecurie).toBe('Répondre');
  });

  it('aucun mot de refus dans les libellés', () => {
    const interdits = /refus|rejet|inéligible/i;
    for (const t of [...Object.values(LIBELLE_DOMAINE), ...Object.values(GESTE_DOMAINE)]) {
      expect(t).not.toMatch(interdits);
    }
  });
});
