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
import { FORBIDDEN_PATTERNS, type Portee } from './doctrineRegles';


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

/**
 * Un fichier de TEST cite les verbes interdits par fonction : il vérifie qu'ils
 * sont bien attrapés. L'y signaler serait un contresens — le test EST la garde.
 */
function estTest(filePath: string): boolean {
  return /__tests__|\.test\.tsx?$/.test(filePath);
}

function main(): void {
  // `src/` EST scanné, désormais. Le scan ne regardait que `app/` : les
  // 125 composants et écrans partagés de `src/` — montés dans les vrais écrans —
  // n'étaient jamais contrôlés. La doctrine gouverne ce qui est LU par le
  // pilote, et il lit tout autant ce qui vient de `src/`.
  const racines = ['app', 'src']
    .map((d) => path.join(process.cwd(), d))
    .filter((d) => fs.existsSync(d));

  if (racines.length === 0) {
    console.error(`Ni app/ ni src/ trouvés depuis ${process.cwd()}`);
    process.exit(2);
  }

  const files = racines.flatMap((d) => listTsxFiles(d)).filter((f) => !estTest(f));
  console.log(
    `Scan doctrinal : ${files.length} fichiers .tsx (${racines
      .map((r) => path.basename(r) + '/')
      .join(' + ')}, tests exclus)`
  );

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
