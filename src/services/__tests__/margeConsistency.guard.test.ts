/**
 * GARDE — l'homonymie `regularite` / `regularity` ne revient pas.
 *
 * ===========================================================================
 * CE QU'ELLE PROTÈGE
 * ===========================================================================
 *
 * `app_session_analyses` porte deux colonnes voisines, `qdi` et
 * `margin_breakdown`. Sur la séance de Bouteville du 13/08/2026, LA MÊME LIGNE
 * disait :
 *
 *     qdi.regularite              = 34
 *     margin_breakdown.regularity = 0
 *
 * Deux mots à une lettre près, deux mesures sans rapport, deux chiffres qui se
 * contredisent. Le QDI mesure la constance du geste sur le tour ; la marge
 * mesure la dispersion des TEMPS au tour.
 *
 * Cette homonymie-là ne se voit pas. Elle ne produit aucune erreur, aucun test
 * rouge, aucun symptôme — jusqu'au jour où quelqu'un ouvre les deux colonnes
 * côte à côte et part chercher un bug qui n'existe pas.
 *
 * ===========================================================================
 * POURQUOI UNE GARDE LEXICALE, ET SUR TROIS FICHIERS
 * ===========================================================================
 *
 * Un renommage de ce genre se défait par le bord le plus discret. Ici il y a
 * DEUX écrivains — le calcul embarqué et la fonction serveur — et il suffit
 * qu'un seul reparte sur l'ancien mot pour que la colonne porte deux formes.
 *
 * La garde lit donc les fichiers, y compris celui de la fonction Deno, que
 * `tsc` ne compile pas et que rien d'autre ne surveille.
 *
 * ===========================================================================
 * CE QU'ELLE NE PROUVE PAS
 * ===========================================================================
 *
 * Que la base est convertie, ni que la fonction est déployée. Les deux gestes
 * de production ont été refusés à l'agent le 13/08 et attendent le fondateur
 * (registre § 0.8). Un test ne lit pas la production ; il tient le code.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

/** Les fichiers qui composent ou consomment `margin_breakdown`. */
const FICHIERS_MARGE = [
  join(RACINE, 'src', 'services', 'marginCalculator.ts'),
  join(RACINE, 'src', 'services', 'coachReadingLogic.ts'),
  join(RACINE, 'src', 'components', 'DebriefMirror.tsx'),
  join(RACINE, 'supabase', 'functions', 'cron-analyze-pending-sessions', 'index.ts'),
];

/**
 * Le code, commentaires retirés.
 *
 * Sans cela la garde s'attraperait elle-même : chacun de ces fichiers EXPLIQUE
 * en toutes lettres que la clé s'appelait `regularity`, et cette explication
 * doit survivre. C'est le mot dans le CODE qu'on interdit, pas dans le récit.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('garde — la clé de marge s’appelle consistency', () => {
  it('les fichiers surveillés existent et ne sont pas vides', () => {
    // Un chemin faux rendrait la garde verte sans rien contrôler.
    for (const f of FICHIERS_MARGE) {
      expect(codeSeul(f).length).toBeGreaterThan(200);
    }
  });

  it('aucun d’eux ne nomme encore `regularity` dans son code', () => {
    const fautifs = FICHIERS_MARGE.filter((f) => /\bregularity\b/i.test(codeSeul(f))).map((f) =>
      f.replace(RACINE, '').split(/[\\/]/).join('/')
    );
    expect(fautifs).toEqual([]);
  });

  it('le calcul embarqué écrit bien `consistency`', () => {
    const src = codeSeul(FICHIERS_MARGE[0]);
    expect(src).toMatch(/\bconsistency\b/);
  });

  /**
   * LE BORD LE PLUS DISCRET. La fonction Deno n'est pas compilée par `tsc`,
   * pas couverte par le lint applicatif, et c'est un second écrivain de la
   * MÊME colonne. C'est par là qu'un renommage se défait.
   */
  it('la fonction serveur, second écrivain, écrit `consistency` elle aussi', () => {
    const src = codeSeul(FICHIERS_MARGE[3]);
    expect(src).toMatch(/margin_breakdown:/);
    expect(src).toMatch(/\bconsistency\b/);
  });

  /**
   * Le mot français reste, lui, parfaitement légitime : c'est la BRANCHE QDI.
   * La garde ne doit pas pousser à le supprimer par confusion — elle vérifie
   * qu'il vit toujours là où il a un sens.
   */
  it('`regularite`, la branche QDI, n’a pas été emportée par erreur', () => {
    const vizMath = readFileSync(join(RACINE, 'src', 'ui', 'v2', 'vizMath.ts'), 'utf8');
    expect(vizMath).toMatch(/'regularite'/);
  });
});
