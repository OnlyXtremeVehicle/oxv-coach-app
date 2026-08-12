/**
 * LE SENS DE PARCOURS — la phrase que l'application ne disait pas.
 *
 * En mode PORTE, la ligne d'arrivée ne se franchit que dans UN sens : à
 * contresens, zéro tour. La règle était écrite dans l'algorithme, éprouvée par
 * ses tests, consignée dans la migration du circuit — et invisible dans
 * l'application. Un pilote qui tourne à l'envers enregistre toute sa séance et
 * découvre au bilan qu'elle n'a aucun chrono.
 *
 * Les deux moitiés du contrat sont ici : la phrase doit être JUSTE quand elle
 * s'affiche, et ABSENTE quand aucun sens n'est imposé.
 */

import { phraseSensParcours, secteurCardinal } from '../sensParcoursLogic';

describe('secteurCardinal — la rose des vents', () => {
  it.each([
    [0, 'nord'],
    [90, 'est'],
    [180, 'sud'],
    [270, 'ouest'],
    [45, 'nord-est'],
    [225, 'sud-ouest'],
    [336.6, 'nord-nord-ouest'], // Bouteville
    [298.5, 'ouest-nord-ouest'], // Haute Saintonge
    [55.2, 'nord-est'], // Ricardo Tormo
    [53.4, 'nord-est'], // Charente
  ])('cap %s° → %s', (cap, attendu) => {
    expect(secteurCardinal(cap as number)).toBe(attendu);
  });

  it('les bornes de secteur basculent au bon endroit', () => {
    expect(secteurCardinal(11.24)).toBe('nord');
    expect(secteurCardinal(11.26)).toBe('nord-nord-est');
    expect(secteurCardinal(348.76)).toBe('nord');
  });

  /** 360° et 0° désignent le même cap : aucun des deux ne doit sortir du tableau. */
  it('360 revient au nord, sans déborder', () => {
    expect(secteurCardinal(360)).toBe('nord');
    expect(secteurCardinal(359.9)).toBe('nord');
  });

  /**
   * Un cap hors de [0, 360[ est RAMENÉ, pas rejeté : 372° reste parfaitement
   * lisible, et refuser l'information pour une saisie mal bornée priverait le
   * pilote du seul réglage qui décide de sa journée. 372 → 12°, qui est bien
   * nord-nord-est : la bascule depuis le nord se fait à 11,25°.
   */
  it('un cap hors bornes est ramené plutôt que rejeté', () => {
    expect(secteurCardinal(372)).toBe('nord-nord-est');
    expect(secteurCardinal(365)).toBe('nord');
    expect(secteurCardinal(-90)).toBe('ouest');
    expect(secteurCardinal(-23.4)).toBe('nord-nord-ouest'); // Bouteville, écrit à l'envers
  });
});

describe('phraseSensParcours', () => {
  /**
   * LE CAS QUI COMPTE. Bouteville, cap 336,6° : c'est cette phrase qui aurait
   * évité au fondateur de risquer une séance entière sans chrono.
   */
  it('Bouteville dit son sens et sa conséquence', () => {
    const p = phraseSensParcours(336.6);
    expect(p).not.toBeNull();
    expect(p).toContain('nord-nord-ouest');
    expect(p).toContain('337°');
    expect(p).toMatch(/aucun tour n’est compté/);
  });

  /**
   * SANS CAP, IL N'Y A PAS DE SENS OBLIGATOIRE — la détection retombe en mode
   * rayon, qui compte les deux sens. Annoncer un sens serait FAUX, et un pilote
   * qui s'y fierait tournerait à l'envers pour rien.
   */
  it.each([[null], [undefined], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'cap %s → aucune phrase, jamais de remplissage',
    (cap) => {
      expect(phraseSensParcours(cap as number | null | undefined)).toBeNull();
    }
  );

  /** Doctrine : on décrit la géométrie, on ne dit pas comment piloter. */
  it('ne prescrit rien et ne tutoie pas', () => {
    const p = phraseSensParcours(336.6) ?? '';
    expect(p).not.toMatch(/\btu\b|\bton\b|\bta\b/i);
    expect(p).not.toMatch(/freinez|accélérez|vous devriez|il faut|évitez/i);
    // Aucun emoji.
    expect(p).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
