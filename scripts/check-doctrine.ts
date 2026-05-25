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
const FORBIDDEN_PATTERNS: { pattern: RegExp; verb: string }[] = [
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
];

// Patterns à ignorer (faux positifs structurels)
const IGNORE_LINE_PATTERNS = [
  /^\s*\/\//, // commentaire ligne
  /^\s*\*/, // commentaire bloc (étoile en début)
  /FORBIDDEN_VERBS/, // tableau de test anti-doctrine
  /'freinez'|'accélérez'|'évitez'/, // tableau de test
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
