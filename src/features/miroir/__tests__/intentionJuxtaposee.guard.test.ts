/**
 * GARDE — l'intention revient devant le pilote, et n'est jamais jugée.
 *
 * ===========================================================================
 * CE QUE LA MESURE A TROUVÉ
 * ===========================================================================
 *
 * La chaîne de l'intention était complète — sauf sa moitié utile :
 *
 *   • l'écriture est montée (`CarteProchaineFois` dans `rec/fin`) ;
 *   • une seule variable à la fois est retenue ;
 *   • le rattachement à la séance suivante est fait ;
 *   • la relecture existe au carnet ;
 *   • `traceNarrativeService` la CHARGE et la rend à son appelant, commentée
 *     « l'intention posée avant la séance, à juxtaposer (le pilote conclut) ».
 *
 * Et `useMiroirHome` ne gardait que `trace.narrative`, jetant le champ ligne
 * suivante. Le bilan, lui, ne la demandait pas : zéro occurrence du mot sur
 * 1 236 lignes. Ce que le pilote s'était dit avant de rouler ne lui revenait
 * jamais au moment où il relit sa séance.
 *
 * ===========================================================================
 * ET LA RÈGLE QUI COMPTE PLUS QUE LE CÂBLAGE
 * ===========================================================================
 *
 * L'intention est JUXTAPOSÉE, pas évaluée. L'application ne sait pas ce que le
 * pilote voulait dire par sa phrase : afficher « tenue » ou « manquée », une
 * coche, une couleur, ce serait juger une intention qu'elle n'a pas comprise —
 * et sortir du miroir pour entrer dans le coaching.
 *
 * La garde interdit ce vocabulaire au voisinage de la section.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

const RACINE = process.cwd();

function lire(...m: string[]): string {
  return readFileSync(join(RACINE, ...m), 'utf8');
}

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

describe('l’intention revient au pilote', () => {
  /**
   * LE CŒUR. Cette assertion aurait échoué jusqu'au 14/08 : la fonction était
   * appelée par `traceNarrativeService`, dont le seul consommateur jetait le
   * champ. Elle exige un appelant qui l'EXPOSE.
   */
  it('le bilan charge l’intention de la séance', () => {
    const hook = codeSansCommentaires(lire('src', 'features', 'miroir', 'useBilan.ts'));
    expect(hook).toContain('getIntentionForSession(sessionId)');
    expect(hook).toContain('intention: settled(intentionR, null)');
  });

  it('et l’écran la rend réellement', () => {
    const ecran = codeSansCommentaires(lire('app', '(app2)', 'bilan', '[sessionId].tsx'));
    expect(ecran).toContain('data.intention');
    // Absente sans intention : la section disparaît, elle ne se vide pas.
    expect(ecran).toMatch(/data\.intention \?/);
  });

  /**
   * L'INTENTION N'EST PAS NOTÉE.
   *
   * Les verbes de verdict sont cherchés dans le code rendu — commentaires
   * retirés, puisque cet en-tête et celui de l'écran les emploient tous les
   * deux pour énoncer l'interdit.
   */
  it('aucun verdict n’est rendu sur l’intention', () => {
    const ecran = codeSansCommentaires(lire('app', '(app2)', 'bilan', '[sessionId].tsx'));
    const bloc = ecran.slice(
      Math.max(0, ecran.indexOf('data.intention') - 400),
      ecran.indexOf('data.intention') + 900
    );
    const verdicts = ['tenue', 'tenu', 'manquée', 'manqué', 'réussi', 'échoué', 'atteint'];
    expect(verdicts.filter((v) => bloc.toLowerCase().includes(v))).toEqual([]);
  });

  /**
   * Et le service ne doit pas redevenir orphelin : un appelant unique qui
   * serait un module intermédiaire jetant le champ, c'est l'état d'avant.
   */
  it('la fonction de lecture a au moins un appelant hors de son service', () => {
    const motif = /\bgetIntentionForSession\s*\(/;
    const appelants: string[] = [];
    for (const racine of ['app', 'src']) {
      for (const f of fichiers(join(RACINE, racine))) {
        if (f.endsWith('intentionsService.ts')) continue;
        if (motif.test(codeSansCommentaires(readFileSync(f, 'utf8')))) appelants.push(f);
      }
    }
    expect(appelants.length).toBeGreaterThan(0);
  });
});
