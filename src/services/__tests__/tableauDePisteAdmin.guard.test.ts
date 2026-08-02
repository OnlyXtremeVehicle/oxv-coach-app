/**
 * LE POSTE DE L'ADMINISTRATEUR NE CLASSE PERSONNE.
 *
 * *« Les numéros en piste sont des numéros, pas des noms. Aucun chrono, aucun
 * ordre de performance : `BOARD_MODE = 'A'`. »* — Plan de montage, Jalon 7,
 * Phase 6.
 *
 * ---
 *
 * CE QUI ÉTAIT EN PLACE
 *
 * `app/(admin)/en-cours.tsx` lisait `users(first_name, last_name)` et affichait
 * l'état civil des pilotes en roulage. Il triait par `started_at` décroissant —
 * le dernier parti en tête —, ce qui est un ordre de passage, donc une
 * hiérarchie. Et il rendait `lap_count ?? 0` sur une colonne nullable : un
 * pilote qui vient de s'élancer et un pilote dont rien n'a été mesuré
 * s'affichaient tous deux « 0 tour ».
 *
 * La règle d'ordre existait pourtant, écrite et testée
 * (`src/services/boardLogic.ts` → `compareCarNo`) : elle n'était branchée que
 * sur le roster du coach.
 *
 * ---
 *
 * CE QUE CETTE GARDE VÉRIFIE
 *
 * Lexicalement, sur la source. Elle ne rend pas l'écran ; elle empêche le
 * retour des trois formes exactes qui violaient la doctrine.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ADMIN = join(__dirname, '..', '..', '..', 'app', '(admin)');

/**
 * Le CODE, sans la prose.
 *
 * Première version : la garde lisait le fichier entier. Elle mordait donc sur
 * les commentaires qui EXPLIQUENT le défaut corrigé — « l'écran affichait
 * `users(first_name, last_name)` », « la promesse de temps réel n'était tenue
 * nulle part ». Faire disparaître ces phrases pour satisfaire un test aurait
 * effacé la mémoire de la correction ; les tolérer par une exception aurait
 * ouvert la porte à un vrai retour du défaut.
 *
 * On retire donc les commentaires avant d'inspecter. La garde devient plus
 * PRÉCISE, pas plus permissive : elle ne juge que ce qui s'exécute ou s'affiche.
 */
function codeSeul(chemin: string): string {
  const sansBlocs = readFileSync(chemin, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Ligne à ligne pour les commentaires `//` : une expression régulière portant
  // sur les fins de ligne se prête mal à l'écriture, et ce découpage se relit.
  // Le `://` d'une URL n'est pas un commentaire — d'où le test du caractère
  // précédent.
  return sansBlocs
    .split('\n')
    .map((ligne) => {
      const i = ligne.indexOf('//');
      if (i < 0) return ligne;
      if (i > 0 && ligne[i - 1] === ':') return ligne;
      return ligne.slice(0, i);
    })
    .join('\n');
}

describe('tableau de piste admin', () => {
  const source = codeSeul(join(ADMIN, 'en-cours.tsx'));

  it('lit le NUMÉRO de voiture, pas l’état civil', () => {
    expect(source).toContain('users(car_number)');
    expect(source).not.toContain('first_name');
    expect(source).not.toContain('last_name');
  });

  it('n’impose aucun ordre côté base', () => {
    // `.order('started_at', ...)` faisait du dernier parti le premier affiché.
    expect(source).not.toContain(".order('started_at'");
    // Et aucun tri par performance, sous aucune forme.
    expect(source).not.toContain("order('lap_count'");
    expect(source).not.toContain("order('best_lap");
  });

  it('ordonne par la règle unique du dépôt', () => {
    expect(source).toContain('compareCarNo');
    expect(source).toContain("from '@/services/boardLogic'");
  });

  it('ne fabrique pas un tour à partir d’une colonne nullable', () => {
    // `lap_count ?? 0` confondait « vient de partir » et « rien de mesuré ».
    expect(source).not.toContain('row.lap_count ?? 0');
    expect(source).toContain("typeof row.lap_count === 'number'");
  });

  it('ne promet pas un temps réel qui n’existe pas', () => {
    // Aucun canal n'existe dans tout `app/(admin)/` : la phrase doit dire quand
    // la donnée a été lue, pas prétendre qu'elle se met à jour seule.
    for (const ecran of ['en-cours.tsx', 'index.tsx', 'tour-controle.tsx']) {
      expect(codeSeul(join(ADMIN, ecran))).not.toMatch(/temps r[ée]el/i);
    }
  });
});
