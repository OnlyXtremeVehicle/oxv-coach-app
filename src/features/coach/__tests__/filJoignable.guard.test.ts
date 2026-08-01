/**
 * GARDE DE SOURCE — le fil de séance doit rester JOIGNABLE.
 *
 * ---
 *
 * POURQUOI CETTE GARDE EXISTE
 *
 * Le défaut le plus fréquent de ce dépôt n'est pas le code faux : c'est l'écran
 * qui existe et que rien n'atteint. Trois écrans du Club ont vécu ainsi, sans un
 * seul lien entrant, pendant que la documentation les décrivait comme livrés.
 *
 * Un fil de séance auquel aucun bouton ne mène serait exactement cela : du
 * travail invisible, et une ligne de rapport qui ment.
 *
 * ---
 *
 * CE QU'ELLE VÉRIFIE
 *
 * Qu'au moins un fichier de l'application, autre que l'écran lui-même, navigue
 * vers `/(coach)/fil`. Elle ne dit pas que le chemin est ATTEIGNABLE à
 * l'exécution — un bouton peut être rendu sous une condition jamais vraie. Elle
 * dit seulement que l'intention est câblée quelque part.
 *
 * ---
 *
 * CE QU'ELLE NE PROUVE PAS
 *
 * Que le fil affiche quelque chose. Au 01/08/2026, la production porte 13
 * lectures machine, 1 tour et zéro annotation : il sera presque vide. C'est un
 * état honnête, pas une panne — mais ne pas confondre « joignable » et « utile ».
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINES = ['app', 'src'];
const IGNORES = new Set(['node_modules', 'archive', '.expo', 'dist']);
/** L'écran lui-même ne compte pas comme un lien entrant. */
const EXCLUS = 'fil.tsx';

function fichiersSource(racine: string): string[] {
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
      else if (/\.tsx?$/.test(entree)) trouves.push(chemin);
    }
  };
  parcourir(join(process.cwd(), racine));
  return trouves;
}

describe('garde — le fil de séance est joignable', () => {
  const sources = RACINES.flatMap(fichiersSource).filter((f) => !f.endsWith(EXCLUS));

  it('trouve bien des fichiers à inspecter', () => {
    // Sans ce contrôle, une racine renommée rendrait la garde verte et vide.
    expect(sources.length).toBeGreaterThan(200);
  });

  it('au moins un écran navigue vers /(coach)/fil', () => {
    const motif = /['"`]\/\(coach\)\/fil['"`]/;
    const menant = sources.filter((f) => motif.test(readFileSync(f, 'utf8')));

    expect(menant.length).toBeGreaterThan(0);
  });
});
