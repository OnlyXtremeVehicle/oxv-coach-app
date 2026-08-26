/**
 * GARDE — `idealLapTime` ne s'affiche pas sans que la question soit posée.
 *
 * ===========================================================================
 * CE QUE L'AUDIT M10 A TROUVÉ
 * ===========================================================================
 *
 * Le cahier de veille (§03 « Tour optimal réaliste », fiche M10) écrit que
 * l'assemblage des meilleurs micro-secteurs « produit souvent un tour
 * impossible », et demande l'inverse : des blocs complets entrée–virage–sortie,
 * dont la continuité vitesse / position / accélération est vérifiée à chaque
 * jonction.
 *
 * `idealLapTime` (src/telemetry/delta.ts) fait exactement ce que le cahier
 * écarte : un minimum indice par indice sur une grille uniforme, sommé sans
 * qu'aucune jonction ne soit regardée.
 *
 * Elle n'est PAS corrigée ici — la réécrire en assemblage par blocs suppose des
 * décisions de produit (où coupe-t-on un bloc, quelles tolérances de jonction,
 * que fait-on d'un bloc rejeté) qui reviennent au fondateur.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT, DONC
 * ===========================================================================
 *
 * Elle fige l'état sur lequel l'audit s'appuie : cette fonction n'a AUCUN
 * appelant de production. Tant que c'est vrai, sa méthode ne trompe personne.
 *
 * Le jour où quelqu'un la branche à un écran, ce test devient rouge — et la
 * décision de produit sera prise sciemment, au lieu d'arriver à l'écran par la
 * porte de service.
 *
 * La garde `modulesOrphelins` ne pouvait pas le voir : `delta.ts` EST atteint
 * depuis `app/` (pour `computeDelta`). C'est l'EXPORT qui est mort, pas le
 * module.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const RACINE = process.cwd();

/** Tous les `.ts`/`.tsx` d'un arbre, tests exclus. */
function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

/**
 * Fichiers de production qui APPELLENT `idealLapTime`.
 *
 * L'APPEL, PAS LA CLÉ. `delta.idealLapTime` est la clé du registre de
 * provenance — une chaîne, citée par `TourIdealViz` et par `provenance.ts`.
 * Elle NOMME la grandeur ; elle n'appelle pas la fonction. Une première
 * écriture de cette garde les a accusés tous les deux, et aurait obligé à
 * inscrire deux innocents dans une liste d'exceptions — le début de la fin
 * d'une garde. On écarte donc ce qui suit un point.
 */
function porteurs(): string[] {
  const tous = [...fichiers(join(RACINE, 'src')), ...fichiers(join(RACINE, 'app'))];
  return tous
    .filter((f) => !f.endsWith(join('src', 'telemetry', 'delta.ts')))
    .filter((f) => /(?<![.\w])idealLapTime\b/.test(sansCommentaires(readFileSync(f, 'utf8'))))
    .map((f) => f.replace(RACINE, '').split(sep).join('/'));
}

describe('l’assemblage par micro-secteurs reste hors production', () => {
  it('le balayage fonctionne — sinon la garde serait verte par accident', () => {
    // Contre-test : la déclaration elle-même doit être trouvable. Si le
    // balayage ne voyait rien du tout, l'assertion du dessous ne prouverait
    // rien.
    const source = readFileSync(join(RACINE, 'src', 'telemetry', 'delta.ts'), 'utf8');
    expect(sansCommentaires(source)).toMatch(/export function idealLapTime/);
  });

  /**
   * LE CŒUR. Aucun écran, aucun service, aucun hook n'appelle cette fonction.
   * L'écran « Potentiel démontré » lit le bloc `ideal_lap` de `session_insights`
   * — écrit par `compute-session-insights-v3`, qui n'assemble rien.
   */
  it('aucun appelant de production', () => {
    expect(porteurs()).toEqual([]);
  });
});
