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
import { PLAFOND_PHRASES, estExcepte } from './restitutionSansPhrase.exceptions';
import { estPhrase } from '../src/lib/regleMotsCles';
import {
  FEUILLES_DE_DONNEES,
  estFeuilleDeDonnees,
} from '../src/lib/surfacesRestitution';


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

/**
 * ===========================================================================
 * SECONDE PASSE — AUCUNE PHRASE SUR UNE FEUILLE DE DONNÉES (règle G-0)
 * ===========================================================================
 *
 * La première passe interdit un LEXIQUE : les verbes de conseil. Celle-ci
 * interdit une FORME : la phrase, sur les seules surfaces déclarées comme
 * feuilles de données dans `src/lib/surfacesRestitution.ts`.
 *
 * Quatre choses qu'elle ne fait PAS, et qu'il faut savoir :
 *
 *   • elle ne lit que des LITTÉRAUX. Une chaîne assemblée à l'exécution lui
 *     échappe, et prétendre le contraire donnerait une garde qui ment ;
 *   • elle ne devine aucune surface : un écran absent du manifeste n'est pas
 *     contrôlé ici, il est signalé par `surfacesRestitution.test.ts` ;
 *   • elle laisse passer nombres, unités et horodatages — ils n'ont pas de mot
 *     outil, donc la définition ne les attrape pas ;
 *   • elle est BLOQUANTE sur les écrans du Mans, avertissante ailleurs, le
 *     temps que les surfaces existantes passent. Une garde qui bloque tout le
 *     premier jour se fait désarmer le second.
 */
const ECRANS_DU_MANS: readonly string[] = [
  'app/(app2)/bilan/[sessionId].tsx',
  'app/(app2)/data/session/[id].tsx',
];

interface Phrase {
  file: string;
  line: number;
  texte: string;
  bloquant: boolean;
}

function scanPhrases(filePath: string): Phrase[] {
  const rel = path.relative(process.cwd(), filePath).split(path.sep).join('/');
  if (!estFeuilleDeDonnees(rel)) return [];
  const bloquant = ECRANS_DU_MANS.some((e) => rel.toLowerCase() === e.toLowerCase());

  const out: Phrase[] = [];
  const lines = fs.readFileSync(filePath, 'utf-8').split(String.fromCharCode(10));
  const etat: EtatBloc = { dedans: false };

  for (let i = 0; i < lines.length; i++) {
    const brute = lines[i];
    const line = horsCommentaireBloc(brute, etat);
    if (line.trim() === '') continue;
    if (IGNORE_LINE_PATTERNS.some((p) => p.test(line))) continue;
    if (/^\s*import\s|require\(/.test(line)) continue;
    if (estExcepte(rel, line)) continue;

    for (const morceau of portionsAffichables(line).split(String.fromCharCode(10))) {
      const t = morceau.trim();
      if (t.length === 0) continue;
      if (estPhrase(t)) out.push({ file: filePath, line: i + 1, texte: t, bloquant });
    }
  }
  return out;
}

function passeMotsCles(): number {
  const feuilles = FEUILLES_DE_DONNEES.map((f) => path.join(process.cwd(), f)).filter((f) =>
    fs.existsSync(f)
  );
  const phrases = feuilles.flatMap((f) => scanPhrases(f));
  const bloquantes = phrases.filter((p) => p.bloquant);

  console.log(
    `
Règle des mots-clés : ${feuilles.length} feuilles de données contrôlées, ` +
      `${phrases.length} phrase(s) trouvée(s) dont ${bloquantes.length} sur un écran du Mans.`
  );
  for (const p of phrases) {
    const rel = path.relative(process.cwd(), p.file);
    const niveau = p.bloquant ? 'à corriger' : 'à voir';
    console.log(`  [${niveau}] ${rel}:${p.line}  « ${p.texte.slice(0, 90)} »`);
  }

  // LE CLIQUET. On compte par écran et on compare au plafond mesuré le
  // 01/09/2026 : une phrase de plus est refusée, une de moins est saluée. Un
  // plafond ne remonte jamais — s'il faut l'augmenter, c'est qu'on a ajouté une
  // phrase, et c'est exactement ce que la garde existe pour refuser.
  let depassements = 0;
  const parEcran = new Map<string, number>();
  for (const p of bloquantes) {
    const rel = path.relative(process.cwd(), p.file).split(path.sep).join('/');
    parEcran.set(rel, (parEcran.get(rel) ?? 0) + 1);
  }
  for (const [ecran, plafond] of Object.entries(PLAFOND_PHRASES)) {
    const n = parEcran.get(ecran) ?? 0;
    if (n > plafond) {
      console.error(`  PHRASE NOUVELLE — ${ecran} : ${n} phrases pour un plafond de ${plafond}.`);
      depassements += n - plafond;
    } else if (n < plafond) {
      console.log(`  Le plafond de ${ecran} peut descendre de ${plafond} à ${n}.`);
    }
  }
  for (const [ecran, n] of parEcran) {
    if (!(ecran in PLAFOND_PHRASES)) {
      console.error(`  ÉCRAN DU MANS SANS PLAFOND — ${ecran} : ${n} phrases.`);
      depassements += n;
    }
  }
  return depassements;
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

  const phrasesBloquantes = passeMotsCles();

  if (allViolations.length === 0 && phrasesBloquantes === 0) {
    console.log('OK — aucun verbe interdit, aucune phrase sur une feuille de données.');
    process.exit(0);
  }

  if (allViolations.length === 0) {
    console.error(
      `
KO — ${phrasesBloquantes} phrase(s) NOUVELLE(S) sur un écran du Mans, au-delà du plafond.`
    );
    process.exit(1);
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
