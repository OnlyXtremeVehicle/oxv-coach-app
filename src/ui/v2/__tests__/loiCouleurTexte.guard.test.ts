/**
 * GARDE — deux lois de couleur énoncées dans le dossier, et violées en prod.
 *
 * ===========================================================================
 * LOI 1 — RETIRÉE LE 17/08/2026, PARCE QUE SA MESURE S'EST INVERSÉE
 * ===========================================================================
 *
 * La loi disait : le rouge de donnée ne porte pas de texte. Elle le disait
 * parce que `#E63946` (freinage) mesurait **4,37 / 4,04 / 3,78** sur les trois
 * fonds — échec du seuil AA de 4,5:1 PARTOUT, et sous 4:1 sur deux d'entre eux.
 * Deux endroits le posaient malgré tout sur un `<Text>`.
 *
 * `#E63946` n'existe plus. L'unification des paliers QDI du 17/08 a fait de
 * `dataColors` (`src/theme/v2.ts`) la source unique, et le freinage y vaut
 * `#F65B5B` : **5,70 / 5,26 / 4,92**. Il passe AA sur les trois fonds. Les cinq
 * branches passent, de 4,92 à 10,46.
 *
 * On ne garde pas une interdiction dont le motif a disparu : ce serait
 * exactement le « goût » que le test d'origine refusait d'être. L'interdiction
 * structurelle est donc retirée, et ce qui la remplace est ce qui la fondait
 * déjà — `couleurTexteSure` CALCULE le contraste à chaque appel. Si une teinte
 * repassait sous le seuil, le repli reviendrait tout seul, sans qu'on ait à
 * s'en souvenir. C'est le mécanisme qui protège, pas la liste.
 *
 * Les deux tests ci-dessous épinglent la mesure qui autorise ce retrait. S'ils
 * tombent, la loi 1 doit être rétablie.
 *
 * ===========================================================================
 * LOI 2 — LE SIGLE NE SE PRONONCE PAS
 * ===========================================================================
 *
 * « QDI » n'apparaît nulle part visuellement dans l'espace pilote : c'est une
 * décision de vocabulaire du jalon 5. Il restait dans l'étiquette
 * d'accessibilité du radar — donc le seul pilote à qui l'application parlait
 * en sigles était celui qui ne voyait pas l'écran.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeExecutable, codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

import { colors } from '../tokens';
import { contraste, couleurTexteSure, SEUIL_TEXTE } from '../couleurTexte';

const RACINE = process.cwd();

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

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))];

describe('loi 1 — retirée : la mesure qui la fondait s’est inversée', () => {
  const BRANCHES = [
    ['trajectoire', colors.qdi.trajectoire],
    ['freinage', colors.qdi.freinage],
    ['acceleration', colors.qdi.acceleration],
    ['fluidite', colors.qdi.fluidite],
    ['regularite', colors.qdi.regularite],
  ] as const;

  /**
   * LE TEST QUI AUTORISE LE RETRAIT. C'est le seul motif recevable : la loi
   * interdisait une teinte illisible, et plus aucune des cinq ne l'est.
   *
   * On juge sur les TROIS fonds, pas sur le plus favorable — un composant ne
   * sait pas toujours quelle carte l'accueille, et `bg.card2` a bougé le 13/08
   * pour exactement ce genre de raison.
   */
  it.each(BRANCHES)('%s passe AA sur les trois fonds', (_nom, teinte) => {
    for (const fond of [colors.bg.base, colors.bg.card, colors.bg.card2]) {
      expect(contraste(teinte, fond)).toBeGreaterThanOrEqual(SEUIL_TEXTE);
    }
  });

  /**
   * Et la conséquence, énoncée plutôt que sous-entendue : le mécanisme dynamique
   * ne remplace plus AUCUNE branche. Si l'un de ces `toBe` tombait, une teinte
   * serait repassée sous le seuil — et la loi 1 devrait être rétablie.
   */
  it.each(BRANCHES)('couleurTexteSure laisse %s intacte', (_nom, teinte) => {
    expect(couleurTexteSure(teinte)).toBe(teinte);
  });

  /**
   * Le mécanisme n'est pas devenu permissif pour autant : il refuse toujours ce
   * qui ne passe pas. `text.dim` (#787C8A) mesure 3,63 sur le MEILLEUR des trois
   * fonds — il doit être remplacé, sinon la garde ne garde plus rien.
   */
  it('et il refuse toujours une teinte qui échoue', () => {
    expect(couleurTexteSure(colors.text.dim)).toBe(colors.text.hi);
  });
});

describe('loi 2 — le sigle ne se prononce pas', () => {
  /**
   * L'exemption de `QdiRadar` est PROUVÉE par le test suivant, pas affirmée
   * ici : un composant qui migrerait vers l'espace pilote ferait tomber la
   * garde, ce qui est exactement ce qu'on veut.
   */
  const EXEMPTS_CAR_COACH = ['/src/components/QdiRadar.tsx'];

  it('QdiRadar n’est monté QUE par l’espace coach — sinon l’exemption tombe', () => {
    const monteurs: string[] = [];
    for (const f of TOUS) {
      if (f.endsWith('QdiRadar.tsx')) continue;
      if (/<QdiRadar\b/.test(codeExecutable(readFileSync(f, 'utf8')))) {
        monteurs.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
    expect(monteurs.length).toBeGreaterThan(0);
    expect(monteurs.filter((m) => !m.includes('/(coach)/'))).toEqual([]);
  });

  it('aucune étiquette d’accessibilité pilote ne dit « QDI »', () => {
    const fautifs: string[] = [];
    for (const f of TOUS) {
      const chemin = f.replace(RACINE, '').split(/[\\/]/).join('/');
      // L'espace COACH est un espace de métier : le sigle y est admis.
      if (chemin.includes('/(coach)/') || chemin.includes('/(admin)/')) continue;
      if (EXEMPTS_CAR_COACH.includes(chemin)) continue;
      // Le sigle vit DANS une chaîne : il faut donc la voir.
      const code = codeSansCommentaires(readFileSync(f, 'utf8'));
      // Une étiquette d'accessibilité contenant le sigle, sur une même ligne.
      for (const ligne of code.split('\n')) {
        if (/accessibilityLabel/.test(ligne) && /\bQDI\b/.test(ligne)) {
          fautifs.push(`${chemin} :: ${ligne.trim()}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('le radar dit « Votre signature », comme l’écran', () => {
    // `codeSansCommentaires` ici, PAS `codeExecutable` : ce test vérifie la
    // présence d'une chaîne rendue. Retirer les littéraux la ferait disparaître
    // et la garde échouerait sur un code juste — le choix se fait par
    // ASSERTION, pas par fichier.
    const radar = codeSansCommentaires(
      readFileSync(join(RACINE, 'src', 'ui', 'v2', 'RadarQdi.tsx'), 'utf8')
    );
    expect(radar).toContain('Votre signature —');
    expect(radar).not.toContain('Radar QDI —');
  });
});
