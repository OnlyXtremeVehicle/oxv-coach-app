import {
  composerPlanDeRun,
  LIBELLES_LIGNES,
  RAPPEL_PLAN_DE_RUN,
  VERSION_PLAN_DE_RUN,
  type EntreesPlanDeRun,
} from '../planDeRunLogic';

/** Entrées « tout absent » — chaque test ne renseigne que ce qu'il éprouve. */
const RIEN: EntreesPlanDeRun = {
  intention: null,
  circuitNom: null,
  creneau: null,
  conditions: null,
};

describe('composerPlanDeRun — le texte du pilote est transporté, jamais retouché', () => {
  it('rend l’intention telle qu’elle a été écrite', () => {
    const plan = composerPlanDeRun({ ...RIEN, intention: 'Regarder ce que fait le train avant.' });
    expect(plan.intention).toBe('Regarder ce que fait le train avant.');
  });

  it('rogne les bords, et rien d’autre', () => {
    const plan = composerPlanDeRun({ ...RIEN, intention: '  Le virage 3.  ' });
    expect(plan.intention).toBe('Le virage 3.');
  });

  it('ne fabrique aucune intention quand le pilote n’en a pas posé', () => {
    expect(composerPlanDeRun(RIEN).intention).toBeNull();
    expect(composerPlanDeRun({ ...RIEN, intention: '   \n\t ' }).intention).toBeNull();
  });
});

describe('composerPlanDeRun — une entrée absente ne produit aucune ligne', () => {
  it('sans rien, la carte est vide et ne porte aucune ligne', () => {
    const plan = composerPlanDeRun(RIEN);
    expect(plan.lignes).toEqual([]);
    expect(plan.vide).toBe(true);
  });

  it('une intention seule suffit à ce que la carte ne soit plus vide', () => {
    const plan = composerPlanDeRun({ ...RIEN, intention: 'Le freinage du 1.' });
    expect(plan.vide).toBe(false);
    expect(plan.lignes).toEqual([]);
  });

  it('un nom de circuit vide ou blanc ne devient pas une ligne vide', () => {
    expect(composerPlanDeRun({ ...RIEN, circuitNom: '' }).lignes).toEqual([]);
    expect(composerPlanDeRun({ ...RIEN, circuitNom: '   ' }).lignes).toEqual([]);
  });

  it('rend circuit et créneau quand ils sont connus, dans cet ordre', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      circuitNom: 'Haute Saintonge',
      creneau: 'Début à 09:00',
    });
    expect(plan.lignes.map((l) => l.cle)).toEqual(['circuit', 'creneau']);
    expect(plan.lignes[0]).toEqual({
      cle: 'circuit',
      libelle: LIBELLES_LIGNES.circuit,
      valeur: 'Haute Saintonge',
    });
    expect(plan.lignes[1]?.valeur).toBe('Début à 09:00');
    expect(plan.vide).toBe(false);
  });
});

describe('composerPlanDeRun — les conditions non mesurées ne se rendent pas', () => {
  it('mesure = false : aucune ligne, même si un libellé existe', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      conditions: { label: 'Conditions inconnues', mesure: false, temperatureC: null },
    });
    expect(plan.lignes).toEqual([]);
  });

  it('mesure = true sans température : la ligne dit l’état de piste seul', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      conditions: { label: 'Piste mouillée', mesure: true, temperatureC: null },
    });
    expect(plan.lignes).toEqual([
      { cle: 'conditions', libelle: LIBELLES_LIGNES.conditions, valeur: 'Piste mouillée' },
    ]);
  });

  it('mesure = true avec température : l’état et le degré, arrondis', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      conditions: { label: 'Piste sèche', mesure: true, temperatureC: 21.6 },
    });
    expect(plan.lignes[0]?.valeur).toBe('Piste sèche · 22°');
  });

  it('une température de 0 °C est une MESURE, elle se rend', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      conditions: { label: 'Piste sèche', mesure: true, temperatureC: 0 },
    });
    expect(plan.lignes[0]?.valeur).toBe('Piste sèche · 0°');
  });

  it('une température non finie est traitée comme non mesurée', () => {
    const plan = composerPlanDeRun({
      ...RIEN,
      conditions: { label: 'Piste sèche', mesure: true, temperatureC: Number.NaN },
    });
    expect(plan.lignes[0]?.valeur).toBe('Piste sèche');
  });
});

describe('composerPlanDeRun — pureté et doctrine', () => {
  it('deux appels sur les mêmes entrées rendent la même carte', () => {
    const entrees: EntreesPlanDeRun = {
      intention: 'Observer la sortie du 5.',
      circuitNom: 'Haute Saintonge',
      creneau: 'Début à 09:00',
      conditions: { label: 'Piste sèche', mesure: true, temperatureC: 18 },
    };
    expect(composerPlanDeRun(entrees)).toEqual(composerPlanDeRun(entrees));
  });

  it('ne mute pas ses entrées', () => {
    const entrees: EntreesPlanDeRun = {
      intention: '  Le 3.  ',
      circuitNom: '  Haute Saintonge  ',
      creneau: null,
      conditions: null,
    };
    const copie = JSON.parse(JSON.stringify(entrees)) as EntreesPlanDeRun;
    composerPlanDeRun(entrees);
    expect(entrees).toEqual(copie);
  });

  it('porte sa version', () => {
    expect(composerPlanDeRun(RIEN).version).toBe(VERSION_PLAN_DE_RUN);
  });

  /**
   * LE CŒUR DOCTRINAL. La carte décrit et ne juge pas : aucun verdict
   * d'atteinte, aucun score, aucun verbe prescriptif ne doit sortir de la
   * composition — quelles que soient les entrées.
   */
  it('aucun verdict, aucun score, aucun ordre dans ce que la carte rend', () => {
    const plan = composerPlanDeRun({
      intention: 'Regarder le point de corde du 4.',
      circuitNom: 'Haute Saintonge',
      creneau: 'Début à 09:00',
      conditions: { label: 'Piste sèche', mesure: true, temperatureC: 18 },
    });
    const rendu = [
      plan.intention ?? '',
      ...plan.lignes.map((l) => `${l.libelle} ${l.valeur}`),
      RAPPEL_PLAN_DE_RUN,
      ...Object.values(LIBELLES_LIGNES),
    ]
      .join(' ')
      .toLowerCase();

    const proscrits = [
      'tenue',
      'tenu',
      'manquée',
      'manqué',
      'réussi',
      'échoué',
      'atteint',
      'objectif',
      'critère',
      'score',
      'freinez',
      'accélérez',
      'vous devriez',
      'il faut',
      'évitez',
      'limite',
    ];
    expect(proscrits.filter((p) => rendu.includes(p))).toEqual([]);
  });

  it('le rappel énonce un fait sur l’application, pas une consigne', () => {
    expect(RAPPEL_PLAN_DE_RUN).toContain('ne sont pas mesurés');
  });
});
