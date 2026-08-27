/**
 * L'engagement de CGV art. 5.3 se mesure, ou il ne vaut rien.
 *
 * Repères de calendrier utilisés ici (tous en UTC, comme le module) :
 *   2026-08-24 lundi · 2026-08-27 jeudi · 2026-08-28 vendredi
 *   2026-08-29 samedi · 2026-08-31 lundi · 2026-09-02 mercredi
 */

import {
  HEURES_ENGAGEMENT,
  SEUIL_PROCHE_HEURES,
  echeanceExamen,
  etatDelai,
  formaterPlaque,
  heuresOuvreesRestantes,
  rangUrgence,
} from '../examenSuiviLogic';

const LUNDI = new Date('2026-08-24T00:00:00Z');
const VENDREDI = new Date('2026-08-28T00:00:00Z');
const SAMEDI = new Date('2026-08-29T00:00:00Z');

describe('échéance des soixante-douze heures ouvrées', () => {
  it('une semaine pleine : lundi minuit donne jeudi minuit', () => {
    expect(echeanceExamen(LUNDI).toISOString()).toBe('2026-08-27T00:00:00.000Z');
  });

  /**
   * LE CŒUR DU SUJET. En heures d'horloge, vendredi + 72 h tomberait le lundi.
   * L'engagement est en heures OUVRÉES : le week-end ne consomme rien, et
   * l'échéance glisse au mercredi. Une file qui se tromperait ici afficherait
   * « dépassée » sur des demandes parfaitement dans les temps, tous les lundis.
   */
  it('le week-end ne consomme pas l’engagement : vendredi donne mercredi', () => {
    expect(echeanceExamen(VENDREDI).toISOString()).toBe('2026-09-02T00:00:00.000Z');
  });

  /**
   * Le week-end ne consomme rien : une demande déposée le samedi et une
   * demande déposée le lundi SUIVANT partagent la même échéance. C'est le
   * corollaire du test précédent, vu depuis l'autre bout du week-end.
   */
  it('une demande du samedi a l’échéance du lundi suivant', () => {
    const lundiSuivant = new Date('2026-08-31T00:00:00Z');
    expect(echeanceExamen(SAMEDI).getTime()).toBe(echeanceExamen(lundiSuivant).getTime());
    expect(echeanceExamen(SAMEDI).toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });

  it('l’engagement vaut bien soixante-douze heures', () => {
    expect(HEURES_ENGAGEMENT).toBe(72);
  });
});

describe('heures ouvrées restantes', () => {
  it('à l’instant du dépôt, l’engagement est entier', () => {
    expect(heuresOuvreesRestantes(LUNDI, LUNDI)).toBe(HEURES_ENGAGEMENT);
  });

  /**
   * Le dépassement se MESURE, il ne se borne pas à zéro : « en retard de deux
   * heures » et « en retard de six jours » n'appellent pas la même réaction.
   */
  it('au-delà de l’échéance, le reste devient négatif', () => {
    const tard = new Date('2026-08-27T10:00:00Z'); // jeudi, 10 h après l'échéance
    expect(heuresOuvreesRestantes(LUNDI, tard)).toBe(-10);
  });

  it('l’heure entamée ne compte pas — l’arrondi va vers le bas', () => {
    const presque = new Date('2026-08-26T23:30:00Z'); // 30 min avant l'échéance
    expect(heuresOuvreesRestantes(LUNDI, presque)).toBe(0);
  });
});

describe('état de suivi', () => {
  it('une demande instruite est close, quel que soit le retard', () => {
    const tresTard = new Date('2026-12-25T00:00:00Z');
    for (const statut of ['instruite', 'referencee', 'hors_perimetre']) {
      expect(etatDelai(statut, LUNDI, tresTard)).toBe('close');
    }
  });

  it('dans les temps tant qu’il reste plus que le seuil', () => {
    const mercrediMatin = new Date('2026-08-26T11:00:00Z'); // 13 h restantes
    expect(etatDelai('en_attente', LUNDI, mercrediMatin)).toBe('dans_les_temps');
  });

  it('l’échéance est signalée proche au seuil exact', () => {
    const mercrediMidi = new Date('2026-08-26T12:00:00Z'); // 12 h restantes
    expect(heuresOuvreesRestantes(LUNDI, mercrediMidi)).toBe(SEUIL_PROCHE_HEURES);
    expect(etatDelai('en_attente', LUNDI, mercrediMidi)).toBe('echeance_proche');
  });

  it('dépassée dès l’échéance atteinte', () => {
    expect(etatDelai('en_attente', LUNDI, new Date('2026-08-27T00:00:00Z'))).toBe('depassee');
  });
});

describe('ordre d’urgence', () => {
  it('les dépassées passent devant, les closes ferment la marche', () => {
    const ordre = (['close', 'dans_les_temps', 'echeance_proche', 'depassee'] as const)
      .slice()
      .sort((a, b) => rangUrgence(a) - rangUrgence(b));
    expect(ordre).toEqual(['depassee', 'echeance_proche', 'dans_les_temps', 'close']);
  });
});

describe('la plaque à l’affichage', () => {
  it('la forme SIV retrouve ses tirets', () => {
    expect(formaterPlaque('AB123CD')).toBe('AB-123-CD');
  });

  /**
   * Une plaque ancienne, étrangère ou de cyclomoteur ne suit pas la forme SIV.
   * Lui inventer des tirets déformerait la trace au lieu de l'éclairer.
   */
  it('ce qui n’est pas du SIV est rendu tel quel', () => {
    expect(formaterPlaque('1234ABC75')).toBe('1234ABC75');
    expect(formaterPlaque('X')).toBe('X');
  });

  it('l’absence de plaque reste une absence', () => {
    expect(formaterPlaque(null)).toBeNull();
  });
});
