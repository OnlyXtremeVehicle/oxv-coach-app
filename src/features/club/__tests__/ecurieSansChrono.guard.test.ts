/**
 * GARDE — l'écurie ne porte aucun chrono, et ses fonctions serveur sont armées.
 *
 * ===========================================================================
 * LA RÈGLE
 * ===========================================================================
 *
 * *« Aucun chrono n'apparaît nulle part dans l'écurie. »* — plan de montage,
 * Phase 5ter, et le dossier de travail l'appuie : *« l'écurie affiche des
 * faits, jamais une mise en regard chiffrée »*.
 *
 * La raison est un problème de consentement, pas de goût : A rejoint l'écurie
 * de B, puis C la rejoint — **A et C ne se sont jamais choisis**. `are_friends()`
 * exige une acceptation des deux côtés ; l'appartenance à une écurie, non.
 * Un chrono affiché là mettrait en regard des gens qui ne l'ont pas accepté.
 *
 * ===========================================================================
 * LA GARDE LIT LE CODE, PAS LES COMMENTAIRES
 * ===========================================================================
 *
 * L'en-tête de l'écran écrit lui-même le mot « chrono » pour énoncer la règle.
 * Une recherche naïve tomberait donc sur sa propre documentation et rendrait un
 * verdict faux — ce dépôt en a payé deux ce mois-ci.
 *
 * Les commentaires sont retirés avant la recherche. Ce qui est jugé, c'est ce
 * qui s'exécute.
 */

import { readFileSync, readdirSync } from 'fs';

import { codeExecutable, codeSansCommentaires } from '@/test-utils/codeSeul';
import { join } from 'path';

const RACINE = process.cwd();

function lire(...morceaux: string[]): string {
  return readFileSync(join(RACINE, ...morceaux), 'utf8');
}

/** Le source privé de ses commentaires — blocs, lignes et JSX. */

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

function appelants(nom: string, saufFichier: string): string[] {
  const motif = new RegExp(`\\b${nom}\\s*\\(`);
  const out: string[] = [];
  for (const racine of ['app', 'src']) {
    for (const f of fichiers(join(RACINE, racine))) {
      if (f.includes(saufFichier)) continue;
      if (motif.test(codeExecutable(readFileSync(f, 'utf8')))) {
        out.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
  }
  return out;
}

/**
 * Les marqueurs de chrono. Chacun est un IDENTIFIANT ou une unité — aucun ne
 * peut apparaître par hasard dans du code français.
 */
const MARQUEURS_CHRONO: readonly string[] = [
  'formatChrono',
  'msToLapLabel',
  'bestLap',
  'best_lap',
  'lapTime',
  'lap_time',
  'durationSeconds',
  'duration_seconds',
  'speedKph',
  'km/h',
  'chrono',
];

describe('l’écurie ne porte aucun chrono', () => {
  const ECRAN = ['app', '(app2)', 'club', 'ecurie.tsx'] as const;
  const LOGIQUE = ['src', 'features', 'club', 'ecurieLogic.ts'] as const;
  const HOOK = ['src', 'features', 'club', 'useEcurie.ts'] as const;

  it.each([
    ['l’écran', ECRAN],
    ['la logique', LOGIQUE],
    ['le hook', HOOK],
  ])('%s ne porte aucun marqueur de chrono', (_nom, chemin) => {
    const code = codeExecutable(lire(...chemin)).toLowerCase();
    const trouves = MARQUEURS_CHRONO.filter((m) => code.includes(m.toLowerCase()));
    expect(trouves).toEqual([]);
  });

  /**
   * Et la garde se prouve : sur le fichier AVEC ses commentaires, le mot est
   * présent. Sans ce test, un `sansCommentaires` cassé rendrait la garde verte
   * pour la mauvaise raison — elle ne trouverait plus rien nulle part.
   */
  it('la garde ne serait pas verte par accident — le mot EXISTE dans la prose', () => {
    expect(lire(...ECRAN).toLowerCase()).toContain('chrono');
  });
});

describe('les fonctions serveur d’écurie sont armées', () => {
  /**
   * LE CŒUR. Ces deux assertions auraient échoué du 04/07 au 14/08 : les
   * fonctions existaient en production, le service les exposait, et rien ne les
   * appelait. Une écurie ne pouvait pas être nommée ; l'annuaire n'existait pas.
   */
  it('le baptême a un appelant de production', () => {
    expect(appelants('nameMyCrew', 'referralService.ts')).not.toEqual([]);
  });

  it('l’annuaire a un appelant de production', () => {
    expect(appelants('listPublicCrews', 'referralService.ts')).not.toEqual([]);
  });

  /**
   * Un service appelé par un écran que personne n'ouvre est mort de la même
   * mort. Le hub du Club doit mener à l'écurie.
   */
  it('le hub du Club ouvre réellement l’écran d’écurie', () => {
    // La route est une CHAÎNE : `codeSansCommentaires`, pas `codeExecutable`.
    const hub = codeSansCommentaires(lire('app', '(app2)', 'club', 'index.tsx'));
    // Le groupe de route fait partie du chemin : `orphelinsApp2.guard` cherche
    // `/(app2)/<route>`, et un lien sans le groupe laisserait l'écran compté
    // orphelin. Elle a attrapé exactement cela au premier jet.
    expect(hub).toContain('/(app2)/club/ecurie');
  });
});
