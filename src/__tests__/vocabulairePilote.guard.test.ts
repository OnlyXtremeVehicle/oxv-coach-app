/**
 * GARDE — l'espace pilote ne parle pas en jargon, ni en anglais.
 *
 * ===========================================================================
 * LE DERNIER VERROU DU JALON 5
 * ===========================================================================
 *
 * La ligne du plan s'appelle *« QDI et vocabulaire technique »*. Elle porte
 * deux sujets, pas un : le QDI a été traité le 13/08 — cinq branches, homonyme
 * corrigé, sélecteur de paire câblé. **Le vocabulaire n'avait jamais été
 * touché.**
 *
 * Mesuré le 14/08 dans `app/(app2)` : quatre onglets en dur — « G-G »,
 * « Canaux », **« Heatmap »**, **« Replay »** — dont deux en anglais ; deux
 * sur-titres « TÉLÉMÉTRIE » et « DELTA » ; « G latéral maxi » ; « G
 * longitudinal » jusque dans les étiquettes lues à voix haute ; et trois
 * « télémétrie » en clair, dont un dans les réglages.
 *
 * ===========================================================================
 * CE QUE LA GARDE REGARDE, ET CE QU'ELLE LAISSE
 * ===========================================================================
 *
 * Elle ne cherche PAS ces mots dans le code : `delta`, `gg`, `heatmap` sont
 * des noms de variables parfaitement légitimes, et les clés de `niveaux.ts`
 * restent techniques parce qu'elles ne sont jamais affichées.
 *
 * Elle regarde ce qui ARRIVE À L'ÉCRAN : les propriétés d'affichage — `label`,
 * `title`, `eyebrow`, `emptyMessage`, `placeholder`, `caption` — et les
 * étiquettes d'accessibilité, où le jargon est plus tenace parce qu'il ne se
 * voit pas.
 *
 * Et seulement dans `app/(app2)`, l'espace du pilote. Le coach et
 * l'administrateur sont des métiers : « télémétrie » y est le mot juste.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

/** Les propriétés dont la valeur atteint l'utilisateur. */
const PROPS_AFFICHEES =
  /\b(label|title|eyebrow|emptyMessage|errorMessage|accessibilityLabel|accessibilityHint|placeholder|caption|text1|text2)\s*=/;

/**
 * LA VALEUR SEULE, PAS LA LIGNE.
 *
 * Première écriture : chercher le mot n'importe où sur une ligne portant une
 * propriété d'affichage. Elle a accusé les chips CORRIGÉS —
 * `<Chip label="Sur le tracé" active={tab === 'heatmap'} />` — parce que le
 * nom de l'onglet reste `heatmap` dans le code, et doit le rester.
 *
 * Une garde qui condamne sa propre correction est pire qu'aucune garde : on
 * n'extrait donc que ce qui est ENTRE GUILLEMETS après la propriété.
 */
const VALEURS = new RegExp(
  `\\b(?:label|title|eyebrow|emptyMessage|errorMessage|accessibilityLabel|accessibilityHint|placeholder|caption|text1|text2)\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\`([^\`]*)\`\\})`,
  'g'
);

/** Les valeurs affichées d'une ligne, ou `[]`. */
function valeursAffichees(ligne: string): string[] {
  const out: string[] = [];
  VALEURS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VALEURS.exec(ligne)) !== null) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return out;
}

/**
 * Les mots proscrits face au pilote, et ce qu'ils sont devenus.
 *
 * « Delta » n'y figure pas seul : il est courant en français et le sur-titre
 * corrigé disait « DELTA » en capitales, forme qu'on vise précisément.
 */
const PROSCRITS: readonly { mot: RegExp; remplace: string }[] = [
  { mot: /\bHeatmap\b/i, remplace: 'Sur le tracé' },
  { mot: /\bReplay\b/i, remplace: 'Rejouer' },
  { mot: /\bG-G\b/, remplace: 'Appuis' },
  { mot: /\bQDI\b/, remplace: 'votre signature' },
  { mot: /télémétrie/i, remplace: 'les mesures' },
  { mot: /\bG (latéral|longitudinal)\b/i, remplace: 'appui / freinage' },
  { mot: /\bDELTA\b/, remplace: 'L’ÉCART' },
  { mot: /\boutlap\b/i, remplace: 'tour de sortie' },
];

interface Trouvaille {
  fichier: string;
  ligne: number;
  mot: string;
  texte: string;
}

function jargonPilote(): Trouvaille[] {
  const out: Trouvaille[] = [];
  for (const f of fichiers(join(RACINE, 'app', '(app2)'))) {
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    code.split('\n').forEach((ligne, i) => {
      for (const valeur of valeursAffichees(ligne)) {
        for (const { mot } of PROSCRITS) {
          if (mot.test(valeur)) {
            out.push({
              fichier: f.replace(RACINE, '').split(/[\\/]/).join('/'),
              ligne: i + 1,
              mot: String(mot),
              texte: valeur.slice(0, 120),
            });
          }
        }
      }
    });
  }
  return out;
}

describe('vocabulaire de l’espace pilote', () => {
  it('aucun mot technique ni anglais dans ce que le pilote lit', () => {
    expect(jargonPilote()).toEqual([]);
  });

  /**
   * La garde ne doit pas être verte pour n'avoir rien cherché. Elle DOIT
   * reconnaître la forme fautive telle qu'elle existait avant la correction.
   */
  it('le relevé fonctionne — il reconnaît les formes d’avant', () => {
    const avant = [
      '<Chip label="Heatmap" active={tab === \'heatmap\'} />',
      '<Chip label="Replay" active={tab === \'replay\'} />',
      '<SectionHeader eyebrow="TÉLÉMÉTRIE" />',
      'accessibilityLabel="Canaux : vitesse, et G longitudinal"',
    ];
    for (const ligne of avant) {
      const valeurs = valeursAffichees(ligne);
      expect(valeurs.length).toBeGreaterThan(0);
      expect(valeurs.some((v) => PROSCRITS.some((p) => p.mot.test(v)))).toBe(true);
    }
  });

  /**
   * ET LE CAS QUI A FAIT REPRENDRE LA MESURE.
   *
   * Le chip CORRIGÉ garde `'heatmap'` comme nom d'onglet dans le code — c'est
   * normal et souhaitable. Une garde qui condamnerait sa propre correction
   * ferait défaire un travail juste.
   */
  it('un libellé corrigé n’est pas accusé par le code qui l’entoure', () => {
    const corrige = `<Chip label="Sur le tracé" active={tab === 'heatmap'} onPress={() => setTab('heatmap')} />`;
    const valeurs = valeursAffichees(corrige);
    expect(valeurs).toEqual(['Sur le tracé']);
    expect(valeurs.some((v) => PROSCRITS.some((p) => p.mot.test(v)))).toBe(false);
  });

  /**
   * Et ce que la garde ne doit PAS attraper : le code qui nomme ses variables
   * en termes techniques, ce qui est légitime et souhaitable.
   */
  it('elle ne touche pas au code, seulement à ce qui s’affiche', () => {
    const codeOrdinaire = [
      "const [tab, setTab] = useState<'gg' | 'canaux' | 'heatmap'>('gg');",
      'const deltaCumule = computeDelta(laps);',
      "cle: 'enveloppe',",
    ];
    for (const ligne of codeOrdinaire) {
      expect(PROPS_AFFICHEES.test(ligne)).toBe(false);
    }
  });
});
