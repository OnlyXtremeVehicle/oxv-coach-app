/**
 * margeLogic — le chiffre publié est mesuré, ou il n'est pas publié.
 * Les valeurs de référence sont celles de Bouteville (12/08/2026), relues en
 * production : pilote 60,4 · constance 34 · fluidité 100 · véhicule fabriqué.
 */

import { focusVirage, margeModel } from '../margeLogic';
import type { SessionAnalysis } from '@/services/analysesService';

function analysis(over: Partial<SessionAnalysis>): SessionAnalysis {
  return {
    marginGlobalMeasured: null,
    marginVehicle: null,
    marginPilot: null,
    breakdown: null,
    nextFocusCornerIndex: null,
    ...over,
  } as SessionAnalysis;
}

describe('margeModel — publie la marge pilote tant que le véhicule est inventé', () => {
  it('Bouteville : pilote 60,4, deux composantes pondérées, véhicule exclu', () => {
    const m = margeModel(
      analysis({
        marginPilot: 60.4,
        marginGlobalMeasured: 51.4, // présente en base, PAS publiable seule…
        marginVehicle: null, // …parce que le véhicule n'est pas mesuré
        breakdown: { consistency: 34, smoothness: 100 },
      })
    );
    expect(m).toEqual({
      kind: 'pilote',
      pilote: 60.4,
      composantes: [
        { cle: 'consistency', label: 'Constance', valeur: 34, poids: 0.6 },
        { cle: 'smoothness', label: 'Fluidité', valeur: 100, poids: 0.4 },
      ],
    });
  });

  it('véhicule ET globale mesurés : la complète revient d’elle-même', () => {
    const m = margeModel(
      analysis({ marginPilot: 60.4, marginVehicle: 57.2, marginGlobalMeasured: 59.1 })
    );
    expect(m).toEqual({ kind: 'complete', globale: 59.1, pilote: 60.4, vehicule: 57.2 });
  });

  it('sans marge pilote : absente — jamais un zéro, jamais la globale seule', () => {
    expect(margeModel(null)).toEqual({ kind: 'absente' });
    expect(margeModel(analysis({ marginGlobalMeasured: 51.4 }))).toEqual({ kind: 'absente' });
    expect(margeModel(analysis({ marginPilot: NaN }))).toEqual({ kind: 'absente' });
  });

  it('une composante non finie est écartée, pas remplacée', () => {
    const m = margeModel(
      analysis({ marginPilot: 40, breakdown: { consistency: 34, smoothness: NaN } })
    );
    expect(m.kind).toBe('pilote');
    if (m.kind === 'pilote') expect(m.composantes.map((c) => c.cle)).toEqual(['consistency']);
  });
});

describe('focusVirage — un conseil sans position ne pose pas de marqueur', () => {
  const segments = [
    { segmentIndex: 1, startProgress: 0.1, endProgress: 0.2 },
    { segmentIndex: 3, startProgress: null, endProgress: 0.5 },
  ];
  it('résout le milieu du segment ciblé', () => {
    expect(focusVirage(1, segments)).toEqual({ t: 0.15000000000000002, index: 1 });
  });
  it('segment sans position, index inconnu, index nul : null', () => {
    expect(focusVirage(3, segments)).toBeNull();
    expect(focusVirage(7, segments)).toBeNull();
    expect(focusVirage(null, segments)).toBeNull();
  });
});
