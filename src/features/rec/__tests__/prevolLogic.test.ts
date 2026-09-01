/**
 * Le prévol dit-il la vérité sur la chaîne de mesure ?
 *
 * Trois points sont défendus avant tout : un poste non lu se dit NON MESURÉ
 * (jamais vert par défaut), le réseau absent dégrade sans jamais bloquer
 * (l'enregistrement seul reste possible), et chaque poste sort avec un FAIT —
 * pas un ordre. Puis les seuils, qui doivent rester des conventions nommées,
 * distinctes entre bloquant et avertissement.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  evaluerPrevol,
  LIBELLES_POSTES,
  POSTES_ENREGISTREMENT,
  RAPPEL_PREVOL,
  SEUIL_BATTERIE_BOITIER_A_VERIFIER_PCT,
  SEUIL_BATTERIE_BOITIER_BLOQUANT_PCT,
  SEUIL_FREQUENCE_A_VERIFIER_HZ,
  SEUIL_FREQUENCE_BLOQUANT_HZ,
  SEUIL_HACC_A_VERIFIER_M,
  SEUIL_HACC_BLOQUANT_M,
  SEUIL_SATELLITES_A_VERIFIER,
  SEUIL_SATELLITES_BLOQUANT,
  VERSION_PREVOL,
  type EtatsPrevol,
  type PostePrevol,
} from '../prevolLogic';

/** Une chaîne saine de bout en bout : tout mesuré, tout dans les clous. */
function etatsSains(extra?: Partial<EtatsPrevol>): EtatsPrevol {
  return {
    batteriePct: 82,
    memoirePct: 60,
    fixValide: true,
    hAccM: 1.2,
    satellites: 14,
    frequenceHz: 24.8,
    connexionEtablie: true,
    batterieTelephonePct: 75,
    reseauDisponible: true,
    secondesImmobile: 5,
    ...extra,
  };
}

/** Rien n'a été lu : dix inconnues. */
const TOUT_NULL: EtatsPrevol = {
  batteriePct: null,
  memoirePct: null,
  fixValide: null,
  hAccM: null,
  satellites: null,
  frequenceHz: null,
  connexionEtablie: null,
  batterieTelephonePct: null,
  reseauDisponible: null,
  secondesImmobile: null,
};

function poste(bilan: { postes: PostePrevol[] }, id: PostePrevol['poste']): PostePrevol {
  const p = bilan.postes.find((x) => x.poste === id);
  if (p === undefined) throw new Error(`poste absent du bilan : ${id}`);
  return p;
}

// ===========================================================================
// Non mesuré est dit non mesuré — jamais vert par défaut
// ===========================================================================

describe('postes non mesurés', () => {
  it('tout null → chaque poste est non_mesure, aucun n’est pret', () => {
    const bilan = evaluerPrevol(TOUT_NULL);
    expect(bilan.postes).toHaveLength(10);
    for (const p of bilan.postes) {
      expect(p.etat).toBe('non_mesure');
      expect(p.fait.toLowerCase()).toContain('non mesur');
    }
  });

  it('tout null → captation indisponible, la phrase dit la liaison non mesurée', () => {
    const { verdict } = evaluerPrevol(TOUT_NULL);
    expect(verdict.partirPossible).toBe(false);
    expect(verdict.modeDegrade).toBe('indisponible');
    expect(verdict.phrase).toContain('non mesurée');
  });

  it('NaN et Infinity valent non mesuré, jamais une valeur affichée', () => {
    const bilan = evaluerPrevol(etatsSains({ batteriePct: Number.NaN, hAccM: Infinity }));
    expect(poste(bilan, 'batterie_boitier').etat).toBe('non_mesure');
    expect(poste(bilan, 'precision_gnss').etat).toBe('non_mesure');
  });

  it('un poste non mesuré au milieu d’une chaîne saine est NOMMÉ dans la phrase', () => {
    const { verdict } = evaluerPrevol(etatsSains({ memoirePct: null }));
    // La captation part (rien de bloquant), mais le verdict ne recouvre pas
    // la mémoire de vert : elle est dite non mesurée.
    expect(verdict.partirPossible).toBe(true);
    expect(verdict.phrase).toContain('Non mesuré');
    expect(verdict.phrase).toContain(LIBELLES_POSTES.memoire_boitier);
  });
});

// ===========================================================================
// Le réseau ne bloque jamais — l'enregistrement seul reste possible
// ===========================================================================

describe('mode dégradé', () => {
  it('chaîne saine + réseau → complet, partir possible', () => {
    const { verdict } = evaluerPrevol(etatsSains());
    expect(verdict.partirPossible).toBe(true);
    expect(verdict.modeDegrade).toBe('complet');
    expect(verdict.phrase).toBe('Chaîne de mesure prête. Direct disponible.');
  });

  it('réseau indisponible → enregistrement_seul, jamais un blocage', () => {
    const bilan = evaluerPrevol(etatsSains({ reseauDisponible: false }));
    expect(poste(bilan, 'reseau').etat).toBe('a_verifier');
    expect(bilan.verdict.partirPossible).toBe(true);
    expect(bilan.verdict.modeDegrade).toBe('enregistrement_seul');
    expect(bilan.verdict.phrase).toContain('enregistrement seul');
  });

  it('réseau non mesuré → enregistrement_seul aussi, et la phrase le distingue', () => {
    const { verdict } = evaluerPrevol(etatsSains({ reseauDisponible: null }));
    expect(verdict.modeDegrade).toBe('enregistrement_seul');
    expect(verdict.phrase).toContain('Réseau non mesuré');
  });

  it('le réseau ne figure pas parmi les postes d’enregistrement', () => {
    expect(POSTES_ENREGISTREMENT).not.toContain('reseau');
    expect(POSTES_ENREGISTREMENT).toHaveLength(8);
  });

  it('un poste d’enregistrement bloquant → indisponible, et il est nommé', () => {
    const { verdict } = evaluerPrevol(etatsSains({ fixValide: false }));
    expect(verdict.partirPossible).toBe(false);
    expect(verdict.modeDegrade).toBe('indisponible');
    expect(verdict.phrase).toContain('1 poste bloquant');
    expect(verdict.phrase).toContain(LIBELLES_POSTES.fix_gnss);
  });

  it('plusieurs bloquants → tous nommés, au pluriel', () => {
    const { verdict } = evaluerPrevol(etatsSains({ fixValide: false, batteriePct: 4 }));
    expect(verdict.phrase).toContain('2 postes bloquants');
    expect(verdict.phrase).toContain(LIBELLES_POSTES.batterie_boitier);
    expect(verdict.phrase).toContain(LIBELLES_POSTES.fix_gnss);
  });

  it('liaison non établie → bloquant, captation indisponible', () => {
    const bilan = evaluerPrevol(etatsSains({ connexionEtablie: false }));
    expect(poste(bilan, 'connexion').etat).toBe('bloquant');
    expect(bilan.verdict.modeDegrade).toBe('indisponible');
  });

  it('liaison non mesurée → indisponible même si le reste semble propre', () => {
    // « Partir seulement chaîne saine » : une chaîne qu'on n'a pas lue
    // n'est pas saine, quelles que soient les autres valeurs.
    const { verdict } = evaluerPrevol(etatsSains({ connexionEtablie: null }));
    expect(verdict.partirPossible).toBe(false);
    expect(verdict.modeDegrade).toBe('indisponible');
  });
});

// ===========================================================================
// Seuils — bloquant distinct d'avertissement, bornes strictes
// ===========================================================================

describe('seuils', () => {
  it('batterie boîtier : 8 % bloque, 25 % avertit, 82 % est prêt', () => {
    expect(poste(evaluerPrevol(etatsSains({ batteriePct: 8 })), 'batterie_boitier').etat).toBe(
      'bloquant'
    );
    expect(poste(evaluerPrevol(etatsSains({ batteriePct: 25 })), 'batterie_boitier').etat).toBe(
      'a_verifier'
    );
    expect(poste(evaluerPrevol(etatsSains({ batteriePct: 82 })), 'batterie_boitier').etat).toBe(
      'pret'
    );
  });

  it('la valeur exactement AU seuil bloquant reste a_verifier (bornes strictes)', () => {
    const auSeuil = evaluerPrevol(etatsSains({ batteriePct: SEUIL_BATTERIE_BOITIER_BLOQUANT_PCT }));
    expect(poste(auSeuil, 'batterie_boitier').etat).toBe('a_verifier');
    const auSeuilVerif = evaluerPrevol(
      etatsSains({ batteriePct: SEUIL_BATTERIE_BOITIER_A_VERIFIER_PCT })
    );
    expect(poste(auSeuilVerif, 'batterie_boitier').etat).toBe('pret');
  });

  it('hAcc : plus haut est pire', () => {
    expect(
      poste(evaluerPrevol(etatsSains({ hAccM: SEUIL_HACC_BLOQUANT_M + 1 })), 'precision_gnss').etat
    ).toBe('bloquant');
    expect(
      poste(evaluerPrevol(etatsSains({ hAccM: SEUIL_HACC_A_VERIFIER_M + 1 })), 'precision_gnss')
        .etat
    ).toBe('a_verifier');
    expect(poste(evaluerPrevol(etatsSains({ hAccM: 1.2 })), 'precision_gnss').etat).toBe('pret');
  });

  it('satellites : 3 bloque, 6 avertit, 14 est prêt', () => {
    expect(SEUIL_SATELLITES_BLOQUANT).toBeLessThan(SEUIL_SATELLITES_A_VERIFIER);
    expect(poste(evaluerPrevol(etatsSains({ satellites: 3 })), 'satellites').etat).toBe('bloquant');
    expect(poste(evaluerPrevol(etatsSains({ satellites: 6 })), 'satellites').etat).toBe(
      'a_verifier'
    );
    expect(poste(evaluerPrevol(etatsSains({ satellites: 14 })), 'satellites').etat).toBe('pret');
  });

  it('fréquence : 10 Hz bloque, 18 Hz avertit, 24,8 Hz est prêt', () => {
    expect(SEUIL_FREQUENCE_BLOQUANT_HZ).toBeLessThan(SEUIL_FREQUENCE_A_VERIFIER_HZ);
    expect(poste(evaluerPrevol(etatsSains({ frequenceHz: 10 })), 'frequence').etat).toBe(
      'bloquant'
    );
    expect(poste(evaluerPrevol(etatsSains({ frequenceHz: 18 })), 'frequence').etat).toBe(
      'a_verifier'
    );
    expect(poste(evaluerPrevol(etatsSains({ frequenceHz: 24.8 })), 'frequence').etat).toBe('pret');
  });

  it('batterie téléphone : 3 % bloque (c’est lui qui enregistre), 15 % avertit', () => {
    const b = evaluerPrevol(etatsSains({ batterieTelephonePct: 3 }));
    expect(poste(b, 'batterie_telephone').etat).toBe('bloquant');
    expect(b.verdict.modeDegrade).toBe('indisponible');
    expect(
      poste(evaluerPrevol(etatsSains({ batterieTelephonePct: 15 })), 'batterie_telephone').etat
    ).toBe('a_verifier');
  });

  it('un poste a_verifier n’empêche pas de partir, mais il est nommé', () => {
    const { verdict } = evaluerPrevol(etatsSains({ batteriePct: 25 }));
    expect(verdict.partirPossible).toBe(true);
    expect(verdict.phrase).toContain('Aucun poste bloquant.');
    expect(verdict.phrase).toContain('À vérifier');
    expect(verdict.phrase).toContain(LIBELLES_POSTES.batterie_boitier);
  });
});

// ===========================================================================
// Les faits sont des faits
// ===========================================================================

describe('faits', () => {
  it('« Batterie du boîtier : 82 % » — la valeur telle qu’elle est', () => {
    const bilan = evaluerPrevol(etatsSains());
    expect(poste(bilan, 'batterie_boitier').fait).toBe('Batterie du boîtier : 82 %');
    expect(poste(bilan, 'fix_gnss').fait).toBe('Fix GPS acquis');
    expect(poste(bilan, 'precision_gnss').fait).toBe('Précision GPS : 1,2 m');
    expect(poste(bilan, 'frequence').fait).toBe('Fréquence observée : 24,8 Hz (25 Hz nominaux)');
    expect(poste(bilan, 'satellites').fait).toBe('Satellites utilisés : 14');
  });

  it('« Fix GPS non acquis » — un fait, pas un ordre', () => {
    const bilan = evaluerPrevol(etatsSains({ fixValide: false }));
    expect(poste(bilan, 'fix_gnss').fait).toBe('Fix GPS non acquis');
  });

  it('l’ordre des postes est stable : la liaison d’abord, l’orientation en dernier', () => {
    const ids = evaluerPrevol(etatsSains()).postes.map((p) => p.poste);
    expect(ids).toEqual([
      'connexion',
      'batterie_boitier',
      'memoire_boitier',
      'fix_gnss',
      'precision_gnss',
      'satellites',
      'frequence',
      'batterie_telephone',
      'reseau',
      'calibration',
    ]);
  });

  it('la version est posée sur le bilan, et le rappel M02 existe', () => {
    expect(evaluerPrevol(etatsSains()).version).toBe(VERSION_PREVOL);
    expect(RAPPEL_PREVOL).toContain('conditions techniques');
  });
});

// ===========================================================================
// DOCTRINE — verrou lexical de la source
// ===========================================================================

describe('DOCTRINE — verrou lexical de la source', () => {
  it('le module prevolLogic.ts ne prescrit rien et ne fabrique aucun zéro', () => {
    const source = readFileSync(join(__dirname, '..', 'prevolLogic.ts'), 'utf8').toLowerCase();
    const bannis = [
      'freinez',
      'accélérez',
      'il faut',
      'vous devriez',
      'évitez',
      'rechargez',
      'branchez',
      'limite',
      'erreur de pilotage',
      'faute',
    ];
    for (const mot of bannis) {
      expect(source).not.toContain(mot);
    }
  });
});

// ===========================================================================
// L'ORIENTATION DU BOÎTIER — le seul poste qui demande un geste
// ===========================================================================

/**
 * Pourquoi ce poste existe, mesuré le 30/08/2026 sur la seule séance réelle :
 * la plus longue plage continue sous 2 km/h y faisait **2,01 s**, pour un seuil
 * de calibration à 3 s. `etablirCalibration` a donc rendu `null`, et
 * l'orientation du boîtier n'a jamais pu être établie.
 *
 * Desserrer le seuil ne sauvait rien : à 5 km/h le tangage lu passait de −1,3°
 * à −9,2°, parce qu'on ne mesure alors plus la gravité seule. Le geste devait
 * donc remonter AVANT la piste.
 */
describe('poste d’orientation du boîtier', () => {
  it('trois secondes d’immobilité suffisent, et le poste le dit', () => {
    const p = poste(evaluerPrevol(etatsSains({ secondesImmobile: 3 })), 'calibration');
    expect(p.etat).toBe('pret');
    expect(p.fait).toContain('orientation mesurable');
  });

  it('deux secondes ne suffisent pas — et le fait donne le seuil', () => {
    const p = poste(evaluerPrevol(etatsSains({ secondesImmobile: 2 })), 'calibration');
    expect(p.etat).toBe('a_verifier');
    expect(p.fait).toContain('2,0 s');
    expect(p.fait).toContain('3 s');
    expect(p.fait).toContain('2 km/h');
  });

  it('non mesurée reste non mesurée, jamais zéro seconde', () => {
    const p = poste(evaluerPrevol(etatsSains({ secondesImmobile: null })), 'calibration');
    expect(p.etat).toBe('non_mesure');
    expect(p.fait.toLowerCase()).toContain('non mesur');
  });

  /**
   * JAMAIS BLOQUANT. Ne pas calibrer n'empêche pas d'enregistrer — cela empêche
   * de redresser ensuite. Bloquer la captation là-dessus coûterait la séance
   * entière pour gagner une correction.
   */
  it('l’orientation absente ne bloque jamais la captation', () => {
    for (const s of [null, 0, 1.5]) {
      const bilan = evaluerPrevol(etatsSains({ secondesImmobile: s }));
      expect(poste(bilan, 'calibration').etat).not.toBe('bloquant');
      expect(bilan.verdict.partirPossible).toBe(true);
    }
  });

  /** Le fait décrit, il n'ordonne pas. Le prévol ne donne aucune consigne. */
  it('aucune consigne dans le fait', () => {
    for (const s of [null, 1, 4]) {
      const f = poste(evaluerPrevol(etatsSains({ secondesImmobile: s })), 'calibration').fait;
      expect(f).not.toMatch(/immobilisez|arrêtez|veuillez|il faut|vous devez|patientez/i);
    }
  });
});
