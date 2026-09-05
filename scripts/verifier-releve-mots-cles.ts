/**
 * RE-VÉRIFICATION DÉTERMINISTE d'un relevé de mots-clés.
 *
 * Un relevé produit par des agents se croit sur parole ou se remesure. Ce
 * script remesure : pour chaque trouvaille, il rejoue `motifRefusMotCle` du
 * dépôt, rejoue `estPhrase` — pour savoir si la seconde passe la comptait
 * DÉJÀ — et vérifie que le texte figure bien à la ligne annoncée.
 *
 * Usage : npx tsx scripts/verifier-releve-mots-cles.ts <releve.json>
 */

import fs from 'fs';
import path from 'path';

import { estPhrase, motifRefusMotCle } from '../src/lib/regleMotsCles';

interface Trouvaille {
  fichier: string;
  ligne: number;
  texte: string;
  regle_enfreinte: string;
  position: string;
}

const source = process.argv[2];
if (!source) {
  console.error('Chemin du relevé attendu.');
  process.exit(1);
}

const brut = JSON.parse(fs.readFileSync(source, 'utf-8')) as {
  confirmees_detail: Trouvaille[];
};
const trouvailles = brut.confirmees_detail;

const cache = new Map<string, string[]>();
function lignesDe(rel: string): string[] | null {
  if (!cache.has(rel)) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs)) return null;
    cache.set(rel, fs.readFileSync(abs, 'utf-8').split('\n'));
  }
  return cache.get(rel) ?? null;
}

/** Le texte figure-t-il à la ligne annoncée, ou à deux lignes près ? */
function ancree(t: Trouvaille): boolean {
  const lignes = lignesDe(t.fichier);
  if (lignes === null) return false;
  // Les gabarits `${…}` sont rendus `{x}` par les agents : on compare sur le
  // plus long fragment littéral, qui suffit à ancrer.
  const fragments = t.texte
    .split(/\$\{[^}]*\}|\{[^}]*\}|…/)
    .map((f) => f.trim())
    .filter((f) => f.length >= 4);
  const cible = fragments.sort((a, b) => b.length - a.length)[0] ?? t.texte.trim();
  for (let d = -3; d <= 3; d++) {
    const l = lignes[t.ligne - 1 + d];
    if (typeof l === 'string' && l.includes(cible)) return true;
  }
  return false;
}

let ancrees = 0;
let flottantes = 0;
let motifAccorde = 0;
let motifDiscorde = 0;
let dejaPhrase = 0;
const nouvelles: Trouvaille[] = [];
const discordes: string[] = [];
const nonAncrees: string[] = [];

for (const t of trouvailles) {
  if (ancree(t)) ancrees += 1;
  else {
    flottantes += 1;
    nonAncrees.push(`${t.fichier}:${t.ligne} « ${t.texte.slice(0, 60)} »`);
  }

  const motif = motifRefusMotCle(t.texte);
  if (motif === null) {
    motifDiscorde += 1;
    discordes.push(`${t.fichier}:${t.ligne} « ${t.texte.slice(0, 60)} » — le dépôt la juge conforme`);
  } else {
    motifAccorde += 1;
  }

  if (estPhrase(t.texte)) dejaPhrase += 1;
  else nouvelles.push(t);
}

/**
 * LE SEUL ENSEMBLE QU'ON PUBLIE : nouvelles ET ancrées.
 *
 * Ventiler les « nouvelles » d'un côté et les « confirmées » de l'autre dans la
 * même phrase produit un total qui ne veut rien dire — c'est la faute que ce
 * relevé a d'abord commise. Toutes les ventilations ci-dessous portent sur le
 * MÊME ensemble, celui du chiffre annoncé.
 */
const RETENUES = nouvelles.filter(ancree);

const parPosition = new Map<string, number>();
for (const t of RETENUES) parPosition.set(t.position, (parPosition.get(t.position) ?? 0) + 1);

console.log(`trouvailles confirmées par les agents : ${trouvailles.length}`);
console.log(`  ancrées dans le fichier à ±3 lignes : ${ancrees}`);
console.log(`  NON retrouvées                      : ${flottantes}`);
console.log(`  motif confirmé par le dépôt         : ${motifAccorde}`);
console.log(`  motif DÉMENTI par le dépôt          : ${motifDiscorde}`);
console.log('');
console.log(`  déjà comptées par la 2ᵉ passe (estPhrase) : ${dejaPhrase}`);
console.log(`  NOUVELLES, propres à la règle d'écriture  : ${nouvelles.length}`);
console.log(`  dont ancrées — LE CHIFFRE RETENU         : ${RETENUES.length}`);
console.log('');
console.log('les retenues, par position :');
for (const [p, n] of [...parPosition].sort((a, b) => b[1] - a[1])) console.log(`  ${p} : ${n}`);

if (discordes.length > 0) {
  console.log('');
  console.log('DÉMENTIES par motifRefusMotCle :');
  for (const d of discordes) console.log(`  ${d}`);
}
if (nonAncrees.length > 0) {
  console.log('');
  console.log('NON RETROUVÉES à la ligne annoncée :');
  for (const d of nonAncrees) console.log(`  ${d}`);
}

console.log('');
console.log('--- LES RETENUES, par fichier ---');
const parFichier = new Map<string, Trouvaille[]>();
for (const t of RETENUES) parFichier.set(t.fichier, [...(parFichier.get(t.fichier) ?? []), t]);
for (const [f, ts] of parFichier) {
  console.log(`\n${f} (${ts.length})`);
  for (const t of ts) console.log(`  ${t.ligne}  [${t.position}] « ${t.texte.slice(0, 70)} »`);
}
