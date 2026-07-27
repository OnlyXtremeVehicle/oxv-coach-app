/**
 * Scanner d'accessibilité — exige un RÔLE et un NOM sur chaque commande.
 *
 * Usage :
 *   npx tsx scripts/check-accessibility.ts          # rapport seul
 *   npx tsx scripts/check-accessibility.ts --strict # sortie 1 si manquants
 *
 * DEUX ÉLARGISSEMENTS, tous deux nés du même constat : ce scanner passait au
 * vert sans regarder grand-chose.
 *
 *   1. IL NE VOYAIT QUE `app/`. Le kit d'interface et les composants partagés,
 *      qui sont montés partout, n'étaient jamais scannés — 125 fichiers hors
 *      champ sur 344. Il couvre maintenant `app/` ET `src/`.
 *
 *   2. IL NE VÉRIFIAIT QUE LE RÔLE. Une commande annoncée « bouton » sans nom
 *      dit ce qu'elle EST, jamais ce qu'elle FAIT : au lecteur d'écran, elle est
 *      inutilisable. Le nom est désormais exigé, qu'il vienne d'un
 *      `accessibilityLabel` ou d'un enfant textuel.
 *
 * Heuristique : un `<Pressable ... onPress={...}>` est examiné sur son bloc de
 * props, puis sur les 40 lignes de son corps pour y chercher un nom.
 *
 * Tolérance : un Pressable qui n'est pas une commande réelle (zone de geste)
 * peut porter `// accessibility: not-applicable` sur la ligne juste au-dessus.
 */

import * as fs from 'fs';
import * as path from 'path';

type Manque = 'role' | 'nom';

interface Issue {
  file: string;
  line: number;
  excerpt: string;
  manque: Manque;
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

    // Un wrapper sans onPress n'est pas une commande : rien à exiger de lui.
    if (!/onPress\s*=/.test(block)) continue;

    if (!/accessibilityRole/.test(block)) {
      issues.push({
        file: filePath,
        line: i + 1,
        excerpt: line.trim().slice(0, 80),
        manque: 'role',
      });
      continue;
    }

    // LE RÔLE NE SUFFIT PAS, et c'est l'angle mort que ce scanner avait.
    // Une commande annoncée « bouton » sans nom dit ce qu'elle EST, jamais ce
    // qu'elle FAIT : au lecteur d'écran, elle est inutilisable. Un enfant
    // textuel fournit ce nom ; à défaut, il faut un `accessibilityLabel`.
    const corps = lines.slice(blockEnd, Math.min(blockEnd + 40, lines.length)).join(' ');
    const aNom =
      /accessibilityLabel/.test(block) ||
      /<Text[\s>]/.test(corps) ||
      // Un composant maison qui reçoit son libellé en prop en porte un aussi.
      /\b(label|title)=/.test(corps);

    if (!aNom) {
      issues.push({
        file: filePath,
        line: i + 1,
        excerpt: line.trim().slice(0, 80),
        manque: 'nom',
      });
    }
  }

  return issues;
}

function main(): void {
  const strict = process.argv.includes('--strict');

  // `src/` EST scanné, désormais. Le scanner ne regardait que `app/` — donc
  // jamais le kit d'interface ni les composants partagés, alors que ce sont eux
  // qui sont montés partout. Un angle mort de cette taille rendait le contrôle
  // rassurant plutôt qu'utile.
  const racines = ['app', 'src']
    .map((d) => path.join(process.cwd(), d))
    .filter((d) => fs.existsSync(d));

  if (racines.length === 0) {
    console.error(`Ni app/ ni src/ trouvés depuis ${process.cwd()}`);
    process.exit(2);
  }

  const files = racines.flatMap((d) => listTsxFiles(d));
  const allIssues: Issue[] = [];
  for (const file of files) {
    allIssues.push(...scanFile(file));
  }

  const sansRole = allIssues.filter((i) => i.manque === 'role');
  const sansNom = allIssues.filter((i) => i.manque === 'nom');

  console.log(
    `Scan accessibilité : ${files.length} fichiers .tsx (${racines
      .map((r) => path.basename(r) + '/')
      .join(' + ')})`
  );

  if (allIssues.length === 0) {
    console.log('OK — chaque Pressable actionnable a un rôle ET un nom accessible.');
    process.exit(0);
  }

  if (sansRole.length > 0) console.log(`\n${sansRole.length} sans accessibilityRole :`);
  for (const issue of sansRole) {
    console.log(`  ${path.relative(process.cwd(), issue.file)}:${issue.line}`);
  }

  if (sansNom.length > 0) {
    console.log(`\n${sansNom.length} avec un rôle mais SANS NOM accessible :`);
    console.log('  (annoncées « bouton » et rien d’autre au lecteur d’écran)');
  }
  for (const issue of sansNom) {
    console.log(`  ${path.relative(process.cwd(), issue.file)}:${issue.line}`);
  }

  console.log(`\nExtraits :`);
  for (const issue of allIssues) {
    const rel = path.relative(process.cwd(), issue.file);
    console.log(`  [${issue.manque}] ${rel}:${issue.line}`);
    console.log(`    ${issue.excerpt}`);
  }

  console.log(
    `\nTotal : ${allIssues.length} à couvrir — ${sansRole.length} sans rôle, ${sansNom.length} sans nom.`
  );
  console.log(
    'Un rôle dit ce que la commande EST ; un nom dit ce qu’elle FAIT. Les deux sont requis.'
  );
  console.log(
    "Ou ajouter `// accessibility: not-applicable` juste au-dessus si le Pressable n'est pas un CTA réel."
  );

  process.exit(strict ? 1 : 0);
}

main();
