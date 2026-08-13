/**
 * L'ÉTAT DE SYNCHRONISATION — le message que personne ne pouvait voir.
 *
 * `captureSyncQueue` expose `hasPending`, `pendingSessionIds` et un dossier de
 * quarantaine. Aucun des trois n'avait le moindre appelant hors des tests : une
 * séance entière pouvait dormir sur le téléphone sans le moindre signe.
 *
 * Le seul symptôme externe était celui du 13/08/2026 — une ligne figée en
 * `recording`, découverte en interrogeant la base à la main. C'est ce silence
 * qui transforme un incident réparable en perte apparente.
 */

import { concerneLaSeance, messageSynchro, type EtatSynchro } from '../syncEnAttenteLogic';

const vide: EtatSynchro = { enAttente: 0, enQuarantaine: 0, seances: [] };

describe('messageSynchro', () => {
  /**
   * LE CAS NOMINAL EST SILENCIEUX. Un écran qui annonce « tout est
   * synchronisé » à chaque séance dilue le seul message qui compte.
   */
  it('rien en attente → aucun message', () => {
    expect(messageSynchro(vide)).toBeNull();
  });

  it('une opération en attente se dit au singulier', () => {
    const m = messageSynchro({ ...vide, enAttente: 1 });
    expect(m?.registre).toBe('attente');
    expect(m?.corps).toMatch(/Une opération/);
    expect(m?.rejeuUtile).toBe(true);
  });

  it('plusieurs opérations donnent leur nombre', () => {
    const m = messageSynchro({ ...vide, enAttente: 7 });
    expect(m?.corps).toContain('7 opérations');
  });

  /**
   * LA QUARANTAINE PRIME. Elle décrit une perte possible ; l'attente ne décrit
   * qu'un délai. Les mettre sur le même plan noierait le grave dans l'ordinaire.
   */
  it('la quarantaine l’emporte sur l’attente', () => {
    const m = messageSynchro({ enAttente: 12, enQuarantaine: 2, seances: [] });
    expect(m?.registre).toBe('bloque');
    expect(m?.corps).toContain('2 opérations');
  });

  /**
   * Un rejeu manuel ne sort RIEN de la quarantaine. Offrir le bouton quand
   * même serait promettre ce qu'on ne peut pas tenir.
   */
  it('aucun rejeu proposé sur une quarantaine', () => {
    expect(messageSynchro({ ...vide, enQuarantaine: 1 })?.rejeuUtile).toBe(false);
  });

  it('ne dramatise pas et ne prescrit rien', () => {
    for (const etat of [
      { ...vide, enAttente: 3 },
      { ...vide, enQuarantaine: 3 },
    ]) {
      const m = messageSynchro(etat);
      const texte = `${m?.titre} ${m?.corps}`;
      expect(texte).not.toMatch(/\btu\b|\bton\b/i);
      expect(texte).not.toMatch(/vous devriez|il faut|évitez|attention/i);
      expect(texte).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    }
  });

  /** Un compteur négatif ne doit pas fabriquer un message. */
  it('des compteurs aberrants ne produisent rien', () => {
    expect(messageSynchro({ enAttente: -1, enQuarantaine: -3, seances: [] })).toBeNull();
  });
});

describe('concerneLaSeance', () => {
  const etat: EtatSynchro = { enAttente: 2, enQuarantaine: 0, seances: ['s1', 's2'] };

  it('vrai quand la séance affichée est dans la file', () => {
    expect(concerneLaSeance(etat, 's1')).toBe(true);
  });

  /** Une opération d'avant-hier n'a rien à faire sur l'écran de CE run. */
  it('faux pour une autre séance', () => {
    expect(concerneLaSeance(etat, 's9')).toBe(false);
  });

  it('faux sans séance', () => {
    expect(concerneLaSeance(etat, null)).toBe(false);
  });
});
