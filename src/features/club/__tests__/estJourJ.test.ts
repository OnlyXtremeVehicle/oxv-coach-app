/**
 * LE JOUR J — quand la journée réservée doit-elle ouvrir le flux de capture ?
 *
 * ===========================================================================
 * CE QUE CES TESTS PROTÈGENT
 * ===========================================================================
 *
 * La carte d'une journée « à venir » n'avait qu'un seul geste : agrandir le QR
 * de présence. Elle n'importait même pas les routes de capture. Le pilote
 * arrivait au circuit avec, dans la main, la seule page qui parlait de sa
 * journée — et cette page ne pouvait ni appairer, ni lancer, ni arrêter.
 *
 * Une entrée « OUVRIR LE JOUR J » y a été posée le 13/08/2026, conditionnée à
 * `estJourJ`. Deux façons de la rater, et les deux sont ici : elle ne doit pas
 * manquer le jour où l'on roule, et elle ne doit pas s'afficher les autres.
 *
 * ===========================================================================
 * ET LA FIN DE JOURNÉE QUI PASSAIT MINUIT
 * ===========================================================================
 *
 * `finJourneeMs` calculait l'heure de fin sur la date de début. Une séance
 * 22h00 → 02h00 obtenait donc une fin QUATRE HEURES AVANT son début : elle
 * quittait « à venir » sans avoir commencé. Le cas est éprouvé plus bas.
 */

import { debutJourneeMs, estJourJ, finJourneeMs, type JourneeLike } from '../passJourneeLogic';

const t = (iso: string) => new Date(iso).getTime();

/** La journée réelle du premier essai terrain. */
const NUIT: JourneeLike = {
  date: '2026-08-13',
  startTime: '00:20:00',
  endTime: '06:00:00',
  format: 'full_day',
  circuitName: 'Bouteville',
};

describe('estJourJ — la nuit du 13/08', () => {
  it('à 00h25, on est dedans', () => {
    expect(estJourJ(NUIT, t('2026-08-13T00:25:00'))).toBe(true);
  });

  it('à 05h55, on y est encore', () => {
    expect(estJourJ(NUIT, t('2026-08-13T05:55:00'))).toBe(true);
  });

  /** Deux heures d'avance : le temps d'arriver et de s'installer. */
  it('à 23h00 la veille, l’entrée est déjà là', () => {
    expect(estJourJ(NUIT, t('2026-08-12T23:00:00'))).toBe(true);
  });

  it('à 20h00 la veille, elle ne l’est pas encore', () => {
    expect(estJourJ(NUIT, t('2026-08-12T20:00:00'))).toBe(false);
  });

  it('à 07h00, la journée est finie — le bilan prend le relais', () => {
    expect(estJourJ(NUIT, t('2026-08-13T07:00:00'))).toBe(false);
  });

  it('une semaine avant, rien', () => {
    expect(estJourJ(NUIT, t('2026-08-06T12:00:00'))).toBe(false);
  });
});

describe('une journée qui franchit minuit', () => {
  const A_CHEVAL: JourneeLike = {
    date: '2026-08-12',
    startTime: '22:00:00',
    endTime: '02:00:00', // fin < début : appartient au lendemain
    format: 'full_day',
    circuitName: 'Bouteville',
  };

  /**
   * LE DÉFAUT CORRIGÉ. Sans le report d'un jour, la fin tombait à 02h00 le 12,
   * soit VINGT HEURES avant le début — la journée était classée « passée » dès
   * sa création.
   */
  it('la fin est APRÈS le début, pas vingt heures avant', () => {
    const debut = debutJourneeMs(A_CHEVAL);
    const fin = finJourneeMs(A_CHEVAL);
    expect(debut).not.toBeNull();
    expect(fin).not.toBeNull();
    expect(fin as number).toBeGreaterThan(debut as number);
    expect((fin as number) - (debut as number)).toBe(4 * 60 * 60 * 1000);
  });

  it('à 01h00 le lendemain, on roule encore', () => {
    expect(estJourJ(A_CHEVAL, t('2026-08-13T01:00:00'))).toBe(true);
  });

  it('à 03h00 le lendemain, c’est fini', () => {
    expect(estJourJ(A_CHEVAL, t('2026-08-13T03:00:00'))).toBe(false);
  });
});

describe('ce qui ne doit jamais lever', () => {
  it('une date illisible rend false, sans exception', () => {
    const sale: JourneeLike = { ...NUIT, date: 'pas-une-date' };
    expect(() => estJourJ(sale, t('2026-08-13T00:25:00'))).not.toThrow();
    expect(estJourJ(sale, t('2026-08-13T00:25:00'))).toBe(false);
  });

  it('une journée sans horaire couvre le jour entier', () => {
    const sansHoraire: JourneeLike = { ...NUIT, startTime: null, endTime: null };
    expect(estJourJ(sansHoraire, t('2026-08-13T14:00:00'))).toBe(true);
    expect(estJourJ(sansHoraire, t('2026-08-14T14:00:00'))).toBe(false);
  });
});
