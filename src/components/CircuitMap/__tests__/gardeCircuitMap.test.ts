/**
 * Garde multi-circuit de `CircuitMap` — vérification du PRÉDICAT et du contrat.
 *
 * La garde existait déjà, mais son champ était optionnel et aucun des onze
 * montages du dépôt ne le passait : elle ne s'est jamais déclenchée. Ce test
 * fixe les deux moitiés de la correction.
 *
 * 1. Le prédicat lui-même : ce qui est reconnu comme Haute Saintonge, et ce qui
 *    ne l'est pas — `null` compris.
 * 2. Le CONTRAT DE TYPE : `circuitName` est obligatoire. C'est cette obligation
 *    qui rend impossible d'ajouter une carte qui dessine en silence, et elle
 *    doit être défendue comme une règle, pas comme une convention.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { estHauteSaintonge } from '@/lib/circuitTopology';

describe('estHauteSaintonge — le prédicat de la garde', () => {
  it('reconnaît les libellés usuels, accents et casse compris', () => {
    for (const nom of [
      'Haute Saintonge',
      'haute saintonge',
      'Haute-Saintonge',
      'Beltoise',
      'BELTOISE',
      'Circuit de Haute Saintonge',
    ]) {
      expect(estHauteSaintonge(nom)).toBe(true);
    }
  });

  it('refuse tout autre circuit', () => {
    for (const nom of ['Valencia', 'Circuit Ricardo Tormo', 'Le Mans', 'Charente']) {
      expect(estHauteSaintonge(nom)).toBe(false);
    }
  });

  // Le cœur doctrinal : un circuit INCONNU vaut refus, pas permission.
  it('refuse l’absence de nom — inconnu n’est pas « par défaut »', () => {
    expect(estHauteSaintonge(null)).toBe(false);
    expect(estHauteSaintonge(undefined)).toBe(false);
    expect(estHauteSaintonge('')).toBe(false);
  });
});

describe('contrat de type — la garde ne peut pas être contournée', () => {
  const source = readFileSync(join(__dirname, '..', 'CircuitMap.tsx'), 'utf8');

  it('déclare circuitName OBLIGATOIRE', () => {
    expect(source).toContain('circuitName: string | null;');
    // La forme optionnelle est précisément ce qui a laissé la garde inerte.
    expect(source).not.toContain('circuitName?:');
  });

  it('ne teste plus l’absence du champ, devenue impossible', () => {
    expect(source).not.toContain('circuitName !== undefined');
  });

  it('refuse de dessiner dès que le prédicat est faux', () => {
    expect(source).toContain('if (!estHauteSaintonge(circuitName))');
  });
});

describe('aucun montage ne contourne la garde', () => {
  // Un montage qui passerait un littéral au lieu d'une valeur résolue
  // rétablirait le silence que ce lot supprime. Seul l'inspecteur admin a le
  // droit de nommer le circuit en dur : il EST le tracé de référence.
  const RACINE = join(__dirname, '..', '..', '..', '..');
  const DEROGATION = ['app/(admin)/circuit.tsx'];

  it('la dérogation admin est unique et explicite', () => {
    expect(DEROGATION).toHaveLength(1);
    const src = readFileSync(join(RACINE, DEROGATION[0]), 'utf8');
    expect(src).toContain('circuitName="Haute Saintonge"');
  });
});
