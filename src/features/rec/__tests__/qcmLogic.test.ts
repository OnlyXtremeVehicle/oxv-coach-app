/**
 * Le QCM de l'entre-runs — l'ordre, le vocabulaire, et ce qu'on refuse d'écrire.
 *
 * Trois règles y sont tenues, et aucune n'est mécanique :
 *   — les chiffres restent masqués tant que la question n'est pas traitée ;
 *   — le vocabulaire est celui de la variable coach, sans quoi rien ne se croise ;
 *   — une réponse à moitié ne s'écrit pas.
 */

import {
  QCM_INITIAL,
  RESSENTIS,
  THEMES,
  chiffresAffichables,
  choisirRessenti,
  choisirTheme,
  ecritureDepuis,
  passer,
  questionCourante,
} from '../qcmLogic';

describe('l’ordre — les chiffres attendent la réponse', () => {
  /**
   * LE MOTIF EST DOCTRINAL, pas ergonomique. Un pilote qui lit « record du
   * jour » avant qu'on lui demande ce qu'il a senti répondra que ça allait. Il
   * ne mentira pas : il aura lu la réponse avant la question.
   */
  it('aucun chiffre tant que la question n’est pas traitée', () => {
    expect(chiffresAffichables(QCM_INITIAL)).toBe(false);
    const apresTheme = choisirTheme(QCM_INITIAL, 'freinage');
    expect(chiffresAffichables(apresTheme)).toBe(false);
  });

  it('les chiffres reviennent une fois répondu', () => {
    const fini = choisirRessenti(choisirTheme(QCM_INITIAL, 'rythme'), 'confortable');
    expect(chiffresAffichables(fini)).toBe(true);
  });

  it('PASSER compte comme traiter — on ne retient personne au stand', () => {
    expect(chiffresAffichables(passer(QCM_INITIAL))).toBe(true);
    expect(chiffresAffichables(passer(choisirTheme(QCM_INITIAL, 'voiture')))).toBe(true);
  });
});

describe('l’écriture — une réponse à moitié ne s’écrit pas', () => {
  it('rien à écrire au départ', () => {
    expect(ecritureDepuis(QCM_INITIAL)).toBeNull();
  });

  /**
   * Une note dont le thème serait posé sans ressenti se croiserait avec les
   * autres et fausserait le recoupement — la seule raison d'être de ces
   * colonnes.
   */
  it('un thème sans ressenti ne s’écrit pas', () => {
    expect(ecritureDepuis(choisirTheme(QCM_INITIAL, 'placement'))).toBeNull();
  });

  it('une question passée n’écrit rien, même après un thème choisi', () => {
    expect(ecritureDepuis(passer(choisirTheme(QCM_INITIAL, 'freinage')))).toBeNull();
  });

  it('une réponse complète compose une phrase lisible', () => {
    const e = ecritureDepuis(choisirRessenti(choisirTheme(QCM_INITIAL, 'freinage'), 'serre'));
    expect(e).not.toBeNull();
    expect(e?.theme).toBe('freinage');
    expect(e?.ressenti).toBe('serre');
    // `body` est NOT NULL en base, et une note doit se relire sans décodeur.
    expect(e?.body).toBe('Le freinage : terrain serré.');
  });

  it('« je ne sais pas » S’ÉCRIT — ne pas savoir est un fait', () => {
    // Différent d'avoir passé la question, et différent de ne pas avoir été
    // interrogé. Les trois cas doivent rester distinguables en base.
    const e = ecritureDepuis(choisirRessenti(choisirTheme(QCM_INITIAL, 'voiture'), 'sais_pas'));
    expect(e).not.toBeNull();
    expect(e?.ressenti).toBe('sais_pas');
  });
});

describe('le vocabulaire — celui de la variable coach', () => {
  /**
   * La contrainte est portée en base depuis le 05/08/2026
   * (`pilot_notes_theme_check`). Si ce test tombe, l'écriture sera REFUSÉE par
   * Postgres au lieu d'échouer ici — beaucoup plus tard, et au circuit.
   */
  it('les quatre thèmes du plan, et rien d’autre', () => {
    expect(THEMES.map((t) => t.cle)).toEqual(['freinage', 'placement', 'rythme', 'voiture']);
  });

  it('« je ne sais pas » est offerte au même rang que les autres', () => {
    expect(RESSENTIS.map((r) => r.cle)).toContain('sais_pas');
    expect(RESSENTIS).toHaveLength(4);
  });
});

describe('ton OXV', () => {
  const tous = [
    ...THEMES.map((t) => t.label),
    ...RESSENTIS.map((r) => r.label),
    questionCourante(QCM_INITIAL) ?? '',
    questionCourante(choisirTheme(QCM_INITIAL, 'freinage')) ?? '',
  ];

  it('les questions sont des questions', () => {
    expect(questionCourante(QCM_INITIAL)).toMatch(/\?$/);
    expect(questionCourante(choisirTheme(QCM_INITIAL, 'rythme'))).toMatch(/\?$/);
    // Une fois terminé, il n'y a plus de question — et pas une phrase vide.
    expect(questionCourante(passer(QCM_INITIAL))).toBeNull();
  });

  it('aucun mot proscrit — « marge », jamais « limite »', () => {
    for (const t of tous) expect(t).not.toMatch(/\blimite/i);
  });

  it('aucun jugement, aucune prescription', () => {
    // Doctrine : on décrit, on ne dirige pas. « Terrain serré » décrit une
    // sensation ; « trop rapide » porterait un jugement.
    for (const t of tous) {
      expect(t).not.toMatch(/\btrop\b|\bmauvais\b|\bbien\b|\bmieux\b|devriez|il faut|évitez/i);
    }
  });

  it('aucun emoji, aucun tutoiement', () => {
    for (const t of tous) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });
});
