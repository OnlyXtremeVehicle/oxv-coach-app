/**
 * GARDE — le plancher de contraste des huit écrans du flux REC.
 *
 * ===========================================================================
 * POURQUOI CES HUIT ÉCRANS SONT À PART
 * ===========================================================================
 *
 * Le plan de montage V3 pose, pour le jalon 3 : *« en plein soleil, la
 * luminance affichée doit dépasser la lumière réfléchie d'un facteur 2,5
 * minimum. **Le contraste AAA à 7:1 devient un plancher** sur ces huit
 * écrans. »* Et le lot 21a ajoute : *« le tertiaire est interdit. »*
 *
 * Ailleurs dans l'application, le canon est plus souple — `contrastTokens.test.ts`
 * ratifie `low ≥ 4,5` et `dim ≥ 3,0`. Ces deux seuils sont **sous** le plancher
 * du jalon. Une garde de jetons ne pouvait donc pas voir le défaut : il fallait
 * une garde de PÉRIMÈTRE.
 *
 * ===========================================================================
 * CE QUI ÉTAIT MESURÉ AVANT
 * ===========================================================================
 *
 * Relevé le 05/08/2026, sur les trois fonds du kit :
 *
 *   hi     15,03 / 13,87 / 12,44   passe partout
 *   mid     8,14 /  7,52 /  7,03   passe sur les TROIS depuis le 13/08
 *   low     6,10 /  5,64 /  5,05   ÉCHOUE partout
 *   dim     4,38 /  4,05 /  3,63   ÉCHOUE partout, et sous 4,5 sur deux fonds
 *   accent  3,10 /  2,86 /  2,57   ÉCHOUE de très loin
 *
 * Les huit écrans portaient 15 `low`, 8 `dim` et 7 usages de l'accent comme
 * couleur de texte. Et le pire, `placement.tsx` : « Maintenez pour armer », en
 * `hi` à 70 % d'opacité sur le rouge de marque — **2,90**. La consigne qui
 * explique comment armer la capture était le texte le moins lisible du flux.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE NE PEUT PAS PROUVER
 * ===========================================================================
 *
 * Elle est LEXICALE. Elle interdit les jetons dont on a mesuré qu'ils échouent,
 * sur les fichiers du flux. Elle ne calcule aucun contraste et ne monte aucun
 * écran : une couleur écrite en dur, ou un fond inattendu, lui échappent.
 *
 * **Deux écarts subsistent, connus et écrits, qu'elle ne couvre pas :**
 *
 *   1. ~~`mid` sur `bg.card2` mesure 6,74~~ — **RÉGLÉ le 13/08/2026.** Le fond a
 *      été assombri de `#232630` à `#202329` (7,03), plutôt que de relever le
 *      gris : `mid` est employé partout, `card2` à trois endroits. Ce qui suit
 *      décrivait le défaut, et reste pour mémoire du raisonnement — quatre
 *      centièmes sous le
 *      plancher. C'est un défaut de JETON, pas d'écran : le corriger demande de
 *      relever `mid`, ce qui le rapproche de `hi` et écrase un palier de la
 *      hiérarchie. Arbitrage fondateur.
 *   2. Sur le rouge de marque `#C8102E`, **aucune couleur de texte n'atteint
 *      7:1**. Le blanc pur plafonne à 5,88. Trois libellés sont dans ce cas.
 *      Il faudrait changer le rouge, ou passer ces boutons en bord seul.
 *
 * Le facteur 2,5 entre luminance affichée et lumière réfléchie, lui, ne se
 * calcule pas ici : il demande un luxmètre et du soleil. Le 7:1 est une
 * condition nécessaire vérifiable au banc, jamais la preuve d'acceptation.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Le dépôt place ses gardes dans `src/__tests__/` ; les écrans gardés vivent
// dans `app/(app2)/rec/`. Deux niveaux au-dessus, puis le chemin du flux.
const FLUX = join(__dirname, '..', '..', 'app', '(app2)', 'rec');

/** Les huit écrans, plus l'aiguilleur et le consentement hors des huit. */
function ecransDuFlux(): string[] {
  return readdirSync(FLUX)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(FLUX, f));
}

const nom = (p: string): string => p.slice(p.lastIndexOf('\\') + 1).replace(/.*\//, '');

describe('plancher de contraste — les écrans du flux REC', () => {
  const ecrans = ecransDuFlux();

  it('il y a bien des écrans à contrôler', () => {
    // Sans ce contrôle, un déplacement de dossier ferait passer toute la garde
    // au vert en ne trouvant plus rien à examiner.
    expect(ecrans.length).toBeGreaterThanOrEqual(8);
  });

  it('aucun `text.low` — il plafonne à 6,10 et n’atteint jamais 7:1', () => {
    const fautifs = ecrans
      .filter((p) => readFileSync(p, 'utf8').includes('colors.text.low'))
      .map(nom);
    expect(fautifs).toEqual([]);
  });

  it('aucun `text.dim` — le tertiaire est interdit sur ces écrans', () => {
    const fautifs = ecrans
      .filter((p) => readFileSync(p, 'utf8').includes('colors.text.dim'))
      .map(nom);
    expect(fautifs).toEqual([]);
  });

  it('l’accent ne sert jamais de couleur de TEXTE — il plafonne à 3,10', () => {
    // Il reste légitime en FOND (bouton, pastille) : c'est `color:` qui est
    // interdit, pas `backgroundColor:`.
    const fautifs = ecrans
      .filter((p) => /color:\s*colors\.accent\b/.test(readFileSync(p, 'utf8')))
      .map(nom);
    expect(fautifs).toEqual([]);
  });

  /**
   * L'opacité casse le contraste sans changer de jeton — une correction qui ne
   * regarderait que les couleurs la manquerait entièrement. C'est exactement ce
   * qui s'est passé pour « Maintenez pour armer ».
   *
   * Les états INERTES gardent le droit d'être atténués : WCAG dispense les
   * contrôles désactivés, et un bouton grisé doit se voir grisé.
   */
  it('aucune opacité basse sur un style de texte ACTIF', () => {
    const fautifs: string[] = [];
    for (const p of ecrans) {
      const source = readFileSync(p, 'utf8');
      const lignes = source.split('\n');
      for (let i = 0; i < lignes.length; i++) {
        const m = /opacity:\s*(0\.[0-7])\b/.exec(lignes[i]);
        if (!m) continue;
        // Le nom de la clé de style, quelques lignes plus haut.
        const contexte = lignes.slice(Math.max(0, i - 12), i + 1).join('\n');
        const inerte =
          /(Inerte|Disabled|Pressed|Loading|Dim|ghost|scrim|glow|halo|pulse|ring)/i.test(contexte);
        const texte = /fontFamily|fontSize|letterSpacing/.test(contexte);
        if (texte && !inerte) fautifs.push(`${nom(p)}:${i + 1}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it('la garde reconnaît ce qu’elle prétend reconnaître', () => {
    // Contre le faux vert : si les motifs cessaient de correspondre, les tests
    // ci-dessus passeraient en ne trouvant plus rien.
    expect(/color:\s*colors\.accent\b/.test('  color: colors.accent,')).toBe(true);
    expect(/color:\s*colors\.accent\b/.test('  backgroundColor: colors.accent,')).toBe(false);
    expect(/opacity:\s*(0\.[0-7])\b/.test('    opacity: 0.7,')).toBe(true);
    expect(/opacity:\s*(0\.[0-7])\b/.test('    opacity: 0.9,')).toBe(false);
  });
});
