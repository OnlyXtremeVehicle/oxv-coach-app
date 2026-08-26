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
 *
 * ===========================================================================
 * LOT 9b — LA CHARTE ANTI-JARGON DU CATALOGUE D'EXPÉRIENCE
 * ===========================================================================
 *
 * Le catalogue du 25/08/2026 porte deux tables normatives. Elles ne vivent pas
 * au même endroit, et c'est délibéré :
 *
 *   • Le § 07 (« VOCABULAIRE OBLIGATOIRE ») dit une VÉRITÉ DE CANAL — le
 *     Mini S ne mesure ni la pédale ni l'angle du volant. Cette règle ne
 *     dépend pas du lecteur : elle est dans `scripts/doctrineRegles.ts`, avec
 *     les termes anglais du § 02, et s'applique au coach comme au pilote.
 *
 *   • Le § 02 (« Charte anti-jargon ») dit un NIVEAU DE LECTURE. Or le § 01
 *     autorise explicitement la densité au niveau 3 — « Lab : traces, méthode,
 *     références et données brutes ; densité autorisée pour coach/analyste ».
 *     « Apex », « jerk », « delta » restent donc le mot juste là-bas. Ils sont
 *     proscrits ICI, dans les surfaces de niveau 1 et 2 que le pilote lit en
 *     dix à quatre-vingt-dix secondes.
 *
 * Le tutoiement des exemples du catalogue (« ton placement », « tu freines »)
 * n'est pas le ton OXV : les remplacements retenus ci-dessous vouvoient.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

/**
 * Retire commentaires — SANS déplacer les lignes.
 *
 * Première écriture : `replace(/\/\*[\s\S]*?\*\//g, ' ')`, qui écrasait un
 * commentaire de trente lignes en une espace. Tant que le relevé était vide,
 * personne ne l'a vu ; le jour où il accuse, il désigne une ligne qui n'est
 * pas la bonne. On remplace donc chaque commentaire par ses propres sauts de
 * ligne : même texte retiré, même numérotation.
 */
function sansCommentaires(src: string): string {
  return (
    src
      .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, ' '))
      // `^\s*` mangeait les sauts de ligne des lignes PRÉCÉDENTES — `\s`
      // contient `\n`. Vingt lignes disparaissaient ainsi d'un fichier de trois
      // cents. `[^\S\n]*` est la même chose, sans le saut de ligne.
      .replace(/^[^\S\n]*\/\/.*$/gm, ' ')
  );
}

function fichiers(chemin: string, acc: string[] = []): string[] {
  if (statSync(chemin).isFile()) {
    if (chemin.endsWith('.ts') || chemin.endsWith('.tsx')) acc.push(chemin);
    return acc;
  }
  for (const e of readdirSync(chemin, { withFileTypes: true })) {
    const p = join(chemin, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * OÙ LE PILOTE LIT.
 *
 * `app/(app2)` : ses écrans. Et un fichier de plus, nommé un par un comme le
 * fait déjà le registre des notifications — `bilanPdfExportService`, le PDF
 * que le pilote ouvre depuis `app/(app2)/bilan/[sessionId].tsx`. C'est de la
 * copie lue par un humain, écrite en `.ts` hors de `app/`, donc hors d'atteinte
 * du scanner doctrinal (qui ne lit que les `.tsx`) comme de cette garde.
 *
 * Ce qui n'y est PAS, et pourquoi : `src/components/insights` — le catalogue
 * des lectures N2 à N4 et leurs vues. C'est le Lab du § 01, densité autorisée.
 */
const PERIMETRE = [
  join(RACINE, 'app', '(app2)'),
  join(RACINE, 'src', 'services', 'bilanPdfExportService.ts'),
];

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

/**
 * Les nœuds de TEXTE — `<Text>Apex</Text>`, `<th>Apex</th>`.
 *
 * La première version ne lisait que les propriétés d'affichage. Elle passait à
 * côté de tout ce qui est écrit entre deux balises, c'est-à-dire de la moitié
 * de ce que le pilote lit, et de la totalité de la copie du PDF de bilan, qui
 * est un gabarit HTML. `[^<>{}]` écarte les interpolations : `>{apex} km/h<`
 * n'est pas du texte, c'est une valeur mesurée qu'on affiche.
 */
const TEXTE_BALISE = />([^<>{}]{2,})</g;

/**
 * Une interpolation n'est pas du texte lu.
 *
 * `label={\`Vitesse mini à la corde : ${apex} km/h\`}` est une phrase JUSTE :
 * `apex` y est le nom d'une variable, pas un mot affiché. Sans ce retrait, la
 * garde condamnait des libellés déjà conformes — le défaut exact qu'elle a
 * déjà corrigé une fois pour les chips.
 */
function sansInterpolation(valeur: string): string {
  return valeur.replace(/\$\{[^}]*\}/g, ' ');
}

/** Les valeurs affichées d'une ligne, ou `[]`. */
function valeursAffichees(ligne: string): string[] {
  const out: string[] = [];
  VALEURS.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VALEURS.exec(ligne)) !== null) {
    out.push(sansInterpolation(m[1] ?? m[2] ?? m[3] ?? ''));
  }
  TEXTE_BALISE.lastIndex = 0;
  let t: RegExpExecArray | null;
  while ((t = TEXTE_BALISE.exec(ligne)) !== null) {
    const texte = t[1];
    if (/[A-Za-zÀ-ÿ]{2,}/.test(texte)) out.push(texte);
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
  // Charte anti-jargon, § 02 du catalogue d'expérience (25/08/2026). Ces
  // trois-là sont français ou francisés, et légitimes au niveau 3 : ils ne
  // sont proscrits QUE dans le périmètre ci-dessus.
  //
  // Précaution du catalogue conservée telle quelle : « la vitesse mini n'est
  // pas toujours l'apex ». D'où « point lent » plutôt qu'un synonyme qui
  // promettrait la géométrie.
  { mot: /\bapex\b/i, remplace: 'point lent (ou point le plus intérieur)' },
  { mot: /\bjerk\b/i, remplace: 'transition plus ou moins brusque' },
  { mot: /\bdelta\s+(?:de\s+)?temps\b/i, remplace: 'l’endroit où le temps change' },
];

interface Trouvaille {
  fichier: string;
  ligne: number;
  mot: string;
  texte: string;
}

function jargonPilote(): Trouvaille[] {
  const out: Trouvaille[] = [];
  for (const f of PERIMETRE.flatMap((c) => fichiers(c))) {
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
   * Idem pour les trois termes du § 02 ajoutés au lot 9b — dont la seule forme
   * réellement trouvée dans le dépôt le 26/08 : l'en-tête « Apex » du tableau
   * virage par virage du PDF de bilan, corrigé en « Point lent ».
   */
  it('le relevé reconnaît le jargon du § 02, y compris hors JSX', () => {
    const avant = [
      '        <th>Apex</th>',
      '<Text style={s.label}>Jerk résiduel</Text>',
      '<SectionHeader eyebrow="DELTA TEMPS" />',
      'accessibilityLabel="Vitesse d\'apex du virage 3"',
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
   * UNE VALEUR MESURÉE N'EST PAS UN MOT.
   *
   * `${apex}` interpolé dans une phrase juste — « Vitesse mini à la corde :
   * 87 km/h » — est le NOM D'UNE VARIABLE. La première écriture de la garde
   * lisait le gabarit brut et accusait ce libellé, qui est déjà conforme.
   */
  it('une interpolation n’est pas du texte lu', () => {
    const juste = '<Metric label={`Vitesse mini à la corde : ${apex} km/h`} />';
    const valeurs = valeursAffichees(juste);
    expect(valeurs).toEqual(['Vitesse mini à la corde :   km/h']);
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
