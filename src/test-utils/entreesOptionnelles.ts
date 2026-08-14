/**
 * RECENSEMENT DES ENTRÉES OPTIONNELLES QUE PERSONNE NE RENSEIGNE.
 *
 * ===========================================================================
 * POURQUOI CET OUTIL EXISTE
 * ===========================================================================
 *
 * Le 14/08/2026, une quatrième fabrication a été trouvée dans le calcul de la
 * marge. Elle n'avait pas la forme des trois précédentes — pas un `?? 0` posé
 * au moment d'écrire —, elle avait la forme d'un **paramètre** :
 *
 *     export const DEFAULT_VEHICLE: VehicleParameters = { maxGLateral: 1.0 };
 *     const vehicle = input.vehicle ?? DEFAULT_VEHICLE;
 *
 * `input.vehicle` était optionnel. Aucun appelant du dépôt ne le renseignait —
 * et la table `vehicles` ne porte aucune grandeur d'adhérence, donc personne
 * n'aurait pu. Résultat : 40 % du chiffre roi venait d'une constante nommée,
 * typée, documentée, et invisible à toute relecture. Sur Bouteville, 7,7 points
 * de marge sortaient de là.
 *
 * Une garde textuelle ne pouvait pas la voir : il n'y avait aucun motif suspect
 * à chercher. Ce qui la trahissait n'était pas une chaîne, c'était une
 * RELATION — une entrée déclarée, jamais fournie.
 *
 * ===========================================================================
 * CE QUE L'OUTIL MESURE, ET CE QU'IL NE PEUT PAS MESURER
 * ===========================================================================
 *
 * Il lit l'arbre syntaxique de tout `src/`, `app/` et `supabase/functions/`,
 * puis croise deux recensements :
 *
 *   • les entrées OPTIONNELLES des fonctions exportées — paramètres à `?` ou à
 *     valeur par défaut, et propriétés optionnelles des types passés en
 *     paramètre (le contrat d'entrée, pas les props d'un composant) ;
 *   • ce que les appelants fournissent réellement — par NOM pour une propriété
 *     d'objet, par ARITÉ pour un paramètre positionnel.
 *
 * La distinction du second point n'est pas un détail. Une première version
 * comptait tout par nom : elle déclarait morts `forcePilotConsent
 * (administrateurId)` et `setAttendance(pointeurId)`, deux traçabilités
 * pourtant bien passées — en deuxième position, sans jamais écrire leur nom.
 * Dix-huit faux verdicts sur quatre-vingts.
 *
 * Il reste des limites, et les taire vaudrait une garde qui ment :
 *
 *   • les clés sont comptées PAR FONCTION APPELÉE, pas globalement. Une
 *     première version tenait un recensement global : `vehicle` étant écrit
 *     ailleurs comme clé du détail de marge, la fabrication qui a motivé cet
 *     outil restait invisible à l'outil lui-même. Une garde aveugle au défaut
 *     qui l'a fait naître ne vaut rien.
 *   • quand un appelant passe une VARIABLE plutôt qu'un littéral, ou un
 *     `...étalement`, ce rang devient opaque et la fonction n'est pas jugée.
 *     Sous-détecter vaut mieux que rendre un faux verdict — ce dépôt en a
 *     produit quatre en une seule journée.
 *   • une fonction que personne n'appelle n'est pas comptée : c'est du code
 *     mort, un autre problème, et il noierait celui-ci.
 *   • les composants React sont écartés (nom capitalisé, types en `…Props`) :
 *     une prop optionnelle inemployée est un choix d'API, pas une fabrication.
 *   • rien ici ne dit si le repli est ANODIN (un pas de calcul, une limite de
 *     page) ou GRAVE (une grandeur physique présentée au pilote). Ce jugement
 *     appartient au lecteur. L'outil pose la question ; il n'y répond pas.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, sep } from 'path';
import ts from 'typescript';

export interface EntreeOptionnelle {
  /** `parametre` (positionnel) ou `propriete` (nommée dans un objet d'entrée). */
  genre: 'parametre' | 'propriete';
  /** Signature lisible : `computeMargin(ComputeMarginInput.vehicle?)`. */
  signature: string;
  /** Chemin relatif à la racine du dépôt, en séparateurs POSIX. */
  fichier: string;
}

const RACINE = process.cwd();

function fichiersTs(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const p = join(dossier, e.name);
    if (e.isDirectory()) {
      if (!/node_modules/.test(e.name) && !e.name.startsWith('.')) fichiersTs(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const estTest = (f: string): boolean => /__tests__|\.test\.|test-utils/.test(f);

function membresDe(
  d: ts.InterfaceDeclaration | ts.TypeAliasDeclaration
): readonly ts.TypeElement[] {
  if (ts.isInterfaceDeclaration(d)) return d.members;
  return d.type && ts.isTypeLiteralNode(d.type) ? d.type.members : [];
}

/** Le recensement complet, trié. Coûteux (tout le dépôt est parsé) : appeler une fois. */
export function entreesOptionnellesJamaisRenseignees(): EntreeOptionnelle[] {
  const racines = ['src', 'app', join('supabase', 'functions')]
    .map((d) => join(RACINE, d))
    .flatMap((d) => fichiersTs(d));

  const sources = new Map<string, ts.SourceFile>();
  for (const f of racines) {
    sources.set(
      f,
      ts.createSourceFile(
        f,
        readFileSync(f, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )
    );
  }

  // 1. L'arité maximale observée pour chaque nom appelé.
  const ariteMax = new Map<string, number>();
  /** Clés fournies par les appelants, PAR FONCTION et par rang d'argument. */
  const clesFournies = new Map<string, Set<string>>();
  /** Rangs où un appelant passe autre chose qu'un littéral : on ne juge pas. */
  const rangsOpaques = new Set<string>();
  /** Fonctions effectivement appelées quelque part. */
  const appelees = new Set<string>();

  for (const [f, s] of sources) {
    // LES TESTS NE COMPTENT PAS COMME APPELANTS. C'est la moitié du défaut
    // qu'on cherche : `computeMargin(vehicle)` était exercé par sa propre
    // batterie de tests et par rien d'autre. Compter les tests parmi les
    // appelants aurait rendu la fabrication invisible à l'outil écrit pour
    // elle — une garde verte sur son propre cas d'origine.
    if (estTest(f)) continue;
    const visiter = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const nom = ts.isIdentifier(n.expression)
          ? n.expression.text
          : ts.isPropertyAccessExpression(n.expression)
            ? n.expression.name.text
            : null;
        if (nom !== null) {
          appelees.add(nom);
          ariteMax.set(nom, Math.max(ariteMax.get(nom) ?? 0, n.arguments.length));
          n.arguments.forEach((arg, rang) => {
            const cle = `${nom}#${rang}`;
            if (ts.isObjectLiteralExpression(arg)) {
              const vues = clesFournies.get(cle) ?? new Set<string>();
              for (const p of arg.properties) {
                if (
                  (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) &&
                  (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))
                ) {
                  vues.add(p.name.text);
                }
                // Un `...étalement` peut apporter n'importe quelle clé.
                if (ts.isSpreadAssignment(p)) rangsOpaques.add(cle);
              }
              clesFournies.set(cle, vues);
            } else {
              // Une variable passée en argument peut porter la clé : on
              // s'interdit d'accuser. Sous-détecter vaut mieux que mentir.
              rangsOpaques.add(cle);
            }
          });
        }
      }
      n.forEachChild(visiter);
    };
    s.forEachChild(visiter);
  }

  // 3. Les déclarations de types, par nom.
  const types = new Map<string, ts.InterfaceDeclaration | ts.TypeAliasDeclaration>();
  for (const s of sources.values()) {
    const visiter = (n: ts.Node): void => {
      if (ts.isInterfaceDeclaration(n)) types.set(n.name.text, n);
      if (ts.isTypeAliasDeclaration(n) && n.type && ts.isTypeLiteralNode(n.type))
        types.set(n.name.text, n);
      n.forEachChild(visiter);
    };
    s.forEachChild(visiter);
  }

  const morts: EntreeOptionnelle[] = [];
  const vus = new Set<string>();

  for (const [f, s] of sources) {
    if (estTest(f)) continue;
    const relatif = f.replace(RACINE, '').split(sep).join('/');

    const retenir = (e: EntreeOptionnelle): void => {
      const cle = `${e.fichier}::${e.signature}`;
      if (vus.has(cle)) return;
      vus.add(cle);
      morts.push(e);
    };

    const visiter = (n: ts.Node): void => {
      let fn: { nom: string; decl: ts.SignatureDeclarationBase } | null = null;

      if (ts.isFunctionDeclaration(n) && n.name !== undefined) {
        if ((ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0)
          fn = { nom: n.name.text, decl: n };
      }
      if (
        ts.isVariableDeclaration(n) &&
        n.initializer !== undefined &&
        (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)) &&
        ts.isIdentifier(n.name) &&
        (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) !== 0
      ) {
        fn = { nom: n.name.text, decl: n.initializer };
      }

      // Un composant React n'est pas un contrat de calcul : une prop optionnelle
      // inemployée y est un choix d'API, pas une grandeur fabriquée.
      if (fn !== null && !/^[A-Z]/.test(fn.nom)) {
        const params = fn.decl.parameters;
        params.forEach((p, rang) => {
          if (
            (p.questionToken !== undefined || p.initializer !== undefined) &&
            ts.isIdentifier(p.name)
          ) {
            // Positionnel : c'est l'ARITÉ des appels qui dit s'il est fourni.
            // Une fonction que PERSONNE n'appelle est un autre problème (du
            // code mort) : on ne la compte pas ici, sans quoi l'inventaire
            // parlerait surtout d'elle.
            if (appelees.has(fn!.nom) && (ariteMax.get(fn!.nom) ?? 0) <= rang) {
              retenir({
                genre: 'parametre',
                signature: `${fn!.nom}(${p.name.text}?)`,
                fichier: relatif,
              });
            }
          }
          const t = p.type;
          if (t !== undefined && ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName)) {
            const nomType = t.typeName.text;
            const d = types.get(nomType);
            const cleRang = `${fn!.nom}#${rang}`;
            // Jamais appelée, ou appelée avec autre chose qu'un littéral : on
            // ne peut rien affirmer. Le silence vaut mieux qu'un faux verdict.
            const jugeable = appelees.has(fn!.nom) && !rangsOpaques.has(cleRang);
            if (d !== undefined && !/Props$/.test(nomType) && jugeable) {
              const fournies = clesFournies.get(cleRang) ?? new Set<string>();
              for (const m of membresDe(d)) {
                if (ts.isPropertySignature(m) && m.questionToken && ts.isIdentifier(m.name)) {
                  if (!fournies.has(m.name.text)) {
                    retenir({
                      genre: 'propriete',
                      signature: `${fn!.nom}(${nomType}.${m.name.text}?)`,
                      fichier: relatif,
                    });
                  }
                }
              }
            }
          }
        });
      }
      n.forEachChild(visiter);
    };
    s.forEachChild(visiter);
  }

  return morts.sort((a, b) =>
    `${a.fichier}::${a.signature}`.localeCompare(`${b.fichier}::${b.signature}`)
  );
}
