/**
 * LE HUB À DEUX MODES — temporel le jour J, structuré le reste du temps.
 *
 * ---
 *
 * LE TEST QUI COMPTE
 *
 * `dans le doute, le hub reste COMPLET`. Se tromper en affichant tous les outils
 * coûte un écran chargé. Se tromper dans l'autre sens cacherait ce que le coach
 * est venu chercher — et il croirait à une panne, pas à un mode.
 *
 * ---
 *
 * CE QUE CES TESTS PROTÈGENT AUSSI
 *
 * Que le mode se lise sur des FAITS. Pas sur le calendrier : une journée peut
 * être annulée, un pilote peut rouler un jour non prévu. Un pilote en piste, ou
 * une séance arrivée aujourd'hui — l'un ou l'autre suffit, aucun des deux et le
 * hub reprend sa forme complète.
 */

import {
  type FamilleOutil,
  familleVisible,
  modeHub,
  phraseMode,
} from '@/features/coach/hubModeLogic';

describe('modeHub', () => {
  it('un pilote en piste suffit', () => {
    expect(modeHub({ pilotesEnPiste: 1, seancesDuJour: 0 })).toBe('jour-j');
  });

  it('une séance arrivée aujourd’hui suffit', () => {
    // Le roulage peut être fini et le débrief pas encore fait : c'est toujours
    // le jour J pour le coach.
    expect(modeHub({ pilotesEnPiste: 0, seancesDuJour: 3 })).toBe('jour-j');
  });

  it('aucun des deux → hors journée', () => {
    expect(modeHub({ pilotesEnPiste: 0, seancesDuJour: 0 })).toBe('hors-journee');
  });

  describe('dans le doute, le hub reste COMPLET', () => {
    it('des signaux absents ne déclenchent pas le mode réduit', () => {
      expect(modeHub(null as never)).toBe('hors-journee');
    });

    it('des valeurs non finies non plus', () => {
      expect(modeHub({ pilotesEnPiste: Number.NaN, seancesDuJour: Number.NaN })).toBe(
        'hors-journee'
      );
    });

    it('un compte négatif ne vaut pas présence', () => {
      expect(modeHub({ pilotesEnPiste: -1, seancesDuJour: -2 })).toBe('hors-journee');
    });
  });
});

describe('familleVisible', () => {
  it('hors journée, TOUT est visible — c’est le mode complet', () => {
    for (const f of ['pilotes', 'agenda', 'lecture', 'business'] as FamilleOutil[]) {
      expect(familleVisible(f, 'hors-journee')).toBe(true);
    }
  });

  it('le jour J ne garde que ce qui sert au bord de la piste', () => {
    expect(familleVisible('pilotes', 'jour-j')).toBe(true);
    expect(familleVisible('lecture', 'jour-j')).toBe(true);
  });

  it('l’agenda et l’économie attendent le soir', () => {
    // Les afficher pendant un roulage, c'est reconstituer le menu qu'on voulait
    // défaire : quinze sorties, ce n'est pas un poste de travail.
    expect(familleVisible('agenda', 'jour-j')).toBe(false);
    expect(familleVisible('business', 'jour-j')).toBe(false);
  });
});

describe('phraseMode', () => {
  it('le jour J s’explique — sinon le coach croit à une panne', () => {
    const p = phraseMode('jour-j');
    expect(p).not.toBe(null);
    expect(p).toMatch(/ce soir/i);
  });

  it('hors journée, rien à dire : le hub est complet', () => {
    expect(phraseMode('hors-journee')).toBe(null);
  });

  it('la phrase ne presse personne', () => {
    const p = phraseMode('jour-j') ?? '';
    expect(p).not.toMatch(/urgent|vite|retard|devez|il faut/i);
  });
});
