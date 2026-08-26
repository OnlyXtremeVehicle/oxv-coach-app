/**
 * Tests du moteur de périmètre véhicule (LOT 11a) — ts-jest node, zéro rendu.
 *
 * Ce qui est verrouillé ici, dans l'ordre de ce qui coûterait le plus cher à
 * casser :
 *
 *   1. « non établi » ≠ « hors du périmètre ». Une donnée qui manque ne devient
 *      jamais une décision commerciale.
 *   2. « hors référentiel » ≠ « hors du périmètre ». La voie de recours des CGV
 *      5.3 ne peut pas se perdre dans un booléen.
 *   3. Les valeurs de BORD des classes — 3,50 / 5,00 / 6,00 — puisque le
 *      document canonique est ambigu et que ce module tranche.
 *   4. Aucun mot de refus, aucun verbe prescriptif dans les motifs rendus.
 */

import {
  DENOMINATION_CLASSE,
  MASSE_MAX_KG,
  RATIO_MAX_KG_CH,
  classeDepuisRatio,
  evalueEligibilite,
  libelleClasse,
  motifsNonRemplis,
  offreOuverteA,
  offresOuvertes,
  ratioKgCh,
} from '../eligibiliteLogic';
import type { ClasseRoulage, VehiculeAExaminer } from '../eligibiliteLogic';

/** Un véhicule complet et dans le périmètre — l'Alpine A110 S du référentiel. */
const veh = (over: Partial<VehiculeAExaminer> = {}): VehiculeAExaminer => ({
  masseKg: 1114,
  puissanceCh: 300,
  carrosserie: 'fermee',
  protectionAntiTonneau: null,
  homologueRoute: true,
  immatricule: true,
  declarationModifications: 'aucune',
  motorisation: 'thermique',
  presenceReferentiel: 'presente',
  ...over,
});

/**
 * Un couple masse / puissance donnant EXACTEMENT le ratio voulu, à l'arrondi
 * au centième près. Puissance de 100 ch : le ratio vaut la masse / 100.
 */
const auRatio = (ratio: number): { masseKg: number; puissanceCh: number } => ({
  masseKg: Math.round(ratio * 100),
  puissanceCh: 100,
});

// ===========================================================================
// Le ratio
// ===========================================================================

describe('rapport masse / puissance', () => {
  it('arrondit au centième — le chiffre montré est celui qui classe', () => {
    expect(ratioKgCh(1035, 180)).toBe(5.75);
    expect(ratioKgCh(1082, 300)).toBe(3.61);
    expect(ratioKgCh(2347, 598)).toBe(3.92);
  });

  /**
   * LA DIVERGENCE TROUVÉE À L'ÉCRITURE DE CE LOT, et les deux seules entrées du
   * référentiel qu'elle touche. `Math.round` tranche au demi-SUPÉRIEUR, le
   * `round()` de Python qui a produit le CSV tranche au PAIR : deux fonctions
   * justes, deux réponses. On suit la pièce contractuelle.
   */
  it('tranche les égalités au pair, comme le référentiel publié', () => {
    expect(ratioKgCh(1570, 400)).toBe(3.92); // 3,925 → 392 pair (Audi RS3 8Y)
    expect(ratioKgCh(1450, 400)).toBe(3.62); // 3,625 → 362 pair (Audi TT RS 8S)
  });

  it('le demi-supérieur aurait rendu autre chose — la convention est bien active', () => {
    // Sans cette assertion, un retour à `Math.round` passerait inaperçu sur
    // tout le reste du parc.
    expect(Math.round((1570 / 400) * 100) / 100).toBe(3.93);
    expect(ratioKgCh(1570, 400)).not.toBe(3.93);
  });

  it('hors égalité, l’arrondi reste l’arrondi ordinaire', () => {
    expect(ratioKgCh(1450, 200)).toBe(7.25); // exact, rien à trancher
    expect(ratioKgCh(1000, 333)).toBe(3.0); // 3,003003… → 3,00
    expect(ratioKgCh(1006, 333)).toBe(3.02); // 3,021021… → 3,02
  });

  it('l’égalité au demi-centième ne fait jamais basculer de classe', () => {
    // 3,925 et 3,625 sont à un demi-centième d'aucun seuil : II dans les deux
    // arrondis possibles.
    expect(classeDepuisRatio(1570, 400)).toBe('II');
    expect(classeDepuisRatio(1450, 400)).toBe('II');
  });

  it('rend null sur donnée absente, non finie ou non positive — jamais un repli', () => {
    expect(ratioKgCh(null, 300)).toBeNull();
    expect(ratioKgCh(1114, null)).toBeNull();
    expect(ratioKgCh(Number.NaN, 300)).toBeNull();
    expect(ratioKgCh(1114, Number.POSITIVE_INFINITY)).toBeNull();
    expect(ratioKgCh(0, 300)).toBeNull();
    expect(ratioKgCh(1114, 0)).toBeNull();
    expect(ratioKgCh(-1114, 300)).toBeNull();
  });
});

// ===========================================================================
// La classe et ses bornes
// ===========================================================================

describe('classe de roulage', () => {
  it('les trois classes se lisent au milieu de leur plage', () => {
    expect(classeDepuisRatio(auRatio(5.5).masseKg, auRatio(5.5).puissanceCh)).toBe('I');
    expect(classeDepuisRatio(1114, 300)).toBe('II');
    expect(classeDepuisRatio(1470, 830)).toBe('III');
  });

  /**
   * LES BORDS. Le document donne « I : 5,0 à 6,0 » et « II : 3,5 à 5,0 » —
   * 5,0 et 3,5 appartiennent à deux classes à la fois dans le texte. La
   * convention retenue est : borne basse incluse, borne haute exclue, sauf
   * 6,0 qui est C3 (« inférieur ou égal ») et reste inclus.
   */
  describe('valeurs de bord — la convention tranchée', () => {
    const cas: readonly [number, ClasseRoulage | null][] = [
      [3.49, 'III'],
      [3.5, 'II'], // borne basse de II : INCLUSE
      [3.51, 'II'],
      [4.99, 'II'],
      [5.0, 'I'], // borne basse de I : INCLUSE, donc 5,0 n'est pas II
      [5.01, 'I'],
      [5.99, 'I'],
      [6.0, 'I'], // C3 « inférieur ou égal à 6,0 » : INCLUSE
      [6.01, null], // au-delà de C3 : aucune classe ne s'applique
      [12.0, null],
    ];

    it.each(cas)('ratio %s → classe %s', (ratio, attendue) => {
      const { masseKg, puissanceCh } = auRatio(ratio);
      expect(ratioKgCh(masseKg, puissanceCh)).toBe(ratio);
      expect(classeDepuisRatio(masseKg, puissanceCh)).toBe(attendue);
    });
  });

  it('la masse n’entre pas dans le calcul de la classe — C4 est une condition à part', () => {
    // 2 520 kg pour 630 ch : hors plafond C4, mais le ratio reste en classe II.
    expect(classeDepuisRatio(2520, 630)).toBe('II');
  });

  it('une donnée absente ne donne JAMAIS une classe par défaut', () => {
    expect(classeDepuisRatio(null, 300)).toBeNull();
    expect(classeDepuisRatio(1114, null)).toBeNull();
    expect(classeDepuisRatio(null, null)).toBeNull();
  });

  it('les dénominations sont neutres, sans qualificatif ni rang', () => {
    expect(DENOMINATION_CLASSE).toEqual({ I: 'Sport', II: 'GT', III: 'Supersport' });
    expect(libelleClasse('II')).toBe('Classe II — GT');
  });
});

// ===========================================================================
// L'ouverture des offres
// ===========================================================================

describe('offres ouvertes par classe', () => {
  it('la classe I n’ouvre qu’Access', () => {
    expect(offresOuvertes('I')).toEqual(['access']);
    expect(offreOuverteA('signature', 'I')).toBe(false);
    expect(offreOuverteA('heritage', 'I')).toBe(false);
  });

  it('les classes II et III ouvrent Access, Signature et Heritage', () => {
    expect(offresOuvertes('II')).toEqual(['access', 'signature', 'heritage']);
    expect(offresOuvertes('III')).toEqual(['access', 'signature', 'heritage']);
  });

  it('une classe non établie n’ouvre rien — pas même Access par charité', () => {
    expect(offresOuvertes(null)).toEqual([]);
    expect(offreOuverteA('access', null)).toBe(false);
  });

  it('`promotion` n’est pas une offre de ce module — son ouverture n’est pas écrite', () => {
    const toutes = new Set([
      ...offresOuvertes('I'),
      ...offresOuvertes('II'),
      ...offresOuvertes('III'),
    ]);
    expect([...toutes].sort()).toEqual(['access', 'heritage', 'signature']);
  });
});

// ===========================================================================
// Le verdict — C1 à C5
// ===========================================================================

describe('verdict de périmètre', () => {
  it('un véhicule complet et conforme est dans le périmètre', () => {
    const r = evalueEligibilite(veh());
    expect(r.verdict).toBe('dans_le_perimetre');
    expect(r.conditions.map((c) => c.etat)).toEqual([
      'satisfaite',
      'satisfaite',
      'satisfaite',
      'satisfaite',
      'satisfaite',
    ]);
    expect(motifsNonRemplis(r)).toEqual([]);
    expect(r.classe).toBe('II');
    expect(r.offres).toEqual(['access', 'signature', 'heritage']);
  });

  it('les cinq conditions figurent TOUJOURS, dans l’ordre, même satisfaites', () => {
    expect(evalueEligibilite(veh()).conditions.map((c) => c.code)).toEqual([
      'C1',
      'C2',
      'C3',
      'C4',
      'C5',
    ]);
  });

  it('un fait qui dément l’emporte sur une donnée qui manque', () => {
    // Masse hors plafond (fait), puissance absente (lacune) : hors du périmètre.
    const r = evalueEligibilite(veh({ masseKg: 2700, puissanceCh: null }));
    expect(r.verdict).toBe('hors_du_perimetre');
    expect(r.conditions.find((c) => c.code === 'C4')?.etat).toBe('hors_du_perimetre');
    expect(r.conditions.find((c) => c.code === 'C3')?.etat).toBe('non_etablie');
  });
});

describe('C1 — homologation et immatriculation', () => {
  it('non homologué déclaré → hors du périmètre, motif factuel', () => {
    const r = evalueEligibilite(veh({ homologueRoute: false }));
    expect(r.verdict).toBe('hors_du_perimetre');
    expect(r.conditions[0].motif).toBe(
      'Véhicule déclaré non homologué pour la circulation routière.'
    );
  });

  it('non immatriculé déclaré → hors du périmètre', () => {
    expect(evalueEligibilite(veh({ immatricule: false })).verdict).toBe('hors_du_perimetre');
  });

  it('non renseigné → non établi, jamais hors du périmètre', () => {
    const r = evalueEligibilite(veh({ homologueRoute: null }));
    expect(r.verdict).toBe('non_etabli');
    expect(r.conditions[0].etat).toBe('non_etablie');
  });
});

describe('C2 — architecture', () => {
  it('carrosserie fermée : la protection anti-tonneau n’est pas exigée', () => {
    const r = evalueEligibilite(veh({ carrosserie: 'fermee', protectionAntiTonneau: null }));
    expect(r.conditions[1].etat).toBe('satisfaite');
    expect(r.verdict).toBe('dans_le_perimetre');
  });

  it('découvrable avec protection d’origine : dans le périmètre', () => {
    const r = evalueEligibilite(veh({ carrosserie: 'decouvrable', protectionAntiTonneau: true }));
    expect(r.conditions[1].etat).toBe('satisfaite');
    expect(r.verdict).toBe('dans_le_perimetre');
  });

  it('découvrable sans protection : hors du périmètre', () => {
    const r = evalueEligibilite(veh({ carrosserie: 'decouvrable', protectionAntiTonneau: false }));
    expect(r.verdict).toBe('hors_du_perimetre');
  });

  it('découvrable dont la protection n’est pas renseignée : non établi', () => {
    const r = evalueEligibilite(veh({ carrosserie: 'decouvrable', protectionAntiTonneau: null }));
    expect(r.verdict).toBe('non_etabli');
  });

  it('un découvrable porte la réserve opérateur non levée (§6), sans changer le verdict', () => {
    const r = evalueEligibilite(veh({ carrosserie: 'decouvrable', protectionAntiTonneau: true }));
    expect(r.reserves).toContain('admission_decouvrables');
    expect(r.verdict).toBe('dans_le_perimetre');
  });
});

describe('C3 — performance', () => {
  it('à 6,00 kg/ch la condition est satisfaite : la borne est incluse', () => {
    const r = evalueEligibilite(veh({ masseKg: 600, puissanceCh: 100 }));
    expect(r.ratioKgCh).toBe(RATIO_MAX_KG_CH);
    expect(r.conditions[2].etat).toBe('satisfaite');
    expect(r.classe).toBe('I');
  });

  it('au-delà, le motif énonce le fait et cite le périmètre — sans consigne', () => {
    const r = evalueEligibilite(veh({ masseKg: 1300, puissanceCh: 200 }));
    expect(r.verdict).toBe('hors_du_perimetre');
    expect(r.conditions[2].motif).toBe(
      'Rapport masse / puissance de 6,50 kg/ch, au-delà du périmètre de 6,0 kg/ch.'
    );
    expect(r.classe).toBeNull();
    expect(r.offres).toEqual([]);
  });

  it('nomme la donnée qui manque, masse ou puissance', () => {
    expect(evalueEligibilite(veh({ masseKg: null })).conditions[2].motif).toContain('Masse');
    expect(evalueEligibilite(veh({ puissanceCh: null })).conditions[2].motif).toContain(
      'Puissance'
    );
  });
});

describe('C4 — masse', () => {
  it('2 400 kg exactement est dans le périmètre : la borne est incluse', () => {
    const r = evalueEligibilite(veh({ masseKg: MASSE_MAX_KG, puissanceCh: 700 }));
    expect(r.conditions[3].etat).toBe('satisfaite');
    expect(r.verdict).toBe('dans_le_perimetre');
  });

  it('2 401 kg est hors du périmètre, avec la masse et le plafond en clair', () => {
    const r = evalueEligibilite(veh({ masseKg: 2401, puissanceCh: 700 }));
    expect(r.verdict).toBe('hors_du_perimetre');
    // Espace fine insécable U+202F en séparateur de milliers.
    expect(r.conditions[3].motif).toBe('Masse de 2 401 kg, au-delà du plafond de 2 400 kg.');
  });

  it('masse absente → non établi, et la réserve de masse ne se pose pas', () => {
    const r = evalueEligibilite(veh({ masseKg: null }));
    expect(r.verdict).toBe('non_etabli');
    expect(r.reserves).not.toContain('masse_admise_en_piste');
  });
});

describe('C5 — conformité à l’origine', () => {
  it('déclarer « aucune » satisfait C5', () => {
    expect(evalueEligibilite(veh({ declarationModifications: 'aucune' })).conditions[4].etat).toBe(
      'satisfaite'
    );
  });

  it('déclarer des modifications satisfait C5 AUSSI, et ouvre un examen', () => {
    const r = evalueEligibilite(veh({ declarationModifications: 'declarees' }));
    expect(r.conditions[4].etat).toBe('satisfaite');
    expect(r.verdict).toBe('dans_le_perimetre');
    expect(r.examens).toContain('modifications_declarees');
  });

  it('ne pas avoir déclaré → non établi, jamais hors du périmètre', () => {
    const r = evalueEligibilite(veh({ declarationModifications: null }));
    expect(r.verdict).toBe('non_etabli');
  });
});

// ===========================================================================
// LE RECOURS — « hors référentiel » n'est pas « hors périmètre »
// ===========================================================================

describe('hors référentiel ≠ hors du périmètre (CGV 5.3)', () => {
  it('un véhicule absent du référentiel garde son verdict, et ouvre un examen', () => {
    const r = evalueEligibilite(veh({ presenceReferentiel: 'absente' }));
    expect(r.verdict).toBe('dans_le_perimetre');
    expect(r.examens).toEqual(['hors_referentiel']);
  });

  it('la présence au référentiel ne change RIEN au verdict, dans les trois états', () => {
    const base = veh();
    const verdicts = (['presente', 'absente', 'non_recherchee'] as const).map(
      (p) => evalueEligibilite({ ...base, presenceReferentiel: p }).verdict
    );
    expect(new Set(verdicts).size).toBe(1);
  });

  it('elle ne sauve pas non plus un véhicule hors du périmètre', () => {
    const r = evalueEligibilite(
      veh({ masseKg: 2700, puissanceCh: 700, presenceReferentiel: 'presente' })
    );
    expect(r.verdict).toBe('hors_du_perimetre');
  });

  it('un véhicule hors référentiel ET modifié cumule les deux examens', () => {
    const r = evalueEligibilite(
      veh({ presenceReferentiel: 'absente', declarationModifications: 'declarees' })
    );
    expect(r.examens).toEqual(['hors_referentiel', 'modifications_declarees']);
  });
});

// ===========================================================================
// La doctrine, dans le texte rendu
// ===========================================================================

describe('vocabulaire des motifs', () => {
  /** Tous les motifs que le module sait produire, sur un balayage des cas. */
  const tousLesMotifs = (): readonly string[] => {
    const cas: readonly Partial<VehiculeAExaminer>[] = [
      { homologueRoute: false },
      { immatricule: false },
      { homologueRoute: null },
      { immatricule: null },
      { carrosserie: null },
      { carrosserie: 'decouvrable', protectionAntiTonneau: false },
      { carrosserie: 'decouvrable', protectionAntiTonneau: null },
      { masseKg: 1300, puissanceCh: 200 },
      { masseKg: null },
      { puissanceCh: null },
      { masseKg: 2401, puissanceCh: 700 },
      { declarationModifications: null },
    ];
    return cas.flatMap((c) => motifsNonRemplis(evalueEligibilite(veh(c))));
  };

  it('aucun mot de refus — le périmètre n’est pas un refus (art. L121-11)', () => {
    const interdits = /refus|rejet|rejeté|interdit|non autoris|inéligible|non éligible/i;
    for (const m of tousLesMotifs()) expect(m).not.toMatch(interdits);
  });

  it('aucun verbe prescriptif — le module constate, il ne dirige pas', () => {
    const prescriptif = /vous devez|il faut|veuillez|évitez|corrigez|changez|remplacez|choisissez/i;
    for (const m of tousLesMotifs()) expect(m).not.toMatch(prescriptif);
  });

  it('le mot « limite » ne paraît jamais — la doctrine dit « marge », ici « périmètre »', () => {
    for (const m of tousLesMotifs()) expect(m).not.toMatch(/limite/i);
  });

  it('chaque motif est une phrase factuelle close', () => {
    const motifs = tousLesMotifs();
    expect(motifs.length).toBeGreaterThan(0);
    for (const m of motifs) {
      expect(m.length).toBeGreaterThan(10);
      expect(m.endsWith('.')).toBe(true);
    }
  });
});
