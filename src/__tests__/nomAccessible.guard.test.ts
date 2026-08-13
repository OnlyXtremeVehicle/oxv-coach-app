/**
 * GARDE — aucun élément interactif sans nom accessible.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE EXISTE
 * ===========================================================================
 *
 * Le suivi portait « passe a11y — 47 constats » depuis la refonte. Mesuré le
 * 13/08/2026 : **zéro**. Les constats avaient été traités, et le chiffre avait
 * survécu au travail qu'il décrivait.
 *
 * C'est le même motif que partout dans ce dépôt, dans sa version la plus
 * ordinaire : un nombre qu'on relit au lieu de le remesurer. Il a fait porter
 * une dette imaginaire pendant des semaines, et il aurait fini par faire
 * réécrire du code déjà correct.
 *
 * ===========================================================================
 * ET MA PREMIÈRE MESURE ÉTAIT FAUSSE — DANS L'AUTRE SENS
 * ===========================================================================
 *
 * Le premier détecteur coupait la balise ouvrante au premier `>` rencontré,
 * c'est-à-dire à la FLÈCHE de `onPress={() => ...}`. Il rapportait **30
 * défauts, dont aucun n'existait** — et j'ai failli les inscrire au dossier.
 *
 * Trois des sept prétendus défauts « côté pilote » portaient leur
 * `accessibilityRole` et leur `accessibilityLabel` deux lignes plus bas que là
 * où le scanner s'arrêtait.
 *
 * Une mesure fausse est plus dangereuse qu'une absence de mesure : elle produit
 * un verdict. On suit donc la profondeur des accolades, et la balise se ferme au
 * `>` rencontré à profondeur zéro.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE NE COUVRE PAS
 * ===========================================================================
 *
 * Elle ne regarde que les éléments interactifs BRUTS de React Native. Les
 * composants du kit — `PressScale`, `Button`, `Chip` — posent
 * `accessibilityRole = 'button'` par défaut, et c'est vérifié à leur source, pas
 * ici.
 *
 * Elle ne dit rien de la QUALITÉ des libellés, ni des tailles de cible, ni du
 * contraste. Ces trois-là ont leurs propres gardes.
 */

import fs from 'fs';
import path from 'path';

const RACINE = path.join(__dirname, '..', '..', 'app');

const BRUT = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback)\b/g;

/**
 * Fin de la balise OUVRANTE : le `>` rencontré à profondeur d'accolades zéro.
 *
 * C'est toute la correction. `onPress={() => ...}` contient un `>` à
 * profondeur 1 ; s'y arrêter tronque la balise avant ses attributs
 * d'accessibilité, et fait passer un élément correct pour un défaut.
 */
function finDeBalise(src: string, debut: number): number {
  let profondeur = 0;
  for (let i = debut; i < src.length; i++) {
    const c = src[i];
    if (c === '{') profondeur++;
    else if (c === '}') profondeur--;
    else if (c === '>' && profondeur === 0) return i;
  }
  return src.length;
}

function fichiersEcrans(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiersEcrans(p, acc);
    } else if (e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

/** `chemin:ligne` de chaque interactif brut dépourvu de nom accessible. */
function sansNom(): string[] {
  const trouves: string[] = [];
  for (const f of fichiersEcrans(RACINE)) {
    const src = fs.readFileSync(f, 'utf8');
    BRUT.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BRUT.exec(src)) !== null) {
      const balise = src.slice(m.index, finDeBalise(src, m.index) + 1);
      if (balise.includes('accessibilityLabel') || balise.includes('accessibilityRole')) continue;
      const ligne = src.slice(0, m.index).split('\n').length;
      trouves.push(`${path.relative(RACINE, f).split(path.sep).join('/')}:${ligne}`);
    }
  }
  return trouves;
}

describe('nom accessible sur les éléments interactifs bruts', () => {
  /** Un détecteur qui ne trouve rien à examiner passerait tout. */
  it('il y a bien des éléments interactifs bruts à contrôler', () => {
    const total = fichiersEcrans(RACINE)
      .map((f) => (fs.readFileSync(f, 'utf8').match(BRUT) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(50);
  });

  it('aucun n’est dépourvu de libellé ET de rôle', () => {
    expect(sansNom()).toEqual([]);
  });

  /**
   * LE TEST QUI PROTÈGE LE DÉTECTEUR LUI-MÊME.
   *
   * Sur une balise dont les attributs d'accessibilité viennent APRÈS un
   * gestionnaire fléché, l'ancien scanner tronquait et criait au défaut. Ce cas
   * est reproduit ici pour que la régression du 13/08 ne puisse pas revenir.
   */
  it('la flèche d’une fonction ne ferme pas la balise', () => {
    const exemple = `<Pressable
        onPress={() => faire(1)}
        accessibilityRole="button"
        accessibilityLabel="Passer à l’appairage"
      >`;
    const balise = exemple.slice(0, finDeBalise(exemple, 0) + 1);
    expect(balise).toContain('accessibilityLabel');
  });
});
