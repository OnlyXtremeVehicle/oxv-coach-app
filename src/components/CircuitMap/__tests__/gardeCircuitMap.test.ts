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

import { readFileSync, readdirSync, statSync } from 'fs';
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
  /**
   * LA DÉROGATION A DISPARU — ET C'EST UN DURCISSEMENT, PAS UN RELÂCHEMENT.
   *
   * Ce bloc exigeait auparavant que `app/(admin)/circuit.tsx` contienne
   * littéralement `circuitName="Haute Saintonge"` : l'inspecteur était réputé
   * ÊTRE le tracé de référence, donc autorisé à se nommer en dur.
   *
   * C'était vrai tant qu'il ne montrait qu'un circuit. Depuis le Jalon 7,
   * Phase 6, il en montre trois et lit le nom sur la ligne choisie. La
   * dérogation n'a plus d'objet, et la règle vaut désormais pour TOUT le dépôt,
   * sans exception : un nom de circuit écrit à la main est un tracé affirmé
   * sans preuve.
   *
   * Le test ne vérifie plus la présence d'un littéral, il vérifie son ABSENCE
   * partout. Il aurait échoué sur la version d'avant — c'est ce qui le rend
   * armé plutôt que décoratif.
   */
  const RACINE = join(__dirname, '..', '..', '..', '..');
  const IGNORES = new Set(['node_modules', 'archive', '__tests__', '.expo', 'dist', '.claude']);

  function sources(racine: string): string[] {
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      let entrees: string[];
      try {
        entrees = readdirSync(dossier);
      } catch {
        return;
      }
      for (const entree of entrees) {
        if (IGNORES.has(entree)) continue;
        const chemin = join(dossier, entree);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx$/.test(entree)) trouves.push(chemin);
      }
    };
    parcourir(join(RACINE, racine));
    return trouves;
  }

  it('aucun fichier ne nomme un circuit en dur', () => {
    const fichiers = [...sources('app'), ...sources('src')];
    // Sans ce contrôle, un dossier renommé rendrait la garde verte et vide.
    expect(fichiers.length).toBeGreaterThan(200);

    // `circuitName="…"` : un littéral JSX. Une valeur résolue s'écrit
    // `circuitName={…}` et ne correspond pas.
    const fautifs = fichiers.filter((f) => /circuitName="/.test(readFileSync(f, 'utf8')));
    expect(fautifs.map((f) => f.replace(RACINE, ''))).toEqual([]);
  });
});
