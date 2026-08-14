/**
 * GARDE — deux lois de couleur énoncées dans le dossier, et violées en prod.
 *
 * ===========================================================================
 * LOI 1 — LE ROUGE DE DONNÉE NE PORTE PAS DE TEXTE
 * ===========================================================================
 *
 * `#E63946` (freinage) mesure **4,37 / 4,04 / 3,78** sur les trois fonds de
 * l'application. Il échoue au seuil AA de 4,5:1 PARTOUT, et passe sous 4:1 sur
 * deux d'entre eux. Les quatre autres teintes QDI vont de 5,96 à 10,46.
 *
 * Deux endroits le posaient sur un `<Text>` — la valeur en g de `BarresG` et
 * la seconde valeur de canal de l'écran de séance. Le dossier écrivait la
 * règle, personne ne la tenait, aucune garde ne la surveillait.
 *
 * La correction ne l'écrit pas non plus en dur : `couleurTexteSure` CALCULE le
 * contraste. Une teinte qui bougerait suivrait sans qu'on s'en souvienne — et
 * `bg.card2` a bougé le 13/08 pour exactement ce genre de raison.
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
import { join } from 'path';

import { colors } from '../tokens';
import { contraste, SEUIL_TEXTE } from '../couleurTexte';

const RACINE = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
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

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))];

describe('loi 1 — le rouge de donnée ne porte pas de texte', () => {
  /**
   * LA MESURE A DÛ ÊTRE REPRISE, ET C'EST INSTRUCTIF.
   *
   * Première écriture : chercher `color:` suivi de la teinte, partout dans le
   * fichier. Elle a rendu `bilanLogic.ts` fautif — or cette ligne pose
   * `markers.push({ color: colors.qdi.freinage })`, un marqueur de TRACÉ. La
   * clé s'appelle `color`, mais ce qui la consomme est un trait, pas du texte.
   *
   * Un verdict faux vaut moins que pas de garde : il fait corriger ce qui
   * allait bien. On ne regarde donc que ce qui produit vraiment du STYLE — un
   * bloc `StyleSheet.create`, ou une ligne portant un attribut `style=`.
   *
   * En React Native, `color:` est du texte ; `backgroundColor`, `borderColor`,
   * `fill` et `stroke` sont des remplissages et des traits, où la teinte est
   * légitime et où la doctrine la voulait.
   */
  it('aucun style ne pose la teinte de freinage sur du texte', () => {
    const interdit = /\bcolor:\s*colors\.qdi\.freinage/;
    const fautifs: string[] = [];
    for (const f of TOUS) {
      const code = sansCommentaires(readFileSync(f, 'utf8'));
      const zones: string[] = [];
      const iSheet = code.indexOf('StyleSheet.create(');
      if (iSheet >= 0) zones.push(code.slice(iSheet));
      for (const ligne of code.split('\n')) {
        if (ligne.includes('style=')) zones.push(ligne);
      }
      if (zones.some((z) => interdit.test(z))) {
        fautifs.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * Et la garde ne doit pas être verte pour n'avoir rien cherché : le motif
   * DOIT reconnaître la forme fautive quand on la lui présente.
   */
  it('le motif reconnaît bien la forme interdite', () => {
    const faux = 'const s = StyleSheet.create({ v: { color: colors.qdi.freinage } });';
    expect(/\bcolor:\s*colors\.qdi\.freinage/.test(faux)).toBe(true);
  });

  /**
   * Et la mesure qui FONDE la loi. Sans ce test, la garde ci-dessus
   * interdirait une couleur pour une raison qu'on aurait oubliée.
   */
  it('la loi repose sur une mesure, pas sur un goût', () => {
    for (const fond of [colors.bg.base, colors.bg.card, colors.bg.card2]) {
      expect(contraste(colors.qdi.freinage, fond)).toBeLessThan(SEUIL_TEXTE);
    }
    // Et les quatre autres passent — sinon la loi viserait toute la palette.
    for (const t of [
      colors.qdi.trajectoire,
      colors.qdi.fluidite,
      colors.qdi.acceleration,
      colors.qdi.regularite,
    ]) {
      expect(contraste(t, colors.bg.card2)).toBeGreaterThan(SEUIL_TEXTE);
    }
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
      if (/<QdiRadar\b/.test(sansCommentaires(readFileSync(f, 'utf8')))) {
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
      const code = sansCommentaires(readFileSync(f, 'utf8'));
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
    const radar = sansCommentaires(
      readFileSync(join(RACINE, 'src', 'ui', 'v2', 'RadarQdi.tsx'), 'utf8')
    );
    expect(radar).toContain('Votre signature —');
    expect(radar).not.toContain('Radar QDI —');
  });
});
