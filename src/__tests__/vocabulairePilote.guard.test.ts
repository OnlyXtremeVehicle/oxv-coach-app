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
 *
 * ===========================================================================
 * LOT 10b — L'ARBITRAGE DU FONDATEUR SUR `src/components/insights`
 * ===========================================================================
 *
 * Le lot 9b avait EXCLU `src/components/insights` du périmètre, au motif que
 * ces lectures N2–N4 seraient « le Lab du § 01, densité autorisée ». Le relevé
 * du même lot listait pourtant dix chaînes fautives à l'intérieur, sans les
 * corriger, et laissait la question ouverte.
 *
 * La mesure tranche : **ces vues n'ont pas d'autre point de montage que
 * `app/(app2)/data/session/[id].tsx`** — l'onglet Data DU PILOTE. Aucune
 * console coach ne les rend. Un « Lab » qui n'est lu que par le pilote est une
 * surface pilote. Le fondateur a tranché le 26/08 : elles entrent au périmètre.
 *
 * CE QUI RESTE TECHNIQUE, ET POURQUOI. Le champ `source` du catalogue n'est ni
 * un titre ni une étiquette : c'est la MÉTHODE — d'où vient le chiffre, par
 * quel capteur, avec quelle convention. Le § 01 autorise la densité quand le
 * lecteur est allé la chercher, et nommer un instrument n'est pas afficher un
 * verdict. `source` est donc volontairement HORS de la liste des propriétés
 * lues ci-dessous : « G longitudinal et latéral » y reste le mot juste.
 *
 * Entre aussi `src/services/pilotSignatureService.ts`, dont les libellés
 * d'axes et de détail sont de la copie pure rendue par `RadarEmpreinte`. Cette
 * vue n'a aucun appelant de production aujourd'hui — raison pour laquelle le
 * lot 9b n'avait pas touché ses deux chaînes fautives. Une chaîne fautive qui
 * dort est une chaîne fautive qui se réveillera : elle est gardée quand même.
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
 * `app/(app2)` : ses écrans. Et trois entrées de plus, nommées une par une
 * comme le fait déjà le registre des notifications :
 *
 *   • `bilanPdfExportService` — le PDF que le pilote ouvre depuis
 *     `app/(app2)/bilan/[sessionId].tsx`. C'est de la copie lue par un humain,
 *     écrite en `.ts` hors de `app/`, donc hors d'atteinte du scanner
 *     doctrinal (qui ne lit que les `.tsx`) comme de cette garde.
 *
 *   • `src/components/insights` — les six lectures et leurs vues, montées dans
 *     l'onglet Data du pilote et nulle part ailleurs (lot 10b, ci-dessus).
 *
 *   • `src/services/pilotSignatureService` — les cinq axes de l'empreinte,
 *     dont les libellés et les détails sont rendus tels quels par
 *     `RadarEmpreinte`.
 */
const PERIMETRE = [
  join(RACINE, 'app', '(app2)'),
  join(RACINE, 'src', 'services', 'bilanPdfExportService.ts'),
  join(RACINE, 'src', 'components', 'insights'),
  join(RACINE, 'src', 'services', 'pilotSignatureService.ts'),
];

/**
 * Les propriétés dont la valeur atteint l'utilisateur.
 *
 * `[=:]` et non `=` seul : hors JSX, la copie vit dans des objets — les six
 * lectures du catalogue (`name:`, `eyebrow:`) et les cinq axes de l'empreinte
 * (`label:`, `detail:`) sont des littéraux de propriété, jamais des attributs.
 *
 * `source` n'y est PAS : c'est la méthode, pas une étiquette (voir l'en-tête).
 */
const PROPS_AFFICHEES =
  /\b(label|sublabel|title|name|court|eyebrow|emptyMessage|errorMessage|accessibilityLabel|accessibilityHint|placeholder|caption|detail|text1|text2)\s*[=:]/;

const PROP_LISTE =
  'label|sublabel|title|name|court|eyebrow|emptyMessage|errorMessage|accessibilityLabel|accessibilityHint|placeholder|caption|detail|text1|text2';

const DEBUT_PROP = new RegExp(`\\b(?:${PROP_LISTE})\\s*[=:]\\s*`, 'g');

/** Un littéral, quel que soit son guillemet. */
const LITTERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

/**
 * Les nœuds de TEXTE — `<Text>Apex</Text>`, `<th>Apex</th>`.
 *
 * La première version ne lisait que les propriétés d'affichage. Elle passait à
 * côté de tout ce qui est écrit entre deux balises, c'est-à-dire de la moitié
 * de ce que le pilote lit, et de la totalité de la copie du PDF de bilan, qui
 * est un gabarit HTML. `[^<>{}]` écarte les interpolations : `>{apex} km/h<`
 * n'est pas du texte, c'est une valeur mesurée qu'on affiche.
 *
 * Lot 10b : la lecture se fait désormais sur le FICHIER, plus ligne à ligne.
 * Une phrase de deux lignes — l'état vide de `FlowViz`, « le jerk se calcule
 * sur les trames de télémétrie » — n'avait ni `>` ni `<` sur sa propre ligne :
 * elle passait entière sous le relevé.
 */
const TEXTE_BALISE = />([^<>{}]{2,})</g;

/**
 * ET LE PRIX DE CETTE PORTÉE : un `>` de code peut s'apparier au `<` d'une
 * balise plus bas.
 *
 * Deux relevés du 26/08 le montrent : `/> ) : tab === 'heatmap' ? ( <Heatmap`
 * (rendu conditionnel) et `home.qdiValues[b] !== undefined); … return (`.
 * Aucun des deux n'est lu par qui que ce soit — c'est du code entre deux
 * éléments JSX. Une garde qui les compte fait défaire du code juste.
 *
 * Le partage se fait sur les caractères : `=`, `[`, `]`, `$`, l'accent grave et
 * la barre verticale n'apparaissent pas dans une phrase française, et
 * apparaissent dans presque toute expression. Le point-virgule et l'esperluette
 * sont VOLONTAIREMENT absents de cette liste : le gabarit HTML du PDF de bilan
 * écrit `&nbsp;` et `&eacute;`, et ce texte-là est lu.
 */
const CODE_PAS_PROSE = /[=[\]$`|]/;

/**
 * Le texte d'un nœud tenu dans une accolade —
 * `<Text>{'JERK RÉSIDUEL'}</Text>` et sa forme gabarit.
 *
 * `TEXTE_BALISE` l'écarte par construction (il refuse `{`), et c'est là que
 * dorment les sur-titres mono : deux des trois chaînes fautives de `FlowViz`
 * avaient cette forme.
 */
const TEXTE_EXPRESSION = />\s*\{\s*(?:`([^`]*)`|'([^'\n]*)'|"([^"\n]*)")\s*\}\s*</g;

/**
 * Une interpolation n'est pas du texte lu.
 *
 * `label={` + `Vitesse mini à la corde : ${apex} km/h` + `}` est une phrase
 * JUSTE : `apex` y est le nom d'une variable, pas un mot affiché. Sans ce
 * retrait, la garde condamnait des libellés déjà conformes — le défaut exact
 * qu'elle a déjà corrigé une fois pour les chips.
 */
function sansInterpolation(valeur: string): string {
  return valeur.replace(/\$\{[^}]*\}/g, ' ');
}

interface Extrait {
  texte: string;
  /** Position dans la source nettoyée, pour retrouver la ligne. */
  index: number;
}

/**
 * Tout ce qu'un humain lira dans cette source, et rien d'autre.
 *
 * LA VALEUR SEULE, PAS LA LIGNE. Première écriture : chercher le mot n'importe
 * où sur une ligne portant une propriété d'affichage. Elle a accusé les chips
 * CORRIGÉS — `<Chip label="Sur le tracé" active={tab === 'heatmap'} />` —
 * parce que le nom de l'onglet reste `heatmap` dans le code, et doit le rester.
 *
 * Une garde qui condamne sa propre correction est pire qu'aucune garde : quand
 * la propriété est SUIVIE D'UN LITTÉRAL, on ne prend que ce littéral-là.
 *
 * Quand elle est suivie d'une EXPRESSION — la forme de tous les axes de
 * l'empreinte, `detail:` puis un ternaire — le littéral est plus loin sur la
 * ligne ; on prend alors tous ceux qui restent. Les fragments d'un seul
 * caractère (les séparateurs d'un `.replace()`) tombent d'eux-mêmes : on exige
 * deux lettres consécutives pour qu'un extrait compte comme du texte.
 */
function extraits(src: string): Extrait[] {
  const out: Extrait[] = [];
  const pousse = (brut: string, index: number) => {
    const texte = sansInterpolation(brut).replace(/\s+/g, ' ').trim();
    if (/[A-Za-zÀ-ÿ]{2,}/.test(texte)) out.push({ texte, index });
  };

  DEBUT_PROP.lastIndex = 0;
  let p: RegExpExecArray | null;
  while ((p = DEBUT_PROP.exec(src)) !== null) {
    const depart = p.index + p[0].length;
    const finLigne = src.indexOf('\n', depart);
    let reste = src.slice(depart, finLigne === -1 ? undefined : finLigne);
    let decalage = depart;
    const accolade = /^\{\s*/.exec(reste);
    if (accolade) {
      reste = reste.slice(accolade[0].length);
      decalage += accolade[0].length;
    }
    const immediat = /^(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/.exec(reste);
    if (immediat) {
      pousse(immediat[1] ?? immediat[2] ?? immediat[3] ?? '', decalage);
      continue;
    }
    LITTERAL.lastIndex = 0;
    let l: RegExpExecArray | null;
    while ((l = LITTERAL.exec(reste)) !== null) {
      pousse(l[1] ?? l[2] ?? l[3] ?? '', decalage + l.index);
    }
  }

  TEXTE_BALISE.lastIndex = 0;
  let t: RegExpExecArray | null;
  while ((t = TEXTE_BALISE.exec(src)) !== null) {
    if (!CODE_PAS_PROSE.test(t[1])) pousse(t[1], t.index + 1);
  }

  TEXTE_EXPRESSION.lastIndex = 0;
  let x: RegExpExecArray | null;
  while ((x = TEXTE_EXPRESSION.exec(src)) !== null) {
    pousse(x[1] ?? x[2] ?? x[3] ?? '', x.index + 1);
  }

  return out.sort((a, b) => a.index - b.index);
}

/** Les valeurs affichées d'une ligne, ou `[]`. */
function valeursAffichees(ligne: string): string[] {
  return extraits(ligne).map((e) => e.texte);
}

/** Numéro de ligne (1-indexé) d'une position dans la source nettoyée. */
function ligneDe(src: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i += 1) if (src[i] === '\n') n += 1;
  return n;
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
    for (const e of extraits(code)) {
      for (const { mot } of PROSCRITS) {
        if (mot.test(e.texte)) {
          out.push({
            fichier: f.replace(RACINE, '').split(/[\\/]/).join('/'),
            ligne: ligneDe(code, e.index),
            mot: String(mot),
            texte: e.texte.slice(0, 120),
          });
        }
      }
    }
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
   * LOT 10b — LES FORMES QUI DORMAIENT HORS DE PORTÉE.
   *
   * Trois structures que la garde d'avant ne savait pas lire, et qui portaient
   * chacune une des chaînes corrigées : le littéral de propriété d'un objet
   * (le catalogue, l'empreinte), le nœud de texte tenu dans une accolade, et
   * la phrase qui court sur deux lignes.
   */
  it('le relevé reconnaît les formes du lot 10b — objets, accolades, phrases longues', () => {
    const avant = [
      "    name: 'Diagramme G-G',",
      "    { label: 'G latéral', value: fmtG(maxLat), unit: 'g', tone: 'gold' },",
      '      detail: latMean !== null ? `${fmtG(latMean)} g latéral` : null,',
      '      detail: carry !== null ? `apex à ${Math.round(carry * 100)} %` : null,',
      '<Text style={styles.statusRight}>{`JERK RÉSIDUEL · ${points.length} POINTS`}</Text>',
      '<Text style={styles.heroLabel}>JERK MOYEN NON EXPLIQUÉ PAR LA TRAJECTOIRE</Text>',
      '<Text style={styles.statusRight}>COMBINÉ G-G</Text>',
      '<Text style={styles.vide}>\n  Pas encore de mesure. Le jerk se calcule\n  sur les trames de télémétrie.\n</Text>',
    ];
    for (const ligne of avant) {
      const valeurs = valeursAffichees(ligne);
      expect(valeurs.length).toBeGreaterThan(0);
      expect(valeurs.some((v) => PROSCRITS.some((p) => p.mot.test(v)))).toBe(true);
    }
  });

  /**
   * ET CE QUE LA GARDE NE DOIT PAS ACCUSER — LA MÉTHODE.
   *
   * Le champ `source` du catalogue nomme l'instrument. Le § 01 l'autorise, le
   * fondateur l'a confirmé le 26/08 : « garde le terme technique là où il est
   * une méthode ouverte, mais pas dans un titre ni une étiquette lue en
   * premier ». Si `source` entrait un jour dans la liste des propriétés lues,
   * ce test tomberait — et c'est le but.
   */
  it('la méthode reste technique — `source` n’est pas une étiquette', () => {
    const methode =
      "    source: 'Nuage de points (G longitudinal, G latéral) sur l’ensemble du tour.',";
    expect(PROPS_AFFICHEES.test(methode)).toBe(false);
    expect(valeursAffichees(methode)).toEqual([]);
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
   * L'interpolation d'une vitesse à la corde dans une phrase juste est le NOM
   * D'UNE VARIABLE. La première écriture de la garde lisait le gabarit brut et
   * accusait ce libellé, qui est déjà conforme.
   */
  it('une interpolation n’est pas du texte lu', () => {
    const juste = '<Metric label={`Vitesse mini à la corde : ${apex} km/h`} />';
    const valeurs = valeursAffichees(juste);
    expect(valeurs).toEqual(['Vitesse mini à la corde : km/h']);
    expect(valeurs.some((v) => PROSCRITS.some((p) => p.mot.test(v)))).toBe(false);
  });

  /**
   * DU CODE ENTRE DEUX BALISES N'EST PAS UN NŒUD DE TEXTE.
   *
   * En lisant le fichier entier plutôt que ligne à ligne, le relevé s'est mis à
   * apparier le `>` d'un `/>` avec le `<` de la balise suivante — et à accuser
   * le rendu conditionnel qui vit entre les deux. Ces deux formes ont été
   * relevées le 26/08 dans `data/session/[id].tsx` et `index.tsx` : elles sont
   * justes, et le nom d'onglet `'heatmap'` doit y rester.
   */
  it('le rendu conditionnel entre deux balises n’est pas de la copie', () => {
    const codeEntreBalises = [
      "<GGScatter points={gg} />\n      ) : tab === 'heatmap' ? (\n        <HeatmapTrace traj={traj} />",
      'const mesurees = B.filter((b) => home.qdiValues[b] !== undefined);\n  return (\n    <PressScale',
    ];
    for (const bloc of codeEntreBalises) {
      expect(valeursAffichees(bloc).some((v) => PROSCRITS.some((p) => p.mot.test(v)))).toBe(false);
    }
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
