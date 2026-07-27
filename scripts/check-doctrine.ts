/**
 * Scanner doctrinal — vérifie qu'aucun fichier .tsx (UI affichée au
 * pilote) ne contient un verbe directif interdit par la doctrine OXV.
 *
 * Usage :
 *   npx tsx scripts/check-doctrine.ts
 *
 * Exit 0 si propre, exit 1 si violation détectée (utilisable en CI).
 *
 * Périmètre scanné : app/**\/*.tsx (écrans + layouts pilote/admin).
 * Le code admin (bronze) est aussi scanné — la doctrine vaut pour tout
 * affichage humain, pas seulement côté pilote.
 *
 * Faux positifs gérés :
 *   - Strings dans des constantes FORBIDDEN_VERBS ou commentaires test
 *   - Verbes dans un import de variable (ex: `useFocusCorner`)
 *
 * Pour ajouter un verbe à surveiller, l'ajouter dans la liste ci-dessous
 * ET dans focusCorner.test.ts + debriefGenerator.test.ts pour garder
 * l'alignement.
 */

import * as fs from 'fs';
import * as path from 'path';

// Liste alignée avec src/services/__tests__/focusCorner.test.ts
// et src/services/__tests__/debriefGenerator.test.ts
//
// 3 catégories :
//   1. Verbes de pilotage directifs (la doctrine miroir interdit de dire
//      au pilote comment piloter)
//   2. Impératifs UI paternalistes (« appuyez sur » suggère que l'user
//      ne sait pas naviguer son téléphone)
//   3. Jugements gratuits (« bravo », « parfait » : on n'évalue pas
//      l'humain, on lui montre les chiffres)
/**
 * `prose` restreint la recherche au texte réellement affichable — littéraux de
 * chaîne contenant une espace, et nœuds de texte JSX. Sans cette portée, un
 * terme anglais employé comme IDENTIFIANT (`haptic="tap"`, `const swipe = …`)
 * remonte comme violation : soixante-quinze fois, ce qui rendait le scanner
 * rouge en permanence et donc inutile. Un scanner qu'on n'écoute plus n'attrape
 * plus rien de réel.
 */
type Portee = 'ligne' | 'prose';

const FORBIDDEN_PATTERNS: { pattern: RegExp; verb: string; portee?: Portee }[] = [
  // Catégorie 1 : verbes de pilotage
  { pattern: /\bfreinez\b/gi, verb: 'freinez' },
  { pattern: /\baccélérez\b/gi, verb: 'accélérez' },
  { pattern: /\bouvrez les gaz\b/gi, verb: 'ouvrez les gaz' },
  { pattern: /\btracez\b/gi, verb: 'tracez' },
  { pattern: /\bévitez\b/gi, verb: 'évitez' },
  { pattern: /\bil faut\b/gi, verb: 'il faut' },
  { pattern: /\bvous devez\b/gi, verb: 'vous devez' },
  { pattern: /\bvous devriez\b/gi, verb: 'vous devriez' },
  { pattern: /\btu dois\b/gi, verb: 'tu dois' },
  { pattern: /\btu peux\b/gi, verb: 'tu peux' },
  // Catégorie 2 : impératifs UI paternalistes
  { pattern: /\bappuyez sur\b/gi, verb: 'appuyez sur' },
  { pattern: /\bcliquez sur\b/gi, verb: 'cliquez sur' },
  { pattern: /\btapez sur\b/gi, verb: 'tapez sur' },
  { pattern: /\bn'oubliez pas\b/gi, verb: "n'oubliez pas" },
  { pattern: /\bn'hésitez pas\b/gi, verb: "n'hésitez pas" },
  { pattern: /\bpensez à\b/gi, verb: 'pensez à' },
  { pattern: /\bessayez de\b/gi, verb: 'essayez de' },
  // Catégorie 3 : jugements gratuits
  { pattern: /\bbravo\b/gi, verb: 'bravo' },
  { pattern: /\bbien joué\b/gi, verb: 'bien joué' },
  { pattern: /\bsuper\s*!/gi, verb: 'super !' },
  { pattern: /\bparfait\s*!/gi, verb: 'parfait !' },
  { pattern: /\bexcellent\s*!/gi, verb: 'excellent !' },
  { pattern: /\battention\s*!/gi, verb: 'attention !' },
  // Catégorie 4 : termes anglais dans texte UI (la doctrine OXV est en français).
  // Portée `prose` : ces mots sont aussi le vocabulaire de Gesture Handler et du
  // service haptique. Les chercher sur la ligne entière confondait le texte lu
  // par le pilote avec le nom d'une variable.
  { pattern: /\btap\b/gi, verb: 'tap (anglais)', portee: 'prose' },
  { pattern: /\bswipe\b/gi, verb: 'swipe (anglais)', portee: 'prose' },
  { pattern: /\bclick\b/gi, verb: 'click (anglais)', portee: 'prose' },
  // Catégorie 5 : conseils reformulés en groupe nominal (frontière fait/cause,
  // Pattern 4). Le scanner par verbes ne les capte pas ; ces tournures
  // désignent une cause à corriger et sont réservées au CoachBand (coach
  // agréé, attribué), jamais au miroir du pilote. Cf. focusCorner.ts.
  { pattern: /\brepère de freinage\b/gi, verb: 'repère de freinage' },
  { pattern: /\brepère de corde\b/gi, verb: 'repère de corde' },
  { pattern: /\bpatience à la corde\b/gi, verb: 'patience à la corde' },
  { pattern: /\bfreiner plus (tôt|tard)\b/gi, verb: 'freiner plus tôt/tard' },
  { pattern: /\brelâch(?:er|ez) plus (tôt|tard)\b/gi, verb: 'relâcher plus tôt/tard' },
  // Catégorie 6 : NOMS de jugement (fiche 10 §C — garde-langage bien-être). On
  // décrit des faits, jamais une note sur la personne ou sa performance.
  // Exclus volontairement : « échec » (alertes techniques légitimes) et
  // « faible » (usage factuel : « dispersion faible »). « lent/rapide » NU est
  // factuel (dégradé de vitesse, antonyme neutre) et AUTORISÉ ; seul le JUGEMENT
  // « trop lent » est proscrit (fiche 09 §C : « Trop lent au 3 » → « Vitesse mini
  // au virage 3 »). Viser « lent » nu cassait aussi sur l'accent (« ré-vèlent »).
  {
    pattern: /\btrop\s+lent(?:e|es|s)?\b/gi,
    verb: 'trop lent (→ « vitesse mini/basse », fiche 09 §C)',
  },
  { pattern: /\bmauvais(?:e)?\b/gi, verb: 'mauvais' },
  { pattern: /\bmédiocre\b/gi, verb: 'médiocre' },
  { pattern: /\bdécevant(?:e)?\b/gi, verb: 'décevant' },
  { pattern: /\braté(?:e)?\b/gi, verb: 'raté' },
];

// Patterns supplémentaires : dates sans locale fr-FR explicite
// → `toLocaleDateString()` sans argument est ambigu, on veut fr-FR
const ADDITIONAL_PATTERNS: { pattern: RegExp; verb: string }[] = [
  {
    pattern: /\.toLocaleDateString\(\)/g,
    verb: 'toLocaleDateString() sans fr-FR explicite',
  },
  {
    pattern: /\.toLocaleTimeString\(\)/g,
    verb: 'toLocaleTimeString() sans fr-FR explicite',
  },
];

// Patterns à ignorer (faux positifs structurels)
const IGNORE_LINE_PATTERNS = [
  /^\s*\/\//, // commentaire ligne
  /^\s*\/\*/, // OUVERTURE de commentaire bloc — `/**` en début de ligne n'était
  //             pas couvert par la règle suivante, qui exige une étoile seule.
  /^\s*\{\s*\/\*/, // commentaire JSX `{/* … */}`
  /^\s*\*/, // commentaire bloc (étoile en début)
  /FORBIDDEN_VERBS/, // tableau de test anti-doctrine
  /'freinez'|'accélérez'|'évitez'/, // tableau de test
  /haptics\.tap/, // appel de fonction RN haptics, pas du texte UI
];

/**
 * Extrait d'une ligne ce qui peut réellement s'afficher : les littéraux de
 * chaîne porteurs d'au moins une espace — donc de la phrase, non un code — et
 * les nœuds de texte JSX.
 *
 * Une chaîne d'un seul mot (`'tap'`, `"swipe"`) est écartée : c'est la forme
 * d'une valeur passée à une fonction, jamais celle d'une phrase lue par un
 * pilote. C'est la distinction qui sépare les soixante-quinze faux positifs
 * d'une vraie violation.
 */
function portionsAffichables(line: string): string {
  const morceaux: string[] = [];

  const litteraux = line.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g);
  for (const m of litteraux) {
    if (m[2].includes(' ')) morceaux.push(m[2]);
  }

  const texteJsx = line.matchAll(/>([^<>{}]{2,})</g);
  for (const m of texteJsx) morceaux.push(m[1]);

  return morceaux.join('\n');
}

interface Violation {
  file: string;
  line: number;
  verb: string;
  excerpt: string;
}

function listTsxFiles(rootDir: string): string[] {
  const result: string[] = [];
  function walk(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full);
      } else if (entry.isFile() && full.endsWith('.tsx')) {
        result.push(full);
      }
    }
  }
  walk(rootDir);
  return result;
}

/**
 * Un écran gardé par `__DEV__` ne s'affiche jamais à un pilote : la doctrine
 * gouverne ce qui est lu, et rien n'est lu là. La galerie de développement
 * documente le nom des retours haptiques — l'y traduire en français
 * décrirait faussement l'interface de programmation.
 */
function estGardeDev(content: string): boolean {
  return /if\s*\(\s*!__DEV__\s*\)/.test(content);
}

/** État de traversée d'un commentaire bloc, porté d'une ligne à la suivante. */
interface EtatBloc {
  dedans: boolean;
}

/**
 * Retire d'une ligne ce qui appartient à un commentaire bloc `/* … *\/`,
 * y compris sa forme JSX `{/* … *\/}`.
 *
 * Le scanner lit ligne à ligne. Un commentaire sur plusieurs lignes ne porte
 * son marqueur que sur la première : les suivantes sont nues et étaient donc
 * scannées comme du code. C'est ainsi qu'une note d'accessibilité expliquant
 * le « double-tap d'un lecteur d'écran » remontait comme anglicisme affiché.
 */
function horsCommentaireBloc(line: string, etat: EtatBloc): string {
  let reste = line;
  let sortie = '';

  for (;;) {
    if (etat.dedans) {
      const fin = reste.indexOf('*/');
      if (fin === -1) return sortie;
      reste = reste.slice(fin + 2);
      etat.dedans = false;
      continue;
    }
    const debut = reste.indexOf('/*');
    if (debut === -1) return sortie + reste;
    sortie += reste.slice(0, debut);
    reste = reste.slice(debut + 2);
    etat.dedans = true;
  }
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  if (estGardeDev(content)) return violations;
  const lines = content.split('\n');
  const etat: EtatBloc = { dedans: false };

  for (let i = 0; i < lines.length; i++) {
    const brute = lines[i];
    const line = horsCommentaireBloc(brute, etat);
    if (line.trim() === '') continue;
    if (IGNORE_LINE_PATTERNS.some((p) => p.test(line))) continue;
    const prose = portionsAffichables(line);

    for (const { pattern, verb, portee } of FORBIDDEN_PATTERNS) {
      const cible = portee === 'prose' ? prose : line;
      if (cible === '') continue;
      pattern.lastIndex = 0; // reset le regex global
      if (pattern.test(cible)) {
        violations.push({
          file: filePath,
          line: i + 1,
          verb,
          excerpt: brute.trim().slice(0, 100),
        });
      }
    }
    for (const { pattern, verb } of ADDITIONAL_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          verb,
          excerpt: brute.trim().slice(0, 100),
        });
      }
    }
  }
  return violations;
}

function main(): void {
  const appDir = path.join(process.cwd(), 'app');
  if (!fs.existsSync(appDir)) {
    console.error(`Répertoire app/ introuvable depuis ${process.cwd()}`);
    process.exit(2);
  }

  const files = listTsxFiles(appDir);
  console.log(`Scan doctrinal : ${files.length} fichiers .tsx dans app/`);

  const allViolations: Violation[] = [];
  for (const file of files) {
    allViolations.push(...scanFile(file));
  }

  if (allViolations.length === 0) {
    console.log('OK — aucun verbe interdit détecté.');
    process.exit(0);
  }

  console.error(`\nKO — ${allViolations.length} violation(s) doctrinale(s) :`);
  for (const v of allViolations) {
    const rel = path.relative(process.cwd(), v.file);
    console.error(`  ${rel}:${v.line}  « ${v.verb} »`);
    console.error(`    ${v.excerpt}`);
  }
  process.exit(1);
}

main();
