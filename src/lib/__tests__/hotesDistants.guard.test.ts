/**
 * GARDE DE SOURCE — aucun hôte mort dans le code de production.
 *
 * ---
 *
 * CE QUI EST ARRIVÉ
 *
 * `app/(coach)/ar.tsx` a chargé pendant des mois
 * `https://app.oxvehicle.fr/ar-view` dans une WebView. L'équipe du site a résolu
 * le sous-domaine le 31/07/2026 : **il n'existe pas au niveau DNS et n'a jamais
 * existé.** Ni chez le registrar, ni parmi les cinq domaines déclarés au projet
 * Vercel `oxv-site`.
 *
 * L'écran ne plantait pas — il gérait proprement l'échec et affichait « la vue
 * web arrive bientôt ». C'est précisément ce qui a permis au défaut de durer :
 * un repli soigné rend une panne permanente indiscernable d'une panne passagère.
 *
 * Arbitrage du fondateur : le sous-domaine ne sera pas créé. La WebView a donc
 * été retirée le 31/07/2026 — la vraie vue in-lens (`MetaMirror`) est native et
 * existait déjà.
 *
 * ---
 *
 * CE QUE CETTE GARDE VÉRIFIE
 *
 * Qu'aucune CHAÎNE du code de production ne nomme un hôte connu comme mort. Le
 * commentaire historique de `ar.tsx` cite l'URL en prose : c'est voulu, et la
 * garde ne regarde donc que les littéraux de chaîne — guillemets simples,
 * doubles, ou accent grave.
 *
 * ---
 *
 * CE QU'ELLE NE PROUVE PAS
 *
 * Que les autres hôtes répondent. Elle est lexicale : elle ne résout rien, elle
 * ne joint rien. Un test ne doit pas dépendre du réseau — il échouerait dans un
 * tunnel, et un test qui échoue pour une mauvaise raison finit désactivé.
 *
 * La résolution DNS a été faite À LA MAIN le 31/07/2026 sur les onze hôtes que
 * l'application appelle. Dix résolvent — `oxvehicle.fr`, `www.oxvehicle.fr`,
 * `api.open-meteo.com`, `open-meteo.com`, `overpass-api.de`, `graphhopper.com`,
 * `www.graphhopper.com`, `api.kurviger.de`, `plausible.io`,
 * `api.openstreetmap.org`. `app.oxvehicle.fr` était le seul mort.
 *
 * Refaire ce contrôle à la main quand un hôte est ajouté. Il n'y a pas de
 * substitut automatique honnête.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/** Hôtes établis comme n'existant pas. Un ajout ici demande une mesure, pas une intuition. */
const HOTES_MORTS = ['app.oxvehicle.fr'];

const RACINES = ['app', 'src'];
const IGNORES = new Set(['node_modules', 'archive', '__tests__', '.expo', 'dist']);

function fichiersSource(racine: string): string[] {
  const trouves: string[] = [];
  const parcourir = (dossier: string) => {
    let entrees: string[];
    try {
      entrees = readdirSync(dossier);
    } catch {
      return;
    }
    for (const entree of entrees) {
      if (IGNORES.has(entree)) continue;
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(entree)) trouves.push(chemin);
    }
  };
  parcourir(join(process.cwd(), racine));
  return trouves;
}

describe('garde — hôtes distants', () => {
  const sources = RACINES.flatMap(fichiersSource);

  it('trouve bien des fichiers à inspecter', () => {
    // Sans ce contrôle, une racine renommée rendrait la garde verte et vide.
    expect(sources.length).toBeGreaterThan(200);
  });

  it.each(HOTES_MORTS)('aucun littéral de chaîne ne pointe sur %s', (hote) => {
    // Le littéral seul, pas la prose : `'…hote`, `"…hote`, `` `…hote ``.
    const motif = new RegExp(`['"\`][^'"\`\\n]*${hote.replace(/\./g, '\\.')}`);
    const fautifs = sources.filter((f) => motif.test(readFileSync(f, 'utf8')));

    expect(fautifs.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
  });

  /**
   * L'APEX RENVOIE UN 307 — ON VISE `www` DIRECTEMENT.
   *
   * Mesuré le 02/08/2026 : `oxvehicle.fr` (sans `www`) répond 307 vers
   * `www.oxvehicle.fr`. Un navigateur suit la redirection sans qu'on le voie ;
   * un client configuré pour ne PAS la suivre — et `Linking.openURL` délègue à
   * des applications tierces dont on ne maîtrise pas la politique — s'arrête sur
   * le 307 et n'affiche rien.
   *
   * Le coût de viser `www` est nul. Le coût de l'apex est un lien qui marche
   * partout sauf chez quelqu'un, un jour, sans qu'on sache pourquoi.
   */
  it('aucune URL ne vise l’apex : le domaine s’écrit avec www', () => {
    // `https://oxvehicle.fr` MAIS PAS `https://www.oxvehicle.fr`. On exige donc
    // que le caractère suivant `//` ne soit pas le début de `www.`.
    const motif = /['"`]https:\/\/(?!www\.)[^'"`\n]*oxvehicle\.fr/;
    const fautifs = sources.filter((f) => motif.test(readFileSync(f, 'utf8')));

    expect(fautifs.map((f) => f.replace(process.cwd(), ''))).toEqual([]);
  });
});
