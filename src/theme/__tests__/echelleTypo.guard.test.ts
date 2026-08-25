/**
 * GARDE À CLIQUET — la dette typographique ne remonte plus.
 *
 * ===========================================================================
 * LE DIAGNOSTIC, ET LA CORRECTION D'UN CONSTAT FAUX
 * ===========================================================================
 *
 * L'audit du 17/08/2026 a d'abord conclu « aucune échelle typographique ».
 * **C'était faux** : `fontSize` existe dans `src/theme/v2.ts` depuis longtemps,
 * dix crans distincts, et il est employé 868 fois. Ce qui manquait n'était pas
 * l'échelle, c'était son respect.
 *
 * Mesuré le 17/08, hors tests et archive :
 *
 *   fontSize écrit en NOMBRE BRUT : 1 162 emplois, 182 fichiers
 *   fontSize passé par le JETON   :   868 emplois, 128 fichiers
 *
 * Soit 43 % des emplois qui passent par l'échelle. Le reste l'ignore.
 *
 * ===========================================================================
 * POURQUOI ELLE EST IGNORÉE — ET POURQUOI ON NE L'ÉLARGIT PAS
 * ===========================================================================
 *
 * Les trois tailles les plus écrites en dur **ne sont pas dans l'échelle** :
 * 10 pt (×184), 9 pt (×126), 13 pt (×119). Quatre cent vingt-neuf emplois,
 * 37 % du total. On n'écrit pas un nombre brut par négligence : on l'écrit
 * parce que le jeton qu'il faudrait n'existe pas.
 *
 * La tentation est donc d'ajouter 9, 10 et 13. **On ne le fait pas.** L'échelle
 * porte déjà 11, 12, 14, 15 : y ajouter 9, 10 et 13 donnerait sept crans dans
 * un intervalle de six points. Ce ne serait plus une échelle, ce serait un
 * continuum avec des noms — et un continuum ne contraint rien.
 *
 * Y ramener les emplois existants coûte **0,74 pt de déplacement moyen**,
 * imperceptible à l'œil. C'est un chantier mécanique, pas une décision.
 *
 * ===========================================================================
 * CE QUE FAIT CETTE GARDE
 * ===========================================================================
 *
 * Elle ne corrige rien et n'exige aucune migration. Elle FIGE le compte : le
 * nombre de `fontSize` en dur ne peut plus augmenter.
 *
 * Un cliquet plutôt qu'un interdit, parce qu'un interdit sur 1 162 emplois
 * serait rouge dès le premier jour et se ferait désarmer dans la semaine. Ici,
 * le code neuf passe par le jeton, l'ancien s'assainit quand on le touche, et
 * la borne se resserre à mesure — il suffit de baisser `PLAFOND`.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { codeExecutable } from '@/test-utils/codeSeul';

const RACINE = process.cwd();

/**
 * Le compte au 17/08/2026. **Il ne se relève jamais.**
 *
 * Quand une migration fait baisser le nombre réel, on descend cette borne dans
 * le même commit : une marge qu'on laisse traîner est une marge qu'on
 * reconsomme.
 */
const PLAFOND = 1162;

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '__tests__', 'archive', '.git'].includes(e.name)) fichiers(p, acc);
    } else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))];

/** `fontSize: 14` — un nombre écrit à la main, par opposition à `fontSize: fs.body`. */
const BRUT = /fontSize:\s*\d+/g;

function compter(): { total: number; parFichier: { fichier: string; n: number }[] } {
  const parFichier: { fichier: string; n: number }[] = [];
  let total = 0;
  for (const f of TOUS) {
    // Commentaires retirés : ce fichier en cite plusieurs, et il ne doit pas
    // se compter lui-même.
    const n = (codeExecutable(readFileSync(f, 'utf8')).match(BRUT) ?? []).length;
    if (n > 0) {
      parFichier.push({ fichier: f.replace(RACINE, '').split(/[\\/]/).join('/'), n });
      total += n;
    }
  }
  parFichier.sort((a, b) => b.n - a.n);
  return { total, parFichier };
}

describe('échelle typographique — cliquet', () => {
  const { total, parFichier } = compter();

  /**
   * LE TEST QUI COMPTE. Il échoue sur du code neuf qui écrit une taille à la
   * main, et nomme les fichiers les plus chargés pour dire par où commencer.
   */
  it('le nombre de tailles écrites en dur ne remonte pas', () => {
    if (total > PLAFOND) {
      const pires = parFichier
        .slice(0, 5)
        .map((p) => `${p.fichier} (${p.n})`)
        .join('\n  ');
      throw new Error(
        `${total} tailles en dur, plafond ${PLAFOND}.\n` +
          `Employez \`fontSize\` de src/theme/v2.ts.\n` +
          `Fichiers les plus chargés :\n  ${pires}`
      );
    }
    expect(total).toBeLessThanOrEqual(PLAFOND);
  });

  /**
   * Et le cliquet doit se resserrer. Si le compte est descendu bien sous le
   * plafond, la borne est périmée : elle autorise une rechute silencieuse.
   */
  it('le plafond suit la réalité — pas de marge dormante', () => {
    expect(PLAFOND - total).toBeLessThanOrEqual(40);
  });

  /**
   * La garde ne doit pas être verte pour n'avoir rien cherché : elle regarde
   * bien des fichiers, et son motif reconnaît la forme visée.
   */
  it('la garde regarde des fichiers, et reconnaît la forme visée', () => {
    expect(TOUS.length).toBeGreaterThan(100);
    expect(/fontSize:\s*\d+/.test('fontSize: 14,')).toBe(true);
    expect(/fontSize:\s*\d+/.test('fontSize: fs.body,')).toBe(false);
  });
});
