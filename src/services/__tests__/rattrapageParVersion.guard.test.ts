/**
 * GARDE — le balayage rattrape ce qu'un moteur périmé a calculé.
 *
 * ===========================================================================
 * DEUX DÉFAUTS OPPOSÉS, À UN JOUR D'INTERVALLE
 * ===========================================================================
 *
 * **Le 14/08 au matin**, le cron excluait les séances dont `margin_global`
 * n'était pas nul. Vider les marges fabriquées aurait donc renvoyé dix séances
 * sans tours dans la file, à chaque heure, indéfiniment — une boucle infinie.
 * Corrigé : le critère est passé à l'existence de la ligne.
 *
 * **Le 14/08 après-midi**, la vérification en production a montré l'autre
 * moitié du problème. Ce critère ferme aussi le RATTRAPAGE :
 *
 *   Bouteville — la seule séance de la base portant une vraie mesure — gardait
 *   `margin_global = 39.20` et `breakdown.regularity = 0`, l'ancienne clé et
 *   l'ancienne formule, alors que le calcul livré le matin donne 51,44. La
 *   fonction tournait toutes les heures, rendait 200, traitait zéro séance.
 *
 * Et rien d'autre ne pouvait la rattraper : `analyzeAndPersistSession` n'est
 * appelée que par `rec/fin`, à la clôture. Rouvrir une séance ne recalcule pas.
 *
 * ===========================================================================
 * CE QUE LA GARDE TIENT
 * ===========================================================================
 *
 * Le critère porte sur la VERSION du moteur, dans la requête principale ET
 * dans le repli. Un repli qui l'ignorerait refermerait le rattrapage par la
 * porte de derrière — seulement quand la sous-requête échoue, donc rarement,
 * donc invisiblement. C'est exactement le piège du matin, à l'envers.
 *
 * Et `algo_version` doit être une CONSTANTE, écrite une fois : elle valait
 * `'cron-v1.0'` en dur dans la v18 comme dans la v20, après trois fabrications
 * retirées et une formule changée de nature. Deux littéraux à maintenir
 * finissent par diverger, et alors la version ment sur ce qu'elle date.
 */

import { readFileSync } from 'fs';

import { codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

const RACINE = process.cwd();

const SOURCE = readFileSync(
  join(RACINE, 'supabase', 'functions', 'cron-analyze-pending-sessions', 'index.ts'),
  'utf8'
);

/** Le code seul — commentaires de bloc ET de ligne retirés. */
const CODE = codeSansCommentaires(SOURCE);

describe('le rattrapage par version', () => {
  it('la version du moteur est une constante, écrite une fois', () => {
    expect(CODE).toMatch(/const ALGO_VERSION = '[^']+'/);
    // Aucun littéral 'cron-v…' ailleurs : deux littéraux divergent.
    const litteraux = CODE.match(/'cron-v[^']*'/g) ?? [];
    expect(litteraux).toHaveLength(1);
  });

  /**
   * LE CŒUR. Sans la version dans le critère, une ligne périmée n'est jamais
   * reprise — et aucune correction de formule ne s'appliquera plus jamais à ce
   * qui existe déjà.
   */
  it('la requête principale exclut sur la VERSION, pas sur l’existence', () => {
    expect(CODE).toMatch(
      /app_session_analyses WHERE algo_version IN \('\$\{ALGO_VERSION\}', '\$\{APP_ALGO_VERSION\}'\)/
    );
  });

  it('le repli applique le MÊME critère — sinon il referme le rattrapage', () => {
    // Le repli lit `app_session_analyses` séparément : il doit filtrer sur les
    // MÊMES versions, faute de quoi il rendrait toutes les lignes déjà
    // analysées et exclurait Bouteville à nouveau.
    expect(CODE).toMatch(/\.in\('algo_version', \[ALGO_VERSION, APP_ALGO_VERSION\]\)/);
  });

  /**
   * L'EXCLUSION AJOUTÉE LE 03/09/2026, et la mesure qui l'a rendue nécessaire.
   *
   * `upsertAnalysis` estampait `'v1.0'` — un littéral qui ne désignait aucun
   * moteur et qui différait donc TOUJOURS de `cron-v3.0`. Une séance analysée
   * par l'application redevenait éligible dans l'heure, et ce cron réécrivait
   * `margin_global` avec son propre calcul.
   *
   * Or l'analyse de l'application est la plus riche : elle a les segments
   * trackviz, que cette fonction refuse explicitement de calculer. Le cron
   * dégradait donc, à chaque ouverture de bilan.
   *
   * Les deux constantes doivent RESTER DISTINCTES : si elles devenaient égales,
   * l'exclusion cesserait de distinguer quoi que ce soit sans qu'aucun test ne
   * le voie.
   */
  it('la version de l’application est nommée, et distincte de celle du cron', () => {
    expect(CODE).toMatch(/const APP_ALGO_VERSION = 'app-v1\.0'/);
    expect(CODE).toMatch(/const ALGO_VERSION = 'cron-v3\.0'/);
  });

  /**
   * ET ELLE EST LA MÊME DES DEUX CÔTÉS. Une constante recopiée de travers
   * rouvrirait l'aller-retour en silence — c'est le seul endroit du dépôt où
   * les deux fichiers se rencontrent.
   */
  it('la constante du cron est celle que l’application écrit', () => {
    const app = readFileSync(join(RACINE, 'src', 'services', 'analysesService.ts'), 'utf8');
    expect(app).toMatch(/export const APP_ALGO_VERSION = 'app-v1\.0'/);
    expect(app).toMatch(/algo_version: APP_ALGO_VERSION/);
  });

  it('les deux écritures posent la version courante', () => {
    const ecritures = CODE.match(/algo_version: ALGO_VERSION/g) ?? [];
    // Deux : la ligne « examinée, rien à mesurer » et la ligne mesurée.
    expect(ecritures).toHaveLength(2);
  });

  /**
   * La version doit avoir BOUGÉ depuis la v20, sans quoi le mécanisme est posé
   * mais inerte : rien ne serait repris, et Bouteville resterait figée.
   */
  it('la version a changé — sinon rien n’est rattrapé', () => {
    expect(CODE).not.toMatch(/const ALGO_VERSION = 'cron-v1\.0'/);
  });

  /**
   * Et la boucle du matin ne doit pas se rouvrir : le critère ne redevient
   * jamais « la marge est-elle nulle ? ».
   */
  it('la boucle du matin reste fermée — aucun critère sur la marge', () => {
    expect(CODE).not.toMatch(/margin_global.*is\.null|is\('margin_global'/);
  });
});
