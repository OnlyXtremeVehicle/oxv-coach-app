import { CONTEXT_FIELD_LABELS, buildContextRows, contextHasContent } from '../coachContextLogic';

describe('contextHasContent', () => {
  it('faux si tous les champs sont vides ou absents', () => {
    expect(contextHasContent({})).toBe(false);
    expect(contextHasContent({ pilotLevel: '', objective: '   ', equipment: null })).toBe(false);
  });

  it('vrai dès qu’un champ est renseigné', () => {
    expect(contextHasContent({ objective: 'Travailler le freinage tardif' })).toBe(true);
    expect(contextHasContent({ weatherNote: 'Piste humide' })).toBe(true);
  });
});

describe('buildContextRows', () => {
  it('ignore les champs vides et respecte l’ordre canonique', () => {
    const rows = buildContextRows({
      weatherNote: 'Sec, 24°C',
      pilotLevel: 'Apprivoisé',
      objective: '   ',
      equipment: 'Pneus semi-slicks',
    });
    expect(rows.map((r) => r.field)).toEqual(['pilotLevel', 'equipment', 'weatherNote']);
    expect(rows.map((r) => r.value)).toEqual(['Apprivoisé', 'Pneus semi-slicks', 'Sec, 24°C']);
  });

  it('trim les valeurs', () => {
    const rows = buildContextRows({ objective: '  Constance  ' });
    expect(rows).toEqual([{ field: 'objective', label: 'Objectif travaillé', value: 'Constance' }]);
  });

  it('liste vide si aucun contenu', () => {
    expect(buildContextRows({})).toEqual([]);
  });
});

describe('CONTEXT_FIELD_LABELS', () => {
  it('expose des libellés FR sobres', () => {
    expect(CONTEXT_FIELD_LABELS.pilotLevel).toBe('Niveau');
    expect(CONTEXT_FIELD_LABELS.objective).toBe('Objectif travaillé');
    expect(CONTEXT_FIELD_LABELS.equipment).toBe('Matériel');
    expect(CONTEXT_FIELD_LABELS.weatherNote).toBe('Météo vécue');
  });
});
