/**
 * GARDE — la fonction serveur calcule la MÊME chose que l'application.
 *
 * ===========================================================================
 * POURQUOI CETTE COPIE EXISTE, ET POURQUOI ELLE EST DANGEREUSE
 * ===========================================================================
 *
 * `cron-analyze-pending-sessions` tourne dans Deno. Elle ne peut rien importer
 * de `src/`. Sa version de la constance est donc une COPIE de
 * `computeRegularite`, et la copie est structurelle : on ne peut pas la
 * supprimer.
 *
 * Or c'est exactement ainsi que le défaut qu'on vient de corriger était né.
 * Deux implémentations d'une même grandeur, écrites à deux moments, dérivant
 * l'une de l'autre sans que rien ne le signale — jusqu'à ce que la même séance
 * rende 34 d'un côté et 0 de l'autre.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT DE PLUS QU'UNE GARDE LEXICALE
 * ===========================================================================
 *
 * Elle n'affirme pas que les deux textes se ressemblent. Elle **extrait la
 * fonction du fichier Deno, l'exécute**, et compare ses sorties à celles de
 * l'application sur une batterie d'entrées — dont les trois tours réels de
 * Bouteville.
 *
 * Une garde qui compare des chaînes tombe au premier reformatage et laisse
 * passer un `0.06` devenu `0.6`. Celle-ci compare des NOMBRES.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { computeRegularite } from '@/services/qdiLogic';

const CRON = join(
  process.cwd(),
  'supabase',
  'functions',
  'cron-analyze-pending-sessions',
  'index.ts'
);

const source = readFileSync(CRON, 'utf8');

/**
 * Extrait `computeConsistency` du fichier Deno et l'exécute.
 *
 * Cette fonction est pure et n'emploie aucune syntaxe propre à Deno ; seule
 * l'annotation `(v): v is number` doit être retirée pour que `new Function`
 * l'accepte. On compare ensuite des NOMBRES, pas des chaînes — une garde
 * textuelle tomberait au premier reformatage et laisserait passer un `0.06`
 * devenu `0.6`.
 */
function consistencyDuCron(laps: number[]): number | null {
  const debut = source.indexOf('function computeConsistency(');
  const fin = source.indexOf('\n}', debut);
  const brut = source.slice(debut, fin + 2);
  const corps = brut
    .slice(brut.indexOf('{') + 1, brut.lastIndexOf('}'))
    .replace(/\(v\): v is number =>/g, '(v) =>');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function('lapSeconds', corps) as (l: number[]) => number | null;
  return f(laps);
}

/** Les trois tours réels de la séance de Bouteville. */
const BOUTEVILLE = [360.485, 327.542, 339.483];

const BATTERIE: number[][] = [
  BOUTEVILLE,
  [60, 60, 60], // parfaitement constant
  [57.6, 60.0, 62.4], // 4 % sur tours courts
  [326.4, 340.0, 353.6], // 4 % sur tours longs
  [90, 91, 92, 93, 94, 95],
  [100, 130, 160], // très dispersé, au-delà de 6 %
  [95, 95.1, 94.9, 95.05],
  [60, 60], // deux tours : sous la garde
  [60], // un seul
  [],
];

describe('la fonction serveur n’a pas dérivé de l’application', () => {
  it('la fonction est bien extraite, et elle rend quelque chose', () => {
    // Une extraction ratée rendrait la garde verte sans rien comparer.
    expect(consistencyDuCron(BOUTEVILLE)).not.toBeUndefined();
  });

  it('elle rend EXACTEMENT la même valeur que `computeRegularite`', () => {
    for (const laps of BATTERIE) {
      expect({ laps, valeur: consistencyDuCron(laps) }).toEqual({
        laps,
        valeur: computeRegularite(laps),
      });
    }
  });

  /**
   * Le cas qui a tout déclenché : avant le 14/08, le serveur rendait 0 ici et
   * le QDI 34. Les deux doivent maintenant dire 34.
   */
  it('sur Bouteville, les deux disent 34 — plus 0 et 34', () => {
    expect(consistencyDuCron(BOUTEVILLE)).toBe(34);
    expect(computeRegularite(BOUTEVILLE)).toBe(34);
  });

  it('sous trois tours, les deux rendent `null` — pas un zéro', () => {
    expect(consistencyDuCron([60, 60])).toBeNull();
    expect(computeRegularite([60, 60])).toBeNull();
  });

  /**
   * L'ancien seuil absolu ne doit plus figurer dans le fichier serveur : c'est
   * lui, et non le nom de la clé, qui produisait le désaccord.
   */
  it('le seuil absolu en secondes a bien disparu du serveur', () => {
    // Les commentaires de BLOC aussi, pas seulement ceux de ligne : le 14/08,
    // l'en-tête d'`ALGO_VERSION` a cité `max_g_lateral ?? 0` pour raconter la
    // fabrication retirée, et cette garde a accusé le fichier de la porter
    // encore. Une garde qui tombe sur sa propre documentation rend un verdict
    // faux — c'est la quatrième fois de la journée.
    const codeSeul = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
    expect(codeSeul).not.toMatch(/stddev\(lapSeconds\)\s*-\s*1/);
    expect(codeSeul).toMatch(/cv\s*\/\s*0\.06|cv,\s*0,\s*0\.06/);
  });

  /**
   * La jumelle : elle applique son seuil à des g, sans dimension, et reste
   * juste. Ce qui ne l'était pas, c'est l'appelant qui fabriquait un « 0 g »
   * pour chaque tour non mesuré.
   */
  it('le serveur ne fabrique plus de 0 g pour les tours non mesurés', () => {
    // Les commentaires de BLOC aussi, pas seulement ceux de ligne : le 14/08,
    // l'en-tête d'`ALGO_VERSION` a cité `max_g_lateral ?? 0` pour raconter la
    // fabrication retirée, et cette garde a accusé le fichier de la porter
    // encore. Une garde qui tombe sur sa propre documentation rend un verdict
    // faux — c'est la quatrième fois de la journée.
    const codeSeul = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, '');
    expect(codeSeul).not.toMatch(/max_g_lateral\s*\?\?\s*0/);
  });
});
