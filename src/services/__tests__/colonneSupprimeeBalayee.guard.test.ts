/**
 * GARDE — une colonne supprimée est balayée AUSSI dans le code applicatif.
 *
 * ===========================================================================
 * CE QUI S'EST PASSÉ LE 14/08/2026
 * ===========================================================================
 *
 * `users.is_admin` a été supprimée par une migration soignée : elle balaie
 * `pg_policies`, `pg_views`, `pg_indexes` et `pg_constraint` avant le DROP,
 * traite les deux triggers qui lisaient `new.is_admin`, et vérifie son travail
 * en exécutant un `UPDATE` dans un bloc annulé.
 *
 * Elle n'a jamais balayé le code de l'application.
 *
 * `adminUsersService.setUserRole` écrivait encore
 * `{ role, is_admin: role === 'admin' }` sur `users`. PostgREST refuse une
 * colonne inconnue en **PGRST204, avant d'atteindre Postgres** : depuis le
 * DROP, tout changement de rôle depuis la console d'administration échouait.
 *
 * Trois choses l'ont rendu invisible :
 *
 *   • un `as never` sur l'écriture — le compilateur ne pouvait plus refuser la
 *     colonne. Le dépôt documente déjà ce signal : *un cast sur un insert ou un
 *     update éteint exactement la vérification qui aurait aidé* ;
 *   • un garde qui court-circuite les écritures sans changement, donc l'échec
 *     ne survenait QUE lors d'un vrai changement de rôle ;
 *   • le type du profil de `useAuthStore` déclarait `is_admin: boolean` NON
 *     facultatif alors que le SELECT ne le demandait plus — TypeScript
 *     promettait un booléen là où il n'y avait plus rien.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE TIENT
 * ===========================================================================
 *
 * `is_admin` n'existe plus que sur `support_messages` (un message vient-il de
 * l'administration ?) et comme FONCTION serveur `public.is_admin()`, appelée
 * par 167 policies. Les deux sont légitimes et doivent survivre.
 *
 * Ce qui ne doit plus exister, c'est la colonne `users.is_admin` sous forme de
 * CLÉ d'objet dans un fichier qui parle de `users`. La garde lit le code privé
 * de ses commentaires — l'en-tête du service nomme la colonne pour raconter la
 * panne, et une recherche naïve tomberait sur sa propre documentation.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

const RACINE = process.cwd();

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') fichiers(p, acc);
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      acc.push(p);
    }
  }
  return acc;
}

/**
 * Les fichiers où `is_admin` reste LÉGITIME.
 *
 * `support_messages.is_admin` existe bel et bien : c'est le drapeau « ce
 * message vient de l'administration ». Le fichier de types est généré depuis
 * la base — il dit la vérité par construction, et le corriger à la main serait
 * l'inverse du travail.
 */
const LEGITIMES: readonly string[] = [
  'supportService.ts',
  'supportAdminService.ts',
  'database.types.ts',
];

/** Les usages de `is_admin` comme clé d'objet, hors fichiers légitimes. */
function clesIsAdmin(): { fichier: string; ligne: number; texte: string }[] {
  const out: { fichier: string; ligne: number; texte: string }[] = [];
  for (const racine of ['app', 'src']) {
    for (const f of fichiers(join(RACINE, racine))) {
      if (LEGITIMES.some((l) => f.endsWith(l))) continue;
      const lignes = codeSansCommentaires(readFileSync(f, 'utf8')).split('\n');
      lignes.forEach((texte, i) => {
        // `is_admin:` = une clé d'objet — lecture, écriture ou déclaration de
        // type. `is_admin()` = la fonction serveur, qui elle demeure.
        if (/\bis_admin\s*[?]?\s*:/.test(texte)) {
          out.push({
            fichier: f.replace(RACINE, '').split(/[\\/]/).join('/'),
            ligne: i + 1,
            texte: texte.trim(),
          });
        }
      });
    }
  }
  return out;
}

describe('la colonne users.is_admin a été balayée partout', () => {
  it('aucun fichier ne la porte comme clé d’objet', () => {
    expect(clesIsAdmin()).toEqual([]);
  });

  /**
   * La garde ne doit pas être verte parce qu'elle ne cherche rien. Le motif
   * DOIT trouver les usages légitimes quand on les lui présente.
   */
  it('le motif fonctionne — il trouve bien les usages légitimes', () => {
    const support = codeSansCommentaires(
      readFileSync(join(RACINE, 'src', 'services', 'supportService.ts'), 'utf8')
    );
    expect(/\bis_admin\s*[?]?\s*:/.test(support)).toBe(true);
  });

  /**
   * Et la règle générale, écrite là où elle sera relue : un cast sur une
   * écriture éteint la seule vérification qui aurait vu la colonne partir.
   */
  it('setUserRole n’écrit plus que le rôle, sans cast', () => {
    const code = codeSansCommentaires(
      readFileSync(join(RACINE, 'src', 'services', 'adminUsersService.ts'), 'utf8')
    );
    expect(code).toContain(".update({ role }).eq('id', userId)");
    expect(code).not.toMatch(/update\(\{[^}]*\}\s*as never\)[\s\S]{0,80}role/);
  });
});
