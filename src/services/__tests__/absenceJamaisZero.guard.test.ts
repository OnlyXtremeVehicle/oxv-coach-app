/**
 * GARDE — l'anatomie de virage ne fabrique pas de zéro, et l'écran sait le voir.
 *
 * ===========================================================================
 * CE QUE LA LECTURE DU 14/08 A TROUVÉ
 * ===========================================================================
 *
 * `session_insights.anatomy` portait quatre scalaires non nullables. Faute de
 * mesure, le producteur y écrivait `0`. Le pilote lisait alors, en toutes
 * lettres, sur l'écran d'anatomie :
 *
 *     « Freinage sur 0 m avant la corde »
 *     « Vitesse mini à la corde : 0 km/h »
 *
 * C'est la forme exacte du `temperature_celsius: 0` retiré la veille : une
 * absence rendue en zéro. Et l'écran avait pourtant une garde — elle testait
 * `Number.isFinite`, **qui vaut `true` sur zéro**. Une garde posée sur le seul
 * cas qu'elle ne pouvait pas attraper.
 *
 * ===========================================================================
 * POURQUOI LA GARDE TIENT LES DEUX MOITIÉS
 * ===========================================================================
 *
 * Le correctif est double, et l'un sans l'autre ne sert à rien :
 *
 *   • `null` À LA SOURCE — sinon l'écran ne verra jamais d'absence à traiter ;
 *   • `!= null` DANS L'ÉCRAN — sinon les lignes déjà écrites en base, qui
 *     portent encore des zéros, continueront de passer.
 *
 * Et la source qui compte n'est PAS `sessionInsightsEngine.ts` : ce fichier est
 * un miroir testable que rien n'appelle en production. Le seul producteur réel
 * est l'edge function `compute-session-insights`, que `analyzeSessionService`
 * invoque. Une garde qui n'aurait vérifié que le miroir aurait été verte pour
 * un défaut intact — c'est le motif que ce dépôt répète.
 */

import { readFileSync } from 'fs';

import { codeExecutable } from '@/test-utils/codeSeul';
import { join } from 'path';
import ts from 'typescript';

import { computeInsightsBlocks } from '@/services/sessionInsightsEngine';

const RACINE = process.cwd();

/** Les quatre grandeurs qui étaient fabriquées en zéro. */
const SCALAIRES = ['apex_speed_kmh', 'brake_dist_m', 'accel_dist_m', 'g_lat_apex'] as const;

function arbre(chemin: string): { source: ts.SourceFile; texte: string } {
  const texte = readFileSync(join(RACINE, ...chemin.split('/')), 'utf8');
  return {
    texte,
    source: ts.createSourceFile(chemin, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

describe('l’anatomie de virage — l’absence n’est pas un zéro', () => {
  /**
   * LE TYPE, LU DANS L'ARBRE. Une garde textuelle chercherait `number | null`
   * et se ferait avoir par un `//` ou par un autre type du même fichier ; ici
   * on va chercher l'interface par son nom, puis ses membres par le leur.
   */
  it('les quatre scalaires d’`AnatomyCorner` acceptent `null`', () => {
    const { source } = arbre('src/circuit/sessionInsights.ts');
    let trouve: ts.InterfaceDeclaration | null = null;
    source.forEachChild((n) => {
      if (ts.isInterfaceDeclaration(n) && n.name.text === 'AnatomyCorner') trouve = n;
    });
    expect(trouve).not.toBeNull();

    const nullables = (trouve as unknown as ts.InterfaceDeclaration).members
      .filter(ts.isPropertySignature)
      .filter((m) => {
        const t = m.type;
        // En position de TYPE, `null` n'est pas un `NullKeyword` : c'est un
        // `LiteralTypeNode` qui le contient. Chercher le mot-clé directement
        // rend une liste vide — et une garde vide passe au vert sur un type
        // resté non nullable. Vérifié en la faisant échouer.
        return (
          t !== undefined &&
          ts.isUnionTypeNode(t) &&
          t.types.some(
            (u) => ts.isLiteralTypeNode(u) && u.literal.kind === ts.SyntaxKind.NullKeyword
          )
        );
      })
      .map((m) => (ts.isIdentifier(m.name) ? m.name.text : ''));

    expect(SCALAIRES.filter((c) => !nullables.includes(c))).toEqual([]);
  });

  /**
   * LE PRODUCTEUR RÉEL. Pas le miroir : l'edge function que l'app invoque.
   * Aucun des quatre champs n'est suivi d'un zéro de remplissage.
   */
  it('l’edge function `compute-session-insights` n’écrit plus de zéro', () => {
    // LU DANS L'ARBRE, PAS EN TEXTE. Une première version de cette garde
    // cherchait `g_lat_apex…: 0` ; elle est restée verte quand on a remis
    // `Number(…) || 0`. Le zéro a mille orthographes — `: 0`, `?? 0`, `|| 0`,
    // `Number(x) || 0` —, l'initialiseur n'en a qu'une. On va donc chercher
    // l'expression affectée à chaque champ, et on la juge entière.
    const { source } = arbre('supabase/functions/compute-session-insights/index.ts');

    const initialiseurs = new Map<string, string>();
    const visiter = (n: ts.Node): void => {
      if (
        ts.isPropertyAssignment(n) &&
        ts.isIdentifier(n.name) &&
        (SCALAIRES as readonly string[]).includes(n.name.text)
      ) {
        initialiseurs.set(n.name.text, n.initializer.getText(source));
      }
      n.forEachChild(visiter);
    };
    source.forEachChild(visiter);

    // Les quatre champs sont bien produits ici — sinon la garde ne juge rien.
    expect([...initialiseurs.keys()].sort()).toEqual([...SCALAIRES].sort());

    for (const [cle, expr] of initialiseurs) {
      // Le repli qui rendait un zéro est nommé, donc traçable et testable.
      expect({ cle, expr }).toEqual({
        cle,
        expr: expect.stringMatching(/numOrNull|distanceBetweenSpeeds/),
      });
      // Et aucune forme de zéro de remplissage ne subsiste dans l'expression.
      expect({ cle, expr }).not.toEqual({
        cle,
        expr: expect.stringMatching(/(\?\?|\|\|)\s*0\b|:\s*0\b/),
      });
    }
  });

  /**
   * L'ÉCRAN. `Number.isFinite` seul laissait passer le zéro ; la garde
   * d'affichage doit tester la nullité des quatre champs.
   */
  it('`AnatomieViz` teste `!= null`, pas seulement la finitude', () => {
    const { texte } = arbre('src/components/insights/AnatomieViz.tsx');
    const code = codeExecutable(texte);
    for (const cle of SCALAIRES) {
      expect(code).toMatch(new RegExp(`corner\\.${cle} != null`));
    }
    // La garde d'affichage ne repose plus sur la seule finitude.
    expect(code).not.toMatch(/hasScalar[\s\S]{0,240}Number\.isFinite/);
  });

  /**
   * LA PREUVE PAR L'EXÉCUTION. Le miroir est le seul des deux qu'on puisse
   * faire tourner sous jest : sans G de freinage, il ne rend pas de distance.
   */
  it('sans G de freinage, le moteur ne rend pas 0 m — il ne rend rien', () => {
    const { anatomy } = computeInsightsBlocks({
      segments: [
        {
          cornerIndex: 1,
          apexSpeedKmh: null,
          entrySpeedKmh: 120,
          minSpeedKmh: 80,
          exitSpeedKmh: 110,
          maxGLateral: 1.1,
          maxGBraking: 0,
          maxGAccel: 0,
          marginPercent: 50,
        },
      ],
      laps: [],
      frameCount: 10,
    });
    expect(anatomy[0].brake_dist_m).toBeNull();
    expect(anatomy[0].accel_dist_m).toBeNull();
    expect(anatomy[0].apex_speed_kmh).toBeNull();
  });

  /**
   * ET LE CONTRE-EXEMPLE, sans quoi la garde ne prouverait que « tout est
   * null ». Une vraie mesure passe, et elle passe telle quelle.
   */
  it('une vraie mesure traverse intacte', () => {
    const { anatomy } = computeInsightsBlocks({
      segments: [
        {
          cornerIndex: 1,
          apexSpeedKmh: 92.34,
          entrySpeedKmh: 150,
          minSpeedKmh: 85,
          exitSpeedKmh: 130,
          maxGLateral: 1.12,
          maxGBraking: 0.9,
          maxGAccel: 0.6,
          marginPercent: 50,
        },
      ],
      laps: [],
      frameCount: 10,
    });
    expect(anatomy[0].apex_speed_kmh).toBeCloseTo(92.3, 1);
    expect(anatomy[0].brake_dist_m).toBeGreaterThan(0);
  });
});
