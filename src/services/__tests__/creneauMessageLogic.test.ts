/**
 * Le message dit ce que la base a retenu — jalon 2, phase 3, lot 27bis.
 *
 * ---
 *
 * CE QUE CES TESTS EMPÊCHENT DE REVENIR
 *
 * L'écran de disponibilités annonçait « Créneau ouvert. Il apparaît désormais
 * sur votre fiche. » après chaque création. Les deux phrases étaient fausses :
 * le déclencheur `oxv_coach_availability_open_gate` rabat `open` sur `closed`,
 * et la fiche publique ne lit que `open` / `full`.
 *
 * Ce n'était pas une erreur d'écriture — l'insertion réussissait. C'était une
 * erreur de LECTURE : l'application affirmait le statut qu'elle avait demandé,
 * jamais celui qu'elle avait obtenu. Aucune erreur ne pouvait se lever pour le
 * signaler.
 */

import { messageChangement, messageCreation } from '../creneauMessageLogic';

describe('création d’un créneau', () => {
  // Le cas RÉEL aujourd'hui : le déclencheur rabat sur 'closed'.
  it('un créneau rabattu est « proposé », jamais « ouvert »', () => {
    const m = messageCreation('closed');
    expect(m.titre).toBe('Créneau proposé.');
    expect(m.ecart).toBe(true);
  });

  it('ne prétend pas que le créneau est visible quand il ne l’est pas', () => {
    const m = messageCreation('closed');
    expect(m.detail).toContain('après validation');
    expect(m.detail).not.toContain('désormais');
  });

  // Le cas admin, et le cas d'après si le déclencheur est un jour assoupli.
  it('un créneau réellement ouvert est annoncé comme tel', () => {
    const m = messageCreation('open');
    expect(m.titre).toBe('Créneau ouvert.');
    expect(m.ecart).toBe(false);
  });

  /**
   * LE TEST QUI DÉFEND LA RÈGLE.
   *
   * Le défaut d'origine ne venait pas d'un mauvais libellé : il venait de ce que
   * l'écran n'avait AUCUN moyen de savoir. Tant que le message se déduit du
   * statut effectif, il ne peut plus mentir — quelle que soit la valeur.
   */
  it('aucun statut non ouvert ne produit le mot « ouvert »', () => {
    for (const s of ['closed', 'cancelled', 'full'] as const) {
      const m = messageCreation(s);
      expect(`${m.titre} ${m.detail ?? ''}`).not.toMatch(/ouvert/);
    }
  });
});

describe('changement de statut', () => {
  it('annonce simplement l’action quand la base a suivi', () => {
    expect(messageChangement('closed', 'closed')).toEqual({
      titre: 'Créneau fermé.',
      ecart: false,
    });
    expect(messageChangement('cancelled', 'cancelled').ecart).toBe(false);
  });

  // Le déclencheur restaure l'ancien statut. Un « c'est fait » serait faux.
  it('dit la vérité quand une réouverture est refusée', () => {
    const m = messageChangement('open', 'closed');
    expect(m.titre).toBe('Créneau non rouvert.');
    expect(m.detail).toContain('OXV');
    expect(m.detail).toContain('fermé');
    expect(m.ecart).toBe(true);
  });

  it('signale tout écart, même inattendu', () => {
    expect(messageChangement('closed', 'cancelled').ecart).toBe(true);
  });
});

describe('ton OXV', () => {
  const tous = [
    messageCreation('open'),
    messageCreation('closed'),
    messageChangement('open', 'closed'),
    messageChangement('closed', 'closed'),
    messageChangement('closed', 'cancelled'),
  ];

  it('aucun emoji', () => {
    for (const m of tous) {
      expect(`${m.titre}${m.detail ?? ''}`).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  // Doctrine : on décrit, on ne dirige pas. Aucun impératif adressé au coach.
  it('aucune prescription', () => {
    for (const m of tous) {
      const texte = `${m.titre} ${m.detail ?? ''}`;
      expect(texte).not.toMatch(/vous devez|il faut|veuillez|pensez à|réessayez/i);
    }
  });

  it('aucun tutoiement', () => {
    for (const m of tous) {
      expect(`${m.titre} ${m.detail ?? ''}`).not.toMatch(/\btu\b|\bton\b|\bta\b|\btes\b/i);
    }
  });
});

describe('l’attente se nomme — L-27bis appliqué le 29/07/2026', () => {
  /**
   * Avant la migration, le déclencheur rabattait `open` sur `closed` : le coach
   * lisait « fermé » là où rien n'était refusé. L'état existe maintenant, et le
   * message doit le refléter.
   */
  it('un créneau proposé attend, il n’est pas fermé', () => {
    const m = messageCreation('pending_validation');
    expect(m.ecart).toBe(true);
    expect(m.titre).toBe('Créneau proposé.');
    expect(`${m.titre} ${m.detail ?? ''}`).toMatch(/attend/i);
    expect(`${m.titre} ${m.detail ?? ''}`).not.toMatch(/ferm/i);
  });

  it('« fermé » reste réservé à une vraie fermeture', () => {
    expect(messageChangement('closed', 'closed').titre).toBe('Créneau fermé.');
  });

  /** Un créneau annulé reste annulé : le déclencheur ne touche que l'INSERT. */
  it('une réouverture refusée dit l’état réel, sans le maquiller', () => {
    const m = messageChangement('open', 'cancelled');
    expect(m.ecart).toBe(true);
    expect(`${m.titre} ${m.detail ?? ''}`).toMatch(/annulé/i);
  });

  it('le nouvel état a son adjectif dans les phrases d’écart', () => {
    const m = messageChangement('open', 'pending_validation');
    expect(`${m.titre} ${m.detail ?? ''}`).toMatch(/en attente de validation/i);
  });

  it('le nouvel état garde le ton OXV', () => {
    for (const m of [
      messageCreation('pending_validation'),
      messageChangement('open', 'pending_validation'),
    ]) {
      const t = `${m.titre} ${m.detail ?? ''}`;
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
      expect(t).not.toMatch(/vous devez|il faut|veuillez/i);
    }
  });
});
