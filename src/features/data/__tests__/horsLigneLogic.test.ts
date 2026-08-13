/**
 * SERVIR UNE LISTE D'HIER SANS LE DIRE SERAIT PIRE QUE DE NE RIEN SERVIR.
 *
 * ===========================================================================
 * LES DEUX DÉFAUTS, ET ILS SONT SYMÉTRIQUES
 * ===========================================================================
 *
 * Celui qu'on répare : sans réseau, l'écran Data basculait en ERREUR. Au retour
 * de Bouteville — rase campagne — le pilote venait de rouler, ses séances
 * étaient en base, ses trames sur son téléphone, et il voyait « Réessayer ».
 * `STORAGE_KEYS.LAST_SESSIONS` était déclarée, vidée à chaque déconnexion, et
 * jamais écrite.
 *
 * Celui qu'on risque en le réparant : afficher la liste d'hier comme celle du
 * jour. Le pilote ne verrait pas la séance qu'il vient de rouler et en
 * conclurait qu'elle est perdue — exactement la frayeur du 13/08, provoquée
 * cette fois par le correctif.
 *
 * Le second est le plus grave, parce qu'il est silencieux.
 */

import { messageHorsLigne } from '../horsLigneLogic';

const MAINTENANT = new Date('2026-08-13T18:00:00.000Z').getTime();
const iso = (h: number, m = 0) => new Date(MAINTENANT - h * 3_600_000 - m * 60_000).toISOString();

describe('le cas nominal est SILENCIEUX', () => {
  /**
   * Un bandeau affiché à chaque ouverture cesse d'être lu, et celui-ci porte la
   * seule information qui compte quand elle est vraie.
   */
  it('une liste fraîche ne dit rien', () => {
    expect(messageHorsLigne(null, MAINTENANT)).toBeNull();
  });
});

describe('quand la liste vient de la copie locale, elle le dit', () => {
  it('à l’instant', () => {
    expect(messageHorsLigne(iso(0, 0), MAINTENANT)).toBe('Liste hors ligne, relevée à l’instant.');
  });

  it('en minutes sous l’heure', () => {
    expect(messageHorsLigne(iso(0, 25), MAINTENANT)).toBe(
      'Liste hors ligne, relevée il y a 25 min.'
    );
  });

  it('en heures sous la journée', () => {
    expect(messageHorsLigne(iso(5), MAINTENANT)).toBe('Liste hors ligne, relevée il y a 5 h.');
  });

  /**
   * Au-delà d'un jour, « il y a 37 h » ne situe plus rien. La date le fait.
   */
  it('en date au-delà de vingt-quatre heures', () => {
    const msg = messageHorsLigne(iso(40), MAINTENANT);
    // `\p{L}` et non `\w` : les mois français portent des accents — « août »
    // faisait échouer ce motif alors que le message était parfaitement juste.
    expect(msg).toMatch(/^Liste hors ligne, relevée le \d{1,2} \p{L}+ à \d{2}h\d{2}\.$/u);
  });

  it('le message est toujours explicite sur le caractère hors ligne', () => {
    for (const h of [0, 0.5, 3, 40, 1000]) {
      expect(messageHorsLigne(iso(h), MAINTENANT)).toContain('hors ligne');
    }
  });
});

describe('ce que le message refuse de faire', () => {
  /**
   * UNE DATE ILLISIBLE NE DOIT PAS FAIRE DISPARAÎTRE LE BANDEAU. Le fait qui
   * compte — la liste n'est pas fraîche — reste vrai même si l'on ne sait plus
   * quand elle a été prise. Et surtout : jamais « NaN » à l'écran.
   */
  it('une date illisible garde le bandeau, sans NaN', () => {
    const msg = messageHorsLigne('pas-une-date', MAINTENANT);
    expect(msg).not.toBeNull();
    expect(msg).toContain('hors ligne');
    expect(msg).not.toMatch(/NaN|Invalid/);
  });

  /** Descriptif, jamais prescriptif — la doctrine interdit l'instruction. */
  it('il ne dit pas quoi faire', () => {
    for (const h of [0, 2, 50]) {
      const msg = messageHorsLigne(iso(h), MAINTENANT) as string;
      expect(msg).not.toMatch(/vous devriez|il faut|connectez|activez|vérifiez|réessayez/i);
    }
  });
});
