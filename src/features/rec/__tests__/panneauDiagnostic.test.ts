/**
 * Le panneau de diagnostic n'affirme jamais ce qu'il ne sait pas.
 *
 * La règle du plan est courte et elle est vérifiable : *« les quatre causes non
 * vérifiables sont posées EN QUESTIONS, JAMAIS EN AFFIRMATIONS »*.
 *
 * Ces tests la tiennent par les deux bouts — la forme des questions, et
 * l'existence d'un troisième état du côté vérifié.
 */

import { batirPanneau } from '../panneauDiagnostic';

const IOS = { permissionIndeterminee: false, localisationLisible: false };

describe('les questions sont des questions', () => {
  it('chacune se termine par un point d’interrogation', () => {
    const { questions } = batirPanneau({ cause: null, ...IOS });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.texte.trimEnd().endsWith('?') || q.texte.includes('? ')).toBe(true);
    }
  });

  it('aucune n’affirme un état du boîtier', () => {
    // Le défaut qu'on évite : « le boîtier est hors de portée », qui envoie le
    // pilote se rapprocher d'un boîtier simplement éteint.
    const { questions } = batirPanneau({ cause: 'La liaison a échoué.', ...IOS });
    for (const q of questions) {
      expect(q.texte).not.toMatch(/\best (allumé|éteint|hors|à portée|déjà lié)\b/i);
      expect(q.texte).not.toMatch(/\bn’est pas\b|\bn'est pas\b/i);
    }
  });

  it('les quatre du plan sont là, dans son ordre', () => {
    const { questions } = batirPanneau({ cause: null, ...IOS });
    expect(questions.slice(0, 4).map((q) => q.cle)).toEqual([
      'allume',
      'batterie',
      'portee',
      'autreTelephone',
    ]);
  });

  it('elles ne varient pas selon la cause — les masquer serait affirmer par omission', () => {
    const sansCause = batirPanneau({ cause: null, ...IOS }).questions.map((q) => q.cle);
    const avecCause = batirPanneau({ cause: 'Le Bluetooth est éteint sur ce téléphone.', ...IOS })
      .questions.map((q) => q.cle);
    expect(avecCause).toEqual(sansCause);
  });
});

describe('le vérifié a trois états, et « inconnu » en est un', () => {
  it('sans échec, rien n’est affirmé', () => {
    const { verifie } = batirPanneau({ cause: null, ...IOS });
    for (const l of verifie) expect(l.etat).toBe('inconnu');
  });

  it('une permission illisible ne devient JAMAIS « ok »', () => {
    // C'est le cœur de `permissionsLogic` : `unavailable` veut dire « la
    // poignée n'est pas compilée », pas « refusé ». L'afficher en vert serait
    // un mensonge dans une colonne intitulée « vérifié ».
    const { verifie } = batirPanneau({
      cause: 'Le boîtier n’a pas répondu.',
      permissionIndeterminee: true,
      localisationLisible: false,
    });
    const ligne = verifie.find((l) => l.cle === 'autorisationBluetooth');
    expect(ligne?.etat).toBe('inconnu');
  });

  it('un Bluetooth éteint est nommé, avec son geste', () => {
    const { verifie } = batirPanneau({
      cause: 'Le Bluetooth est éteint sur ce téléphone.',
      ...IOS,
    });
    const ligne = verifie.find((l) => l.cle === 'bluetooth');
    expect(ligne?.etat).toBe('echec');
    expect(ligne?.geste).toBeTruthy();
  });

  it('un refus d’autorisation Bluetooth pointe le bon panneau des Réglages', () => {
    const { verifie } = batirPanneau({
      cause: 'L’autorisation Bluetooth est refusée.',
      ...IOS,
    });
    const ligne = verifie.find((l) => l.cle === 'autorisationBluetooth');
    expect(ligne?.etat).toBe('echec');
    expect(ligne?.geste).toContain('Bluetooth');
  });
});

describe('la localisation change de colonne selon ce qu’on peut lire', () => {
  /**
   * MESURÉ, PAS SUPPOSÉ : `app.json` ne déclare que la poignée Bluetooth pour
   * `react-native-permissions`. Interroger la localisation sur iOS rendrait
   * `unavailable`. Elle n'a donc rien à faire dans une colonne « vérifié ».
   */
  it('sur iOS elle est une QUESTION, pas une ligne vérifiée', () => {
    const p = batirPanneau({ cause: null, permissionIndeterminee: false, localisationLisible: false });
    expect(p.verifie.map((l) => l.cle)).not.toContain('localisation');
    expect(p.questions.map((q) => q.cle)).toContain('localisation');
  });

  it('là où elle est lisible, elle remonte d’elle-même dans le vérifié', () => {
    const p = batirPanneau({ cause: null, permissionIndeterminee: false, localisationLisible: true });
    expect(p.verifie.map((l) => l.cle)).toContain('localisation');
    expect(p.questions.map((q) => q.cle)).not.toContain('localisation');
  });

  it('le panneau ne perd jamais la localisation : elle est d’un côté ou de l’autre', () => {
    for (const lisible of [true, false]) {
      const p = batirPanneau({
        cause: null,
        permissionIndeterminee: false,
        localisationLisible: lisible,
      });
      const partout = [...p.verifie.map((l) => l.cle), ...p.questions.map((q) => q.cle)];
      expect(partout).toContain('localisation');
    }
  });
});

describe('ton OXV', () => {
  const tous = [true, false].flatMap((lisible) => {
    const p = batirPanneau({
      cause: 'La liaison a échoué.',
      permissionIndeterminee: false,
      localisationLisible: lisible,
    });
    return [
      ...p.verifie.flatMap((l) => [l.libelle, l.geste ?? '']),
      ...p.questions.map((q) => q.texte),
    ];
  });

  it('aucun emoji, aucun tutoiement', () => {
    for (const t of tous) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\btu\b|\bton\b|\btes\b/i);
    }
  });

  it('aucun impératif adressé au pilote', () => {
    // Doctrine : on décrit, on ne dirige pas. Un chemin de réglages n'est pas
    // un ordre — « Réglages ▸ OXV » situe, « Allez dans Réglages » commande.
    for (const t of tous) {
      expect(t).not.toMatch(/rallumez|vérifiez|activez|redémarrez|allez dans|approchez/i);
    }
  });

  it('aucun mot proscrit', () => {
    for (const t of tous) expect(t).not.toMatch(/\blimite\b/i);
  });
});
