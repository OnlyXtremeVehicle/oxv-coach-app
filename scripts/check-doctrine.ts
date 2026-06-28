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
const FORBIDDEN_PATTERNS: { pattern: RegExp; verb: string }[] = [
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
  // Catégorie 4 : termes anglais dans texte UI (la doctrine OXV est en français)
  { pattern: /\btap\b/gi, verb: 'tap (anglais)' },
  { pattern: /\bswipe\b/gi, verb: 'swipe (anglais)' },
  { pattern: /\bclick\b/gi, verb: 'click (anglais)' },
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
  /^\s*\*/, // commentaire bloc (étoile en début)
  /FORBIDDEN_VERBS/, // tableau de test anti-doctrine
  /'freinez'|'accélérez'|'évitez'/, // tableau de test
  /haptics\.tap/, // appel de fonction RN haptics, pas du texte UI
];

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

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (IGNORE_LINE_PATTERNS.some((p) => p.test(line))) continue;

    for (const { pattern, verb } of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0; // reset le regex global
      if (pattern.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          verb,
          excerpt: line.trim().slice(0, 100),
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
          excerpt: line.trim().slice(0, 100),
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
