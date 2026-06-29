/**
 * PR-44 — « L'éthique peut échouer » : gardes anti-régression doctrinaux.
 *
 * Ces tests ne vérifient pas une fonctionnalité : ils REFUSENT une dérive. Si
 * l'un d'eux devient rouge, c'est qu'un garde-fou éthique a sauté et le merge
 * doit s'arrêter — pas être contourné.
 *
 * Trois lignes de défense, dérivées des chartes E1 / T6 / D7 :
 *   - E1 (progression référencée à soi) : aucune surface COMPÉTITIVE entre
 *     pilotes ne doit être branchée dans l'app, et aucune table de classement
 *     / streak / badge ne doit exister.
 *   - T6 (pas de métrique composite opaque) : aucune colonne de jugement global
 *     (score/rang/percentile agrégé du pilote) dans le schéma.
 *   - D7 (design honnête, pas d'addiction) : aucun artefact de feed infini /
 *     d'optimisation du temps passé.
 *
 * Historique : les RPC `community_circuit_leaderboard` et
 * `community_model_observatory` (qui renvoyaient un classement entre pilotes) ont
 * été SUPPRIMÉES en base le 2026-06-29 (décision Gabin, migration
 * `drop_competitive_rpcs`). Les tests ci-dessous garantissent qu'elles ne
 * réapparaissent ni dans le schéma ni dans le code applicatif.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();

/** RPC de classement supprimées : interdites de retour (schéma + app). */
const FORBIDDEN_RPCS = ['community_circuit_leaderboard', 'community_model_observatory'];

/** Jetons de schéma proscrits : jugement composite (T6) + addiction (D7). */
const FORBIDDEN_SCHEMA_TOKENS = [
  'note_globale',
  'score_global',
  'global_score',
  'qdi_score',
  'percentile',
  'vs_other_pilot',
  'pilot_rank',
  'leaderboard_rank',
  'infinite_scroll',
  'engagement_score',
  'streak_count',
];

/** Noms de TABLE compétitive proscrits (E1). */
const FORBIDDEN_TABLE_TOKENS = [
  'leaderboards',
  'rankings',
  'pilot_streaks',
  'badges',
  'trophies',
  'achievements',
];

function walk(dir: string, skip: (p: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (skip(full)) continue;
    if (e.isDirectory()) out.push(...walk(full, skip));
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

function readSchema(): string {
  return fs.readFileSync(path.join(ROOT, 'src', 'types', 'database.types.ts'), 'utf8');
}

describe('doctrine guard (PR-44 — l’éthique peut échouer)', () => {
  it('E1 — aucune surface compétitive (leaderboard / observatory) n’est branchée dans l’app', () => {
    const appFiles = walk(path.join(ROOT, 'app'), () => false);
    const srcFiles = walk(
      path.join(ROOT, 'src'),
      (p) =>
        p.includes(`${path.sep}types${path.sep}`) ||
        p.includes('__tests__') ||
        p.endsWith('database.types.ts')
    );
    const offenders: string[] = [];
    for (const f of [...appFiles, ...srcFiles]) {
      const text = fs.readFileSync(f, 'utf8');
      for (const rpc of FORBIDDEN_RPCS) {
        if (text.includes(rpc)) offenders.push(`${path.relative(ROOT, f)} → ${rpc}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('T6 / D7 — aucune colonne de jugement composite ni d’artefact d’addiction dans le schéma', () => {
    const schema = readSchema();
    const found = FORBIDDEN_SCHEMA_TOKENS.filter((t) => schema.includes(t));
    expect(found).toEqual([]);
  });

  it('E1 — aucune table de classement / streak / badge entre pilotes', () => {
    const schema = readSchema();
    // Une table est une clé indentée de 6 espaces sous `Tables:`.
    const found = FORBIDDEN_TABLE_TOKENS.filter((t) => new RegExp(`\\n {6}${t}: \\{`).test(schema));
    expect(found).toEqual([]);
  });

  it('E1 — les RPC de classement supprimées ne sont pas réapparues dans le schéma', () => {
    const schema = readSchema();
    const reappeared = FORBIDDEN_RPCS.filter((rpc) => schema.includes(rpc));
    expect(reappeared).toEqual([]);
  });
});
