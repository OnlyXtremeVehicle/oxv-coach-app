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
  echeance: null,
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

describe('l’échéance datée — le second délai', () => {
  /**
   * Deux délais coexistent et ne se confondent pas : l'engagement de CGV se
   * compte en heures OUVRÉES et se calcule, la validation d'une journée
   * proposée se compte en jours de calendrier et se LIT — elle a été écrite en
   * base au moment où elle était posée.
   */
  it('une échéance dépassée passe devant tout ce qui n’en a pas', () => {
    const file = classerFile(
      [
        poste({ refId: 'sans', sousEngagement: false, echeance: null }),
        poste({
          refId: 'depassee',
          domaine: 'journee_a_valider',
          sousEngagement: false,
          echeance: '2026-08-25T00:00:00Z',
        }),
      ],
      MAINTENANT,
    );
    expect(file[0].refId).toBe('depassee');
    expect(file[0].etat).toBe('depassee');
  });

  /** Prévenu deux jours avant, on a le temps d'agir. La veille, non. */
  it('sous deux jours, l’échéance est signalée proche', () => {
    const file = classerFile(
      [
        poste({
          domaine: 'journee_a_valider',
          sousEngagement: false,
          echeance: '2026-08-27T12:00:00Z', // J+1
        }),
      ],
      MAINTENANT,
    );
    expect(file[0].etat).toBe('echeance_proche');
  });

  it('au-delà, elle est dans les temps', () => {
    const file = classerFile(
      [
        poste({
          domaine: 'journee_a_valider',
          sousEngagement: false,
          echeance: '2026-09-02T12:00:00Z',
        }),
      ],
      MAINTENANT,
    );
    expect(file[0].etat).toBe('dans_les_temps');
  });

  /**
   * L'ENGAGEMENT PRIME SUR LA DATE. Un poste sous engagement de CGV ne se lit
   * jamais sur une échéance écrite : les 72 h ouvrées sont la seule règle qui
   * vaille pour lui, et une date parasite la contredirait en silence.
   */
  it('un poste sous engagement ignore l’échéance écrite', () => {
    const file = classerFile(
      [
        poste({
          sousEngagement: true,
          depuis: '2026-08-24T00:00:00Z',
          echeance: '2030-01-01T00:00:00Z',
        }),
      ],
      MAINTENANT,
    );
    // 12 h ouvrées restantes sur les 72 : proche, malgré l'échéance lointaine.
    expect(file[0].etat).toBe('echeance_proche');
  });

  it('une échéance illisible ne fabrique pas d’urgence', () => {
    const file = classerFile(
      [poste({ sousEngagement: false, echeance: 'pas-une-date' })],
      MAINTENANT,
    );
    expect(file[0].etat).toBe('sans_engagement');
  });
});

describe('les libellés', () => {
  it('chaque domaine porte un nom et un geste', () => {
    for (const d of [
      'examen_vehicule',
      'ecurie',
      'inscription_modifiee',
      'intentions',
      'calendrier',
      'tarif',
      'journee_a_valider',
    ] as const) {
      expect(LIBELLE_DOMAINE[d]).toBeTruthy();
      expect(GESTE_DOMAINE[d]).toBeTruthy();
    }
  });

  /** Le geste dit l'action, jamais l'objet : « Instruire » se comprend seul. */
  it('le geste est un verbe', () => {
    expect(GESTE_DOMAINE.examen_vehicule).toBe('Instruire');
  });

  /**
   * L'APP FAIT LE PADDOCK, LE SITE FAIT LE BUREAU — arbitrage du fondateur,
   * 28/08/2026.
   *
   * Un geste qui se fait au bureau le DIT dans son libellé. Sans cela,
   * l'administrateur cherche dans l'application un bouton qui vit sur le site,
   * et conclut à une panne là où il n'y a qu'un partage de rôles.
   */
  it('les gestes de bureau disent qu’ils sont de bureau', () => {
    expect(GESTE_DOMAINE.ecurie).toContain('bureau');
    expect(GESTE_DOMAINE.journee_a_valider).toContain('bureau');
  });

  /**
   * Les deux constats ne sont demandés par personne : ils disent ce qui EMPÊCHE
   * de vendre. Un calendrier vide ne produit aucun signal — c'est précisément
   * pour cela qu'il doit en produire un ici.
   */
  it('les constats disent ce qui empêche de vendre', () => {
    const file = classerFile(
      [
        poste({ domaine: 'calendrier', refId: 'cal', sousEngagement: false }),
        poste({ domaine: 'tarif', refId: 'tar', sousEngagement: false }),
      ],
      MAINTENANT,
    );
    // Aucun engagement de délai : ce ne sont pas des recours.
    expect(file.every((p) => p.etat === 'sans_engagement')).toBe(true);
    expect(LIBELLE_DOMAINE.calendrier).toBe('Calendrier');
    expect(GESTE_DOMAINE.tarif).toBe('Activer la ligne');
  });

  it('aucun mot de refus dans les libellés', () => {
    const interdits = /refus|rejet|inéligible/i;
    for (const t of [...Object.values(LIBELLE_DOMAINE), ...Object.values(GESTE_DOMAINE)]) {
      expect(t).not.toMatch(interdits);
    }
  });
});
