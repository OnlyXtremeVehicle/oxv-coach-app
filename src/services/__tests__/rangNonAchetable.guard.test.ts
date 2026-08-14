/**
 * GARDE — un lieu ne se distingue jamais par ce qu'il a payé.
 *
 * ===========================================================================
 * LA RÈGLE ET SA DATE
 * ===========================================================================
 *
 * Décision du **12 juillet 2026** : *« régie 100 % saison »*. Le modèle où un
 * partenaire achète une meilleure place est abandonné, et le dossier l'écrit
 * en toutes lettres — **un lieu ne se distingue jamais par ce qu'il a payé**.
 *
 * ===========================================================================
 * CE QUE LA MESURE A MONTRÉ LE 14/08/2026
 * ===========================================================================
 *
 * Le plan range `is_premium` parmi les gestes de SCHÉMA, donc parmi les
 * chantiers bloqués. C'est vrai de la colonne — quatre tables la portent
 * encore, et sa suppression attend un arbitrage.
 *
 * Mais l'ordre achetable, lui, vivait en TypeScript :
 *
 *     places.sort((a, b) => {
 *       if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1;
 *       ...
 *
 * Il ne demandait aucune migration pour partir. `ecosystemService` — la voie
 * qui a un consommateur réel — triait déjà par nom.
 *
 * ===========================================================================
 * CE QUE LA GARDE TIENT
 * ===========================================================================
 *
 * Aucun comparateur de tri ne consulte `isPremium` ou `is_premium`. La colonne
 * peut survivre en base et dans les types tant qu'elle n'ORDONNE rien : c'est
 * l'ordre qui vend un rang, pas la donnée.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

const TOUS = [...fichiers(join(RACINE, 'app')), ...fichiers(join(RACINE, 'src'))];

/**
 * Un comparateur de tri qui consulte le statut payant.
 *
 * On cherche `sort(` puis, dans les ~300 caractères qui suivent — la taille
 * d'un comparateur —, une mention de `isPremium` / `is_premium`. Le fichier de
 * types généré est écarté : il décrit la base, il ne trie rien.
 */
function trisAchetables(): string[] {
  const out: string[] = [];
  for (const f of TOUS) {
    if (f.endsWith('database.types.ts')) continue;
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    let i = code.indexOf('.sort(');
    while (i >= 0) {
      const bloc = code.slice(i, i + 300);
      if (/\bis_?[Pp]remium\b/.test(bloc)) {
        out.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
        break;
      }
      i = code.indexOf('.sort(', i + 1);
    }
  }
  return out;
}

describe('aucun rang ne s’achète', () => {
  it('aucun comparateur de tri ne consulte le statut payant', () => {
    expect(trisAchetables()).toEqual([]);
  });

  /**
   * La garde ne doit pas être verte pour n'avoir rien cherché : elle DOIT
   * reconnaître la forme qui vient d'être retirée.
   */
  it('le relevé reconnaît la forme d’avant', () => {
    const avant = `places.sort((a, b) => { if (a.isPremium !== b.isPremium) return a.isPremium ? -1 : 1; return 0; });`;
    const i = avant.indexOf('.sort(');
    expect(/\bis_?[Pp]remium\b/.test(avant.slice(i, i + 300))).toBe(true);
  });

  /**
   * Et un tri alphabétique ordinaire ne doit PAS être accusé — sans quoi la
   * garde ferait défaire des tris parfaitement légitimes.
   */
  it('un tri par nom n’est pas accusé', () => {
    const bon = `places.sort((a, b) => a.name.localeCompare(b.name, 'fr'));`;
    const i = bon.indexOf('.sort(');
    expect(/\bis_?[Pp]remium\b/.test(bon.slice(i, i + 300))).toBe(false);
  });
});
