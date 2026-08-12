/**
 * LE CIRCUIT DE LA JOURNÉE RÉSERVÉE — éprouvé sur le cas réel qui a échoué.
 *
 * Le scénario nommé « la nuit du 13/08 » rejoue EXACTEMENT la situation du
 * premier essai terrain : une journée à Bouteville de 00h20 à 06h00, un
 * circuit Haute Saintonge marqué par défaut, et un pilote qui arme à 00h25.
 * Ce jour-là, la séance est partie sur Haute Saintonge.
 */

import {
  circuitDeLaJournee,
  libelleOrigineCircuit,
  type InscriptionJournee,
} from '../journeeDuJourLogic';

const BOUTEVILLE = '723c9dfc-d0d3-428c-a0d7-f04178e9cd7e';
const HAUTE_SAINTONGE = '0670af3f-ef84-4843-8a55-0c8bc3dcdca9';

/** L'inscription réelle, telle qu'elle est en base. */
const NUIT_13: InscriptionJournee = {
  status: 'confirmed',
  date: '2026-08-13',
  startTime: '00:20:00',
  endTime: '06:00:00',
  circuitId: BOUTEVILLE,
  circuitName: 'Bouteville',
};

/** Instant local (fuseau de l'appareil, comme la base le veut). */
const t = (iso: string) => new Date(iso).getTime();

describe('la nuit du 13/08 — le cas qui a échoué', () => {
  it('à 00h25, la journée en cours donne Bouteville', () => {
    const r = circuitDeLaJournee([NUIT_13], t('2026-08-13T00:25:00'));
    expect(r).not.toBeNull();
    expect(r?.circuitId).toBe(BOUTEVILLE);
    expect(r?.enCours).toBe(true);
  });

  it("à 23h50 la veille, la journée n'a pas commencé mais elle est déjà retenue", () => {
    const r = circuitDeLaJournee([NUIT_13], t('2026-08-12T23:50:00'));
    expect(r?.circuitId).toBe(BOUTEVILLE);
    expect(r?.enCours).toBe(false);
  });

  it('à 05h55, on est encore dedans', () => {
    const r = circuitDeLaJournee([NUIT_13], t('2026-08-13T05:55:00'));
    expect(r?.enCours).toBe(true);
  });

  /**
   * LE POINT QUI DÉCIDE. Le circuit par défaut de la base est Haute Saintonge ;
   * il ne doit jamais l'emporter sur une journée réservée.
   */
  it('la journée réservée prime sur le circuit par défaut', () => {
    const avecDefaut: InscriptionJournee[] = [
      NUIT_13,
      {
        status: 'attended',
        date: '2026-06-01',
        startTime: '09:00:00',
        endTime: '17:30:00',
        circuitId: HAUTE_SAINTONGE,
        circuitName: 'Haute Saintonge',
      },
    ];
    expect(circuitDeLaJournee(avecDefaut, t('2026-08-13T00:25:00'))?.circuitId).toBe(BOUTEVILLE);
  });
});

describe('les journées de nuit qui franchissent minuit', () => {
  const VEILLE: InscriptionJournee = {
    status: 'confirmed',
    date: '2026-08-12',
    startTime: '22:00:00',
    endTime: '02:00:00', // fin < début : le lendemain
    circuitId: BOUTEVILLE,
    circuitName: 'Bouteville',
  };

  it('à 01h00 le lendemain, la journée de la veille est TOUJOURS en cours', () => {
    const r = circuitDeLaJournee([VEILLE], t('2026-08-13T01:00:00'));
    expect(r?.enCours).toBe(true);
    expect(r?.date).toBe('2026-08-12');
  });

  it('à 03h00, elle est finie mais reste la plus proche', () => {
    const r = circuitDeLaJournee([VEILLE], t('2026-08-13T03:00:00'));
    expect(r?.circuitId).toBe(BOUTEVILLE);
    expect(r?.enCours).toBe(false);
  });
});

describe('ce que le module refuse de retenir', () => {
  it('une inscription annulée ne compte pas', () => {
    expect(
      circuitDeLaJournee([{ ...NUIT_13, status: 'cancelled' }], t('2026-08-13T00:25:00'))
    ).toBeNull();
  });

  it('un no_show ne compte pas', () => {
    expect(
      circuitDeLaJournee([{ ...NUIT_13, status: 'no_show' }], t('2026-08-13T00:25:00'))
    ).toBeNull();
  });

  /**
   * Un règlement en attente n'empêche pas d'être sur la piste, et le lui
   * refuser le renverrait au circuit par défaut — c'est-à-dire au mauvais.
   */
  it('un règlement en attente compte quand même', () => {
    for (const s of ['pending', 'pending_payment']) {
      expect(
        circuitDeLaJournee([{ ...NUIT_13, status: s }], t('2026-08-13T00:25:00'))?.circuitId
      ).toBe(BOUTEVILLE);
    }
  });

  it('une journée privée illisible (séance nulle → pas de circuit) ne donne rien', () => {
    expect(
      circuitDeLaJournee(
        [{ ...NUIT_13, circuitId: null, circuitName: null }],
        t('2026-08-13T00:25:00')
      )
    ).toBeNull();
  });

  it('une journée dans huit jours ne détourne rien', () => {
    const r = circuitDeLaJournee([{ ...NUIT_13, date: '2026-08-21' }], t('2026-08-13T00:25:00'));
    expect(r).toBeNull();
  });

  it('aucune inscription rend null, sans lever', () => {
    expect(circuitDeLaJournee([], t('2026-08-13T00:25:00'))).toBeNull();
  });

  it('des dates et heures malformées sont ignorées, sans lever', () => {
    const sales: InscriptionJournee[] = [
      { ...NUIT_13, date: 'pas-une-date' },
      { ...NUIT_13, startTime: '99:99:99' },
    ];
    expect(() => circuitDeLaJournee(sales, t('2026-08-13T00:25:00'))).not.toThrow();
  });
});

describe('deux journées le même jour se départagent par l’horaire', () => {
  it('la plus proche de maintenant l’emporte', () => {
    const matin: InscriptionJournee = {
      status: 'confirmed',
      date: '2026-08-13',
      startTime: '09:00:00',
      endTime: '12:00:00',
      circuitId: HAUTE_SAINTONGE,
      circuitName: 'Haute Saintonge',
    };
    const nuit = NUIT_13;
    // À 00h25 on est DANS la séance de nuit → écart 0, elle gagne.
    expect(circuitDeLaJournee([matin, nuit], t('2026-08-13T00:25:00'))?.circuitId).toBe(BOUTEVILLE);
    // À 08h30 on est à 30 min du matin et 2h30 de la fin de la nuit.
    expect(circuitDeLaJournee([matin, nuit], t('2026-08-13T08:30:00'))?.circuitId).toBe(
      HAUTE_SAINTONGE
    );
  });
});

describe('la phrase qui dit d’où vient le circuit armé', () => {
  /**
   * Le défaut du 13/08 était SILENCIEUX. Une pré-sélection qui ne se nomme pas
   * le reproduirait à l'envers — d'où cette phrase, et son test.
   */
  const retenue = {
    circuitId: BOUTEVILLE,
    circuitName: 'Bouteville',
    date: '2026-08-13',
    enCours: true,
  };

  it('journée en cours et circuit conforme : on le dit', () => {
    expect(libelleOrigineCircuit(retenue, BOUTEVILLE)).toBe('Circuit de votre journée en cours.');
  });

  it('journée à venir et circuit conforme : on le dit autrement', () => {
    expect(libelleOrigineCircuit({ ...retenue, enCours: false }, BOUTEVILLE)).toBe(
      'Circuit de votre journée réservée.'
    );
  });

  /** Le pilote reste maître : on rappelle, on ne corrige pas. */
  it('le pilote a choisi un autre circuit : on rappelle sa journée sans le contredire', () => {
    expect(libelleOrigineCircuit(retenue, HAUTE_SAINTONGE)).toBe(
      'Votre journée réservée est à Bouteville.'
    );
  });

  it('aucune journée retenue : aucune phrase inventée', () => {
    expect(libelleOrigineCircuit(null, BOUTEVILLE)).toBeNull();
    expect(libelleOrigineCircuit(retenue, null)).toBeNull();
  });
});
