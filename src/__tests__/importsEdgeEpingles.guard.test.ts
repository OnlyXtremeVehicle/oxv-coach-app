/**
 * GARDE — une dépendance non épinglée peut rendre une fonction indéployable
 * sans que personne n'ait touché au code.
 *
 * ===========================================================================
 * CE N'EST PAS UNE PRÉCAUTION, C'EST UN INCIDENT MESURÉ
 * ===========================================================================
 *
 * Deux déploiements de `compute-session-insights-v3`, sur un code dont seul un
 * bloc avait changé :
 *
 *     02/09  21 h 14 UTC   version 12   ACTIVE
 *     03/09  16 h 18 UTC   JSR publie @supabase/supabase-js 2.115.0
 *     03/09  ~16 h 20 UTC  REFUSÉ — « Could not find npm package
 *                            '@supabase/storage-js' matching '2.115.0' »
 *     03/09  16 h 24 UTC   version 13   ACTIVE, une fois épinglée
 *
 * **L'échec est tombé six minutes après la publication en amont**, et rien de
 * notre côté n'avait bougé.
 *
 * La cause : `@supabase/supabase-js` 2.115.0 déclare une dépendance sur
 * `@supabase/storage-js@2.115.0`, **qui n'a jamais été publiée** — le registre
 * npm s'arrête à 2.114.0 en stable, et 2.115.0 n'existe qu'en `canary.0`.
 *
 * ===========================================================================
 * LA CASSURE N'EST PAS PROPRE À JSR — et ma première garde l'avait manqué
 * ===========================================================================
 *
 * Cette garde, dans sa première version, ne cherchait que la forme `jsr:` et ne
 * lisait que les `index.ts` À LA RACINE de chaque fonction. Deux trous, tous
 * deux trouvés en épinglant :
 *
 *   — **sept fonctions importent la même librairie par `https://esm.sh/`**, et
 *     npm publie AUSSI 2.115.0 avec la même dépendance manquante : elles
 *     étaient exposées à l'identique ;
 *   — `ritual_dispatcher/lib/supabase.ts` est un fichier IMBRIQUÉ, invisible à
 *     un balayage qui ne regarde que la racine.
 *
 * Le compte réel n'était donc pas vingt-deux mais **vingt-huit**. Une garde qui
 * ne cherche qu'une forme d'un défaut mesure la forme, pas le défaut.
 *
 * ===========================================================================
 * CE QU'ELLE EXIGE MAINTENANT : ZÉRO
 * ===========================================================================
 *
 * Les vingt-huit sont épinglées dans le dépôt. La garde n'a donc plus de liste
 * à figer — elle refuse tout import de plage, quelle que soit sa forme.
 *
 * **ÉPINGLER LA SOURCE SUFFIT, ET C'EST LE POINT.** Les artefacts déjà déployés
 * sont bundlés : ils tournent, la publication en amont ne les touche pas. Le
 * pin agit au PROCHAIN déploiement — c'est là qu'il fallait qu'il soit, et
 * c'est là qu'il est. Redéployer vingt-huit fonctions aujourd'hui ne changerait
 * aucun comportement et demanderait vingt-huit transcriptions intégrales, donc
 * vingt-huit occasions d'erreur silencieuse.
 *
 * ===========================================================================
 * POURQUOI 2.114.0 ET PAS « LA DERNIÈRE »
 * ===========================================================================
 *
 * Parce que 2.114.0 est la dernière qui se résout, et parce que « la dernière »
 * est précisément ce qui a cassé. Une version écrite est une version qu'on a
 * choisie ; une plage est une version que quelqu'un d'autre choisit pour nous,
 * plus tard, sans nous le dire.
 *
 * Deux fichiers portaient déjà `2.45.0` par `esm.sh` — `resend_webhook` et
 * `ritual_dispatcher/lib/supabase.ts`. Ils ne sont pas alignés sur 2.114.0 : ils
 * se résolvent, ils tournent, et changer la version d'une librairie sous une
 * fonction en production est un geste qui se décide, pas un rangement.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');
const FONCTIONS = join(RACINE, 'supabase', 'functions');

/** La version retenue le 03/09/2026 : la dernière qui se résout. */
const VERSION_RETENUE = '2.114.0';

/**
 * TOUS les `.ts` sous `supabase/functions/`, y compris imbriqués.
 *
 * La récursion n'est pas un raffinement : `ritual_dispatcher/lib/supabase.ts`
 * portait un import non épinglé qu'un balayage de surface ne voyait pas.
 */
function fichiersTs(): string[] {
  const trouves: string[] = [];
  const parcourir = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (e.endsWith('.ts')) trouves.push(p);
    }
  };
  parcourir(FONCTIONS);
  return trouves;
}

/**
 * Les imports de plage d'une source, TOUTES FORMES CONFONDUES.
 *
 * Les lignes de commentaire sont écartées : ce fichier-ci et l'en-tête de v3
 * citent la plage pour expliquer l'incident, et une garde qui échouerait sur
 * son propre récit serait absurde.
 */
function importsDePlage(src: string): string[] {
  return src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .filter((l) => /(jsr:|esm\.sh\/)@supabase\/supabase-js@2['"]/.test(l))
    .map((l) => l.trim());
}

describe('les imports des fonctions edge', () => {
  const fichiers = fichiersTs();

  it('la garde a de quoi mesurer', () => {
    expect(fichiers.length).toBeGreaterThan(25);
    // Et elle voit bien les fichiers imbriqués — celui qui lui avait échappé.
    const imbrique = fichiers.some((f) => f.replace(/\\/g, '/').includes('/lib/'));
    expect(imbrique).toBe(true);
  });

  /**
   * ZÉRO PLAGE. Ni `jsr:`, ni `esm.sh/`, ni à la racine, ni imbriqué.
   */
  it('aucun import de plage `@2`, quelle que soit sa forme', () => {
    const fautifs = fichiers
      .flatMap((f) =>
        importsDePlage(readFileSync(f, 'utf8')).map(
          (l) => `${f.replace(RACINE, '').replace(/\\/g, '/')} — ${l}`
        )
      )
      .sort();
    expect(fautifs).toEqual([]);
  });

  /**
   * LE CONTRE-TEST. Sans lui, un balayage qui ne trouve rien ne prouve rien :
   * il pourrait chercher au mauvais endroit, ou avec un motif qui ne matche
   * jamais. On vérifie que la détection MARCHE, sur une ligne fabriquée.
   */
  it('le contre-test : la détection reconnaît bien une plage', () => {
    expect(
      importsDePlage("import { createClient } from 'jsr:@supabase/supabase-js@2';")
    ).toHaveLength(1);
    expect(
      importsDePlage("import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';")
    ).toHaveLength(1);
    // Et elle n'attrape PAS une version écrite, ni un commentaire.
    expect(
      importsDePlage("import { createClient } from 'jsr:@supabase/supabase-js@2.114.0';")
    ).toEqual([]);
    expect(importsDePlage("// jsr:@supabase/supabase-js@2 n'est pas une version")).toEqual([]);
  });

  /**
   * LA FONCTION QUI A SERVI DE DÉMONSTRATION, et la raison écrite à côté.
   * Une épingle sans son motif se fait « nettoyer » par la première personne
   * qui la prend pour une négligence.
   */
  it('compute-session-insights-v3 est épinglée, et porte la mesure', () => {
    const src = readFileSync(join(FONCTIONS, 'compute-session-insights-v3', 'index.ts'), 'utf8');
    expect(src).toContain(`jsr:@supabase/supabase-js@${VERSION_RETENUE}`);
    expect(src).toMatch(/storage-js/);
    expect(src).toMatch(/2\.115\.0/);
  });
});
