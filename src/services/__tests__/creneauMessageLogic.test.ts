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
