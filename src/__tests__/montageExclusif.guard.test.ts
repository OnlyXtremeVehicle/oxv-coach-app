/**
 * GARDE — aucun service ne survit par un SEUL écran.
 *
 * ===========================================================================
 * LA RÈGLE, ET D'OÙ ELLE VIENT
 * ===========================================================================
 *
 * *« Avant de supprimer un écran, chercher ce qu'il monte en exclusivité. »*
 * — fondateur, 14/08/2026.
 *
 * Elle est née deux fois le même jour, sur le même lot :
 *
 *   • `triage` était le SEUL montage de `PilotPreset`, donc le seul appelant de
 *     `detectBrakingPoints`. Le supprimer aurait éteint la chaîne de freinage
 *     — armée dix-huit heures plus tôt sur demande expresse ;
 *   • `lecture` est le SEUL consommateur de `coachReadingService`. Le plan le
 *     condamnait avec les trois autres ; le supprimer aurait orphelin l'unique
 *     écrivain de `coach_reading_weights`.
 *
 * Dans les deux cas, rien n'aurait cassé à la compilation. Le service serait
 * resté là, complet, testé, et sans personne pour l'appeler — la garde posée,
 * non armée, dans sa version la plus coûteuse : celle qu'on vient de créer
 * soi-même en supprimant un fichier.
 *
 * ===========================================================================
 * CE QUE CETTE GARDE FAIT
 * ===========================================================================
 *
 * Elle tient les cas NOMMÉS : les services dont on sait qu'ils tiennent à un
 * seul écran, et pour lesquels on veut être prévenu. Le jour où cet écran est
 * supprimé, la garde tombe et dit ce qui part avec lui.
 *
 * Elle n'essaie pas d'être exhaustive, et la raison est écrite plus bas — une
 * tentative a été faite, elle produisait du bruit et un faux verdict.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RACINE = process.cwd();

function fichiers(dir: string, ext: readonly string[], acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fichiers(p, ext, acc);
    } else if (ext.some((x) => e.name.endsWith(x))) {
      acc.push(p);
    }
  }
  return acc;
}

/** Pour chaque service, les fichiers qui l'importent (hors lui-même et tests). */
function consommateurs(nom: string): string[] {
  const motif = new RegExp(`from '@/services/${nom}'`);
  const out: string[] = [];
  for (const racine of ['app', 'src']) {
    for (const f of fichiers(join(RACINE, racine), ['.ts', '.tsx'])) {
      if (f.endsWith(`${nom}.ts`)) continue;
      if (motif.test(readFileSync(f, 'utf8'))) {
        out.push(f.replace(RACINE, '').split(/[\\/]/).join('/'));
      }
    }
  }
  return out;
}

/**
 * Les services dont l'unique consommateur est un écran, ET QUE L'ON SUIT.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE N'EST PAS UN RELEVÉ EXHAUSTIF
 * ---------------------------------------------------------------------------
 *
 * La première écriture de cette garde exigeait la liste COMPLÈTE. Mesuré : une
 * quarantaine de services sont adossés à leur écran — `adminAnalyticsService` à
 * `analytique`, `coachAudioService` à `annoter`, et ainsi de suite. C'est de
 * l'architecture ordinaire, pas un défaut : un service écrit pour un écran et
 * qui n'a pas vocation à servir ailleurs.
 *
 * Une liste de quarante entrées n'est pas un signal, c'est du bruit qu'on
 * finit par mettre à jour sans lire.
 *
 * J'ai aussi tenté l'invariant « aucun service sans consommateur », qui aurait
 * attrapé `ramp.ts` et `ribbon.ts`. Il en a rendu vingt-trois — dont plusieurs
 * FAUX : la détection ratait les chemins `@/services/v2/…` et les barils.
 * `liveHealthGate`, par exemple, est bien consommé. Une mesure fausse produit
 * un verdict, et ce dépôt en a déjà payé un ce mois-ci. Elle n'est pas livrée.
 *
 * Reste donc ce que cette garde prouve VRAIMENT : les deux cas du 14/08, ceux
 * où une suppression aurait coûté quelque chose de nommé.
 */
const ADOSSES_A_UN_ECRAN: Readonly<Record<string, string>> = {
  // Écrit pour l'éditeur de pondérations, et pour lui seul. Le fil de séance
  // LIT ; il n'a pas à écrire la grille du coach. Voir POINT_JALON_6 : cet
  // écran a échappé de peu à une suppression qui l'aurait orphelin.
  coachReadingService: '/app/(coach)/lecture.tsx',
};

describe('aucun service ne dépend d’un seul écran sans qu’on le sache', () => {
  it('le relevé est exact — chaque entrée a bien un unique consommateur, et c’est un écran', () => {
    for (const [nom, ecran] of Object.entries(ADOSSES_A_UN_ECRAN)) {
      const cons = consommateurs(nom);
      expect({ nom, cons }).toEqual({ nom, cons: [ecran] });
    }
  });

  /**
   * Et le cas qui a déclenché la règle : la chaîne de freinage ne doit plus
   * jamais tenir à un écran. Vérifié aussi par `chaineFreinageArmee`, ici pour
   * que la règle et son exemple vivent au même endroit.
   */
  it('le service de freinage n’est pas adossé à un écran unique', () => {
    const cons = consommateurs('brakingPointsService');
    expect(cons.some((f) => !f.startsWith('/app/'))).toBe(true);
  });
});
