/**
 * Scanner d'accessibilité — flag les Pressables sans accessibilityRole.
 *
 * Usage :
 *   npx tsx scripts/check-accessibility.ts          # report only (warn)
 *   npx tsx scripts/check-accessibility.ts --strict # exit 1 si manquants
 *
 * Heuristique : un <Pressable ... onPress={...}> sans `accessibilityRole`
 * dans les 20 lignes suivantes (du tag d'ouverture jusqu'à la fin de
 * ses props) est flag.
 *
 * Tolérances :
 *   - Les Pressables qui ne sont pas des CTA réels (ex: areas de geste)
 *     peuvent être annotés avec `// accessibility: not-applicable` dans
 *     un commentaire immédiatement avant.
 *
 * Pas intégré au CI en strict mode V1 (pour ne pas bloquer alpha avec
 * un debt accessibility historique). À promouvoir en CI strict V1.1
 * après couverture complète.
 */

import * as fs from 'fs';
import * as path from 'path';

interface Issue {
  file: string;
  line: number;
  excerpt: string;
}

function listTsxFiles(dir: string): string[] {
  const result: string[] = [];
  function walk(d: string): void {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        walk(full);
      } else if (e.isFile() && full.endsWith('.tsx')) {
        result.push(full);
      }
    }
  }
  walk(dir);
  return result;
}

function scanFile(filePath: string): Issue[] {
  const issues: Issue[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Détecter ouverture <Pressable mais pas <Pressable.*Item ou autres
    if (!/<Pressable[\s>]/.test(line)) continue;

    // Skip si commentaire `// accessibility: not-applicable` juste avant
    const prevLine = i > 0 ? lines[i - 1] : '';
    if (/accessibility:\s*not-applicable/.test(prevLine)) continue;

    // Cherche la fin du tag d'ouverture (`>` ou `/>`) dans les 30 lignes suivantes
    let blockEnd = i;
    for (let j = i; j < Math.min(i + 30, lines.length); j++) {
      if (/>/.test(lines[j]) && !/={\s*\(\s*\{/.test(lines[j])) {
        blockEnd = j;
        break;
      }
    }
    const block = lines.slice(i, blockEnd + 1).join(' ');

    // Si pas d'accessibilityRole dans le block, c'est un manque
    if (!/accessibilityRole/.test(block)) {
      // Vérifier qu'il y a bien un onPress (sinon c'est juste un wrapper)
      if (/onPress\s*=/.test(block)) {
        issues.push({
          file: filePath,
          line: i + 1,
          excerpt: line.trim().slice(0, 80),
        });
      }
    }
  }

  return issues;
}

function main(): void {
  const strict = process.argv.includes('--strict');
  const appDir = path.join(process.cwd(), 'app');
  if (!fs.existsSync(appDir)) {
    console.error(`Répertoire app/ introuvable depuis ${process.cwd()}`);
    process.exit(2);
  }

  const files = listTsxFiles(appDir);
  const allIssues: Issue[] = [];
  for (const file of files) {
    allIssues.push(...scanFile(file));
  }

  console.log(`Scan accessibilité : ${files.length} fichiers .tsx dans app/`);

  if (allIssues.length === 0) {
    console.log('OK — toutes les Pressables avec onPress ont accessibilityRole.');
    process.exit(0);
  }

  console.log(
    `\nWARN — ${allIssues.length} Pressable(s) avec onPress mais sans accessibilityRole :`
  );
  for (const issue of allIssues) {
    const rel = path.relative(process.cwd(), issue.file);
    console.log(`  ${rel}:${issue.line}`);
    console.log(`    ${issue.excerpt}`);
  }

  console.log(`\nTotal : ${allIssues.length} à couvrir (V1.1).`);
  console.log(
    'Ajouter accessibilityRole="button" + accessibilityLabel="..." sur chaque Pressable.'
  );
  console.log(
    'Ou ajouter `// accessibility: not-applicable` juste au-dessus si le Pressable n\'est pas un CTA réel.'
  );

  process.exit(strict ? 1 : 0);
}

main();
