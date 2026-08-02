/**
 * LE HUB ADMIN À DEUX MODES.
 *
 * Ces tests reprennent, volontairement, les pièges déjà tombés côté coach :
 * un mode qui bascule sur une valeur absente, une phrase qui promet une heure
 * de retour, et un zéro fabriqué là où rien n'a été compté.
 */

import {
  ORDRE_FAMILLES,
  TITRE_FAMILLE,
  compteLisible,
  familleVisible,
  modeAdmin,
  phraseMode,
} from '@/features/admin/hubAdminLogic';

describe('modeAdmin', () => {
  it('un pilote en piste suffit', () => {
    expect(modeAdmin({ pilotesEnPiste: 1, seancesDuJour: 0 })).toBe('jour-j');
  });

  it('une séance arrivée aujourd’hui suffit', () => {
    expect(modeAdmin({ pilotesEnPiste: 0, seancesDuJour: 3 })).toBe('jour-j');
  });

  it('aucun des deux → hors journée, le mode COMPLET', () => {
    expect(modeAdmin({ pilotesEnPiste: 0, seancesDuJour: 0 })).toBe('hors-journee');
  });

  it('une valeur absente ne bascule JAMAIS en jour J', () => {
    // Fail-closed appliqué à un mode qui CACHE des outils : dans le doute, on
    // montre tout. Se tromper en affichant coûte un écran chargé ; se tromper
    // en cachant fait chercher une panne.
    expect(modeAdmin({ pilotesEnPiste: NaN, seancesDuJour: NaN })).toBe('hors-journee');
    expect(modeAdmin({} as never)).toBe('hors-journee');
    expect(modeAdmin(null as never)).toBe('hors-journee');
    expect(modeAdmin({ pilotesEnPiste: -2, seancesDuJour: -1 })).toBe('hors-journee');
  });
});

describe('familleVisible', () => {
  it('hors journée, tout est là', () => {
    for (const f of ORDRE_FAMILLES) expect(familleVisible(f, 'hors-journee')).toBe(true);
  });

  it('le jour J garde ce qui sert au bord de la piste', () => {
    expect(familleVisible('surveillance', 'jour-j')).toBe(true);
    expect(familleVisible('a-faire', 'jour-j')).toBe(true);
    expect(familleVisible('plateau', 'jour-j')).toBe(true);
  });

  it('et range la structure', () => {
    expect(familleVisible('structure', 'jour-j')).toBe(false);
  });
});

describe('ORDRE_FAMILLES', () => {
  it('respecte la séparation verticale du cahier', () => {
    // « surveillance en haut, gestes au milieu sous "À faire", plateau en bas »
    expect(ORDRE_FAMILLES).toEqual(['surveillance', 'a-faire', 'plateau', 'structure']);
  });

  it('chaque famille porte un titre', () => {
    for (const f of ORDRE_FAMILLES) {
      expect(TITRE_FAMILLE[f].length).toBeGreaterThan(0);
    }
  });
});

describe('phraseMode', () => {
  it('le jour J s’explique', () => {
    const p = phraseMode('jour-j');
    expect(p).not.toBe(null);
    expect(p).toMatch(/rangé|repli|plus bas/i);
  });

  it('ne promet AUCUNE heure de retour', () => {
    // Côté coach, la phrase annonçait « les outils reviennent ce soir » alors
    // que le mode tient jusqu'à MINUIT — et un test exigeait ce « ce soir »,
    // verrouillant le mensonge. On ne recommence pas.
    const p = phraseMode('jour-j') ?? '';
    expect(p).not.toMatch(/ce soir|demain|dans une heure|à \d{1,2}\s?h/i);
  });

  it('hors journée, rien à dire', () => {
    expect(phraseMode('hors-journee')).toBe(null);
  });

  it('ne presse personne', () => {
    const p = phraseMode('jour-j') ?? '';
    expect(p).not.toMatch(/urgent|vite|retard|devez|il faut/i);
  });
});

describe('compteLisible', () => {
  it('un compte réel s’affiche', () => {
    expect(compteLisible(0)).toBe('0');
    expect(compteLisible(12)).toBe('12');
  });

  it('l’absence de compte s’écrit « — », jamais « 0 »', () => {
    // Zéro pilote attendu est une mesure. Ne pas avoir pu compter n'en est pas
    // une, et sur un écran de régie la différence décide si l'on ouvre le
    // portail.
    expect(compteLisible(null)).toBe('—');
    expect(compteLisible(undefined)).toBe('—');
    expect(compteLisible(NaN)).toBe('—');
  });
});
