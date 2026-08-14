/**
 * LIRE LE CODE, PAS LE FICHIER — l'outil des gardes qui cherchent un motif.
 *
 * ===========================================================================
 * QUATRE VERDICTS FAUX EN UNE JOURNÉE, TOUS DE LA MÊME FAMILLE
 * ===========================================================================
 *
 * Le 14/08/2026, quatre gardes sur neuf ont accusé du code qui allait bien :
 *
 *   • `loiCouleurTexte` a accusé `bilanLogic`, qui pose `color` sur un marqueur
 *     de TRACÉ — la clé s'appelle `color`, ce qui la consomme est un trait ;
 *   • `vocabulairePilote` a accusé des libellés déjà corrigés, parce que
 *     `tab === 'heatmap'` restait sur la même ligne ;
 *   • `cronMemeFormule` a accusé la fonction serveur de porter encore
 *     `max_g_lateral ?? 0` — parce que l'en-tête CITE le motif pour raconter la
 *     fabrication retirée ;
 *   • et la garde d'orphelins avait déjà, deux jours plus tôt, rendu vingt-trois
 *     faux positifs par une recherche de nom.
 *
 * Chaque fois, le correctif a été de dépouiller un peu plus : les commentaires
 * de ligne, puis ceux de bloc, puis d'extraire la valeur entre guillemets. Ce
 * sont des rustines successives sur une même faute de méthode.
 *
 * ===========================================================================
 * LA FAUTE DE MÉTHODE
 * ===========================================================================
 *
 * Une garde qui porte sur du CODE cherchait des **chaînes dans du texte**. Or
 * un motif interdit est indiscernable, pour une recherche textuelle, selon
 * qu'il vive dans une expression, dans un commentaire, dans un littéral de
 * chaîne ou dans un exemple de test.
 *
 * Ajouter un dépouillement règle le cas du jour et pas le suivant.
 *
 * **Ce module lit l'arbre syntaxique.** Le scanner de TypeScript sépare les
 * commentaires, les littéraux et le reste — il ne peut pas se tromper sur un
 * `//` à l'intérieur d'une chaîne, ni sur une fin de commentaire à l'intérieur
 * d'une expression régulière. Deux cas où une recherche textuelle échoue en
 * silence.
 *
 * ANECDOTE UTILE, ET ELLE EST DE CE FICHIER : la première écriture de cet
 * en-tête CITAIT la séquence de fermeture de commentaire pour illustrer le
 * propos. Elle a fermé le bloc, et le fichier ne compilait plus. Un module sur
 * les gardes qui trébuchent sur leur propre documentation, mis à terre par sa
 * documentation — la démonstration s'est faite toute seule.
 *
 * ===========================================================================
 * POURQUOI L'ENJEU N'EST PAS L'ÉLÉGANCE
 * ===========================================================================
 *
 * Un verdict faux fait DÉFAIRE du travail juste — c'est arrivé quatre fois en
 * un jour. Et une garde qui crie au loup finit désactivée par quelqu'un de
 * pressé, précisément le jour où elle aurait servi.
 */

import * as ts from 'typescript';

/** Les formes de littéral qui portent du texte écrit par l'auteur. */
const LITTERAUX_TEXTE: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

/**
 * Remplace des plages par des espaces plutôt que de les supprimer.
 *
 * Les positions de ligne et de colonne restent VRAIES : une garde qui rapporte
 * « fichier:ligne » désigne alors la bonne ligne du fichier d'origine. Couper
 * décalerait tout ce qui suit, et le rapport enverrait le lecteur ailleurs.
 */
function blanchir(src: string, plages: readonly { debut: number; fin: number }[]): string {
  const out = src.split('');
  for (const { debut, fin } of plages) {
    for (let i = debut; i < fin && i < out.length; i++) {
      if (out[i] !== '\n' && out[i] !== '\r') out[i] = ' ';
    }
  }
  return out.join('');
}

/**
 * Les plages des LITTÉRAUX — par le parseur, pas par le scanner.
 *
 * Le scanner seul ne suffit pas, et c'est mesuré : il n'émet ni les morceaux de
 * gabarit (`TemplateHead` / `Middle` / `Tail`) ni le texte JSX, faute du
 * contexte que seul le parseur possède. Les deux tests correspondants ont
 * échoué sur la première écriture.
 *
 * `ScriptKind.TSX` : ce dépôt est en TSX, et les gardes lisent des `.tsx`.
 */
function plagesLitteraux(source: string): { debut: number; fin: number }[] {
  const sf = ts.createSourceFile(
    'garde.tsx',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    ts.ScriptKind.TSX
  );
  const out: { debut: number; fin: number }[] = [];
  const visiter = (n: ts.Node): void => {
    if (LITTERAUX_TEXTE.has(n.kind)) out.push({ debut: n.getStart(sf), fin: n.end });
    /**
     * LE COMMENTAIRE JSX, QUE LE SCANNER NE VOIT PAS.
     *
     * `{/* … *\/}` est un `JsxExpression` SANS expression : son contenu est de
     * la trivia, et le scanner linéaire ne l'émet pas comme commentaire — il
     * est en mode texte JSX à cet endroit. Mesuré : la première écriture de ce
     * module laissait donc passer ces commentaires, et `intentionJuxtaposee`
     * a immédiatement accusé un écran juste, dont le commentaire ÉNONÇAIT
     * l'interdit qu'il respecte.
     *
     * Le parseur, lui, les nomme. On blanchit le nœud entier.
     */
    if (ts.isJsxExpression(n) && n.expression === undefined) {
      out.push({ debut: n.getStart(sf), fin: n.end });
    }
    ts.forEachChild(n, visiter);
  };
  ts.forEachChild(sf, visiter);
  return out;
}

/**
 * Les plages des COMMENTAIRES — par le scanner, qui les émet en trivia.
 *
 * Le parseur, lui, les rattache aux nœuds : les récupérer par cette voie
 * demanderait de parcourir chaque nœud et d'interroger `getLeadingCommentRanges`,
 * pour un résultat identique et plus fragile.
 */
function plagesCommentaires(source: string): { debut: number; fin: number }[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    /* skipTrivia */ false,
    ts.LanguageVariant.JSX,
    source
  );
  const out: { debut: number; fin: number }[] = [];
  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      out.push({ debut: scanner.getTokenStart(), fin: scanner.getTokenEnd() });
    }
    token = scanner.scan();
  }
  return out;
}

/** Les commentaires JSX seuls — `{/* … *\/}`, invisibles au scanner. */
function plagesCommentairesJsx(source: string): { debut: number; fin: number }[] {
  const sf = ts.createSourceFile(
    'garde.tsx',
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX
  );
  const out: { debut: number; fin: number }[] = [];
  const visiter = (n: ts.Node): void => {
    if (ts.isJsxExpression(n) && n.expression === undefined) {
      out.push({ debut: n.getStart(sf), fin: n.end });
    }
    ts.forEachChild(n, visiter);
  };
  ts.forEachChild(sf, visiter);
  return out;
}

/**
 * Le source privé de ses COMMENTAIRES, positions préservées.
 *
 * À utiliser quand la garde doit encore voir les littéraux — par exemple
 * `.update({ role }).eq('id', userId)`, où `'id'` fait partie de ce qu'on
 * vérifie.
 */
export function codeSansCommentaires(source: string): string {
  return blanchir(source, [...plagesCommentaires(source), ...plagesCommentairesJsx(source)]);
}

/**
 * Le source privé de ses commentaires ET de ses littéraux de texte.
 *
 * À utiliser quand la garde cherche un motif INTERDIT : le motif ne doit alors
 * compter que s'il s'exécute. Une chaîne qui le cite — un message d'erreur, un
 * exemple, un libellé — n'est pas une violation.
 */
export function codeExecutable(source: string): string {
  return blanchir(source, [...plagesCommentaires(source), ...plagesLitteraux(source)]);
}
