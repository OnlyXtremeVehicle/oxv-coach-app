/**
 * GARDE — une dépendance non épinglée peut rendre une fonction indéployable
 * sans que personne n'ait touché au code.
 *
 * ===========================================================================
 * CE N'EST PAS UNE PRÉCAUTION, C'EST UN INCIDENT MESURÉ
 * ===========================================================================
 *
 * Deux déploiements de `compute-session-insights-v3`, sur un code dont seul un
 * bloc avait changé, et la chronologie exacte compte — je l'avais d'abord
 * écrite fausse, « treize minutes d'intervalle », avant de la mesurer :
 *
 *     02/09  21 h 14 UTC   version 12   ACTIVE
 *     03/09  16 h 18 UTC   JSR publie @supabase/supabase-js 2.115.0
 *     03/09  ~16 h 20 UTC  REFUSÉ — « Could not find npm package
 *                            '@supabase/storage-js' matching '2.115.0' »
 *     03/09  16 h 24 UTC   version 13   ACTIVE, une fois épinglée
 *
 * Les deux déploiements sont séparés de dix-neuf heures, pas de treize minutes.
 * Ce qui compte est ailleurs : **la publication en amont date de six minutes
 * avant l'échec.** On est passé au travers d'une fenêtre qui venait de se
 * fermer, et rien de notre côté n'avait bougé.
 *
 *   — JSR a publié `@supabase/supabase-js` **2.115.0 le 03/09/2026 à
 *     16 h 18 UTC** (lu dans `jsr.io/@supabase/supabase-js/meta.json`) ;
 *   — cette version déclare une dépendance npm sur
 *     `@supabase/storage-js@2.115.0`, **qui n'a jamais été publiée** — le
 *     registre npm s'arrête à 2.114.0 en stable, et 2.115.0 n'existe qu'en
 *     `canary.0` ;
 *   — nos fonctions importaient `jsr:@supabase/supabase-js@2`, qui n'est pas
 *     une version mais une PLAGE. Elle s'est mise à résoudre vers la version
 *     cassée, d'elle-même, un dimanche après-midi.
 *
 * Mesuré à ce moment-là : **22 fonctions sur 22 étaient dans ce cas. Aucune
 * n'était épinglée.** Aucun correctif urgent n'aurait pu partir. Après
 * l'épinglage de `compute-session-insights-v3`, il en reste **vingt-et-une**.
 *
 * NOTE DE MÉTHODE, et elle vaut d'être écrite : la première version de la liste
 * ci-dessous a été TAPÉE À LA MAIN depuis un `grep` mal cadré, et sept entrées
 * étaient fausses. C'est cette garde elle-même qui l'a refusée, par son test
 * d'entrées périmées. La liste est désormais issue de la mesure.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT
 * ===========================================================================
 *
 * Elle n'exige pas zéro : épingler vingt-et-une fonctions demanderait
 * vingt-et-un déploiements, et un déploiement se décide, il ne se glisse pas
 * dans un lot. Elle fait ce que fait la liste des orphelins : elle FIGE
 * l'existant et interdit qu'il grandisse.
 *
 * Le bon geste, quand on touche une de ces fonctions : l'épingler DANS LE MÊME
 * déploiement, et la retirer de `NON_EPINGLEES` dans le même commit.
 *
 * ===========================================================================
 * POURQUOI 2.114.0 ET PAS « LA DERNIÈRE »
 * ===========================================================================
 *
 * Parce que 2.114.0 est la dernière qui se résout, et parce que « la dernière »
 * est précisément ce qui a cassé. Une version écrite est une version qu'on a
 * choisie ; une plage est une version que quelqu'un d'autre choisit pour nous,
 * plus tard, sans nous le dire.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RACINE = join(__dirname, '..', '..');
const FONCTIONS = join(RACINE, 'supabase', 'functions');

/** La version épinglée retenue le 03/09/2026 : la dernière qui se résout. */
const VERSION_RETENUE = '2.114.0';

/**
 * Les fonctions qui importent encore la PLAGE `@2`, au 03/09/2026.
 *
 * Vingt-et-une, mesurées et non recopiées. Chacune sortira de cette liste le
 * jour de son prochain déploiement — pas avant, parce qu'un déploiement se
 * décide.
 */
const NON_EPINGLEES: readonly string[] = [
  'admin-review-inscription',
  'coach-ai-draft',
  'coach-ai-validate',
  'compute-session-insights',
  'cron-analyze-pending-sessions',
  'detect-circuit-corners',
  'eligibility-reminders',
  'feedback-request',
  'generate-debrief-ai',
  'generate-invoice',
  'newsletter-push',
  'notify-admin-lead',
  'notify-coach-consent-received',
  'notify-pilot-coach-assigned',
  'pair-app',
  'send-application-ack',
  'send-booking-confirmation',
  'send-contact-ack',
  'send-document-status',
  'send-payment-confirmed',
  'validate-inscription',
];

/** Les `index.ts` de chaque fonction edge, indexés par slug. */
function sourcesParFonction(): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of readdirSync(FONCTIONS)) {
    const dossier = join(FONCTIONS, e);
    if (!statSync(dossier).isDirectory()) continue;
    const entree = join(dossier, 'index.ts');
    try {
      m.set(e, readFileSync(entree, 'utf8'));
    } catch {
      // Une fonction sans `index.ts` à la racine (sous-dossier, autre nom) :
      // elle n'entre pas dans cette mesure, et son absence se voit ici.
    }
  }
  return m;
}

/** Vrai si la source importe la PLAGE `@2` plutôt qu'une version écrite. */
function importePlage(src: string): boolean {
  return /jsr:@supabase\/supabase-js@2['"]/.test(src);
}

describe('les imports des fonctions edge', () => {
  const par = sourcesParFonction();

  it('la garde a de quoi mesurer', () => {
    expect(par.size).toBeGreaterThan(20);
  });

  /**
   * LE CLIQUET. Une fonction qui importe la plage et qui ne figure PAS dans la
   * liste est nouvelle — donc écrite après l'incident, donc sans excuse.
   */
  it('aucune fonction NEUVE n’importe la plage `@2`', () => {
    const connues = new Set(NON_EPINGLEES);
    const surprises = [...par.entries()]
      .filter(([slug, src]) => importePlage(src) && !connues.has(slug))
      .map(([slug]) => slug)
      .sort();
    expect(surprises).toEqual([]);
  });

  /**
   * ET IL SERRE DANS L'AUTRE SENS. Une entrée de la liste qui ne porte plus la
   * plage a été épinglée : il faut la retirer d'ici, sinon la liste devient un
   * inventaire périmé — le défaut que ce dépôt a déjà payé une fois.
   */
  it('aucune entrée périmée dans la liste', () => {
    const perimees = NON_EPINGLEES.filter((slug) => {
      const src = par.get(slug);
      return src !== undefined && !importePlage(src);
    });
    expect(perimees).toEqual([]);
  });

  /**
   * LA FONCTION QUI A SERVI DE DÉMONSTRATION. Elle est épinglée, et sur la
   * version qui se résout — pas sur une autre.
   */
  it('compute-session-insights-v3 est épinglée, et sur la version retenue', () => {
    const src = par.get('compute-session-insights-v3');
    expect(src).toBeDefined();
    expect(importePlage(src as string)).toBe(false);
    expect(src).toContain(`jsr:@supabase/supabase-js@${VERSION_RETENUE}`);
  });

  /**
   * ET ELLE PORTE LA RAISON. Une épingle sans son motif se fait « nettoyer »
   * par la première personne qui la prend pour une négligence.
   */
  it('l’épingle est accompagnée de la mesure qui la justifie', () => {
    const src = par.get('compute-session-insights-v3') as string;
    expect(src).toMatch(/storage-js/);
    expect(src).toMatch(/2\.115\.0/);
  });
});
