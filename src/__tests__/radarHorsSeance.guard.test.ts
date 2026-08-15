/**
 * GARDE — pas de radar sur une vue de SÉANCE. Des barres.
 *
 * ===========================================================================
 * CE QUE LE RADAR NE PEUT PAS DIRE
 * ===========================================================================
 *
 * Sur un radar, une branche mesurée à zéro et une branche NON MESURÉE se
 * dessinent au même endroit : au centre. La distinction que ce dépôt tient
 * partout ailleurs — absence ≠ zéro — n'y est pas représentable.
 *
 * Sur des barres ordonnées, elle l'est : une valeur nulle est une barre de
 * longueur nulle, une absence est un « — » ou une hachure. C'est la forme que
 * le banc d'essai recommandait, et elle était déjà en place au bilan avant lui.
 *
 * ===========================================================================
 * OÙ LE RADAR RESTE LÉGITIME
 * ===========================================================================
 *
 * Sur un AGRÉGAT — Signature, Saison — et dans le studio coach, où il compare
 * des profils plutôt que de rendre compte d'une séance. Là, une branche à zéro
 * n'a pas le même statut : elle résume des dizaines de mesures, pas une
 * absence de mesure.
 *
 * ===========================================================================
 * POURQUOI ELLE LIT L'ARBRE
 * ===========================================================================
 *
 * Une garde textuelle sur « QdiRadar » accuserait le commentaire qui explique
 * pourquoi on ne le monte pas — le piège exact qui a produit quatre verdicts
 * faux les 13 et 14/08. Ici on cherche un ÉLÉMENT JSX monté, pas un mot.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import ts from 'typescript';

const RACINE = process.cwd();

/**
 * Les écrans à portée d'UNE séance, côté pilote.
 *
 * Liste explicite plutôt que déduite d'un motif de route : le jour où un
 * écran de séance s'ajoute, on veut que quelqu'un l'inscrive ici en connaissant
 * la règle, pas qu'une heuristique décide à sa place.
 */
const VUES_DE_SEANCE = [
  ['app', '(app2)', 'bilan', '[sessionId].tsx'],
  ['app', '(app2)', 'data', 'session', '[id].tsx'],
];

/** L'écran où le radar EST légitime — sert de témoin au lecteur d'arbre. */
const VUE_AGREGEE = ['app', '(coach)', 'studio.tsx'];

/** Les noms d'éléments JSX réellement montés dans un fichier. */
function elementsMontes(chemin: readonly string[]): Set<string> {
  const abs = join(RACINE, ...chemin);
  const source = ts.createSourceFile(
    abs,
    readFileSync(abs, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const noms = new Set<string>();
  const visiter = (n: ts.Node): void => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const t = n.tagName;
      if (ts.isIdentifier(t)) noms.add(t.text);
      else if (ts.isPropertyAccessExpression(t)) noms.add(t.name.text);
    }
    n.forEachChild(visiter);
  };
  source.forEachChild(visiter);
  return noms;
}

describe('le radar ne rend pas compte d’une séance', () => {
  /**
   * LE TÉMOIN, D'ABORD. Sans lui, la garde pourrait être verte parce que le
   * lecteur d'arbre ne trouve jamais rien — un `QdiRadar` mal reconnu la
   * rendrait muette au lieu de la faire échouer.
   */
  it('le lecteur d’arbre voit bien un radar là où il est monté', () => {
    expect([...elementsMontes(VUE_AGREGEE)]).toContain('QdiRadar');
  });

  it('aucune vue de séance ne monte de radar', () => {
    const fautives = VUES_DE_SEANCE.filter((v) => elementsMontes(v).has('QdiRadar')).map((v) =>
      v.join('/')
    );
    expect(fautives).toEqual([]);
  });

  /**
   * ET ELLES RENDENT BIEN QUELQUE CHOSE. Une vue de séance qui n'afficherait
   * ni radar ni barres satisferait la règle en ne disant rien — ce serait
   * conforme et inutile.
   */
  it('la vue de bilan rend les branches en barres', () => {
    expect([...elementsMontes(VUES_DE_SEANCE[0])]).toContain('PillarBar');
  });

  /** Et la liste ne se vide pas par un renommage silencieux. */
  it('les écrans listés existent tous', () => {
    for (const v of [...VUES_DE_SEANCE, VUE_AGREGEE]) {
      expect({ ecran: v.join('/'), taille: elementsMontes(v).size > 0 }).toEqual({
        ecran: v.join('/'),
        taille: true,
      });
    }
  });
});
