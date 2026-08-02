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
 * Le 31/07/2026, onze hôtes ont été résolus À LA MAIN : dix répondaient,
 * `app.oxvehicle.fr` était le seul mort.
 *
 * CE COMMENTAIRE A LONGTEMPS MENTI PAR OMISSION. Il présentait ces onze noms
 * comme « les hôtes que l'application appelle » — c'était la liste d'un jour, pas
 * l'inventaire. Au 02/08/2026 la surface sortante en compte plus de trente, dont
 * `www.google.com`, `nominatim.openstreetmap.org` et `us1.locationiq.com`, qui
 * n'y ont jamais figuré. Un développeur qui suivait la consigne « refaire ce
 * contrôle quand un hôte est ajouté » travaillait donc sur un inventaire faux.
 *
 * D'où le troisième contrôle de ce fichier : l'inventaire n'est plus une phrase
 * dans un commentaire, il est DÉCLARÉ et VÉRIFIÉ. Un hôte nouveau fait échouer
 * le test, ce qui force à le nommer — et à décider s'il a sa place.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/** Hôtes établis comme n'existant pas. Un ajout ici demande une mesure, pas une intuition. */
const HOTES_MORTS = ['app.oxvehicle.fr'];

/**
 * PÉRIMÈTRE — pas seulement l'application.
 *
 * `supabase/functions` a été ajouté le 02/08/2026 : les courriels J−7 et J−1
 * envoyés aux pilotes portaient trois liens vers l'apex (`/compte`,
 * `/compte-preferences`, `/circuit`) que la garde ne voyait pas. Elle
 * s'intitulait pourtant « aucune URL ne vise l'apex » et passait au vert : une
 * affirmation sur le dépôt, vraie de deux dossiers seulement.
 */
const RACINES = ['app', 'src', 'supabase/functions'];
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

/**
 * INVENTAIRE DÉCLARÉ DES HÔTES SORTANTS.
 *
 * Tout hôte joignable depuis une chaîne du dépôt doit figurer ici. Ce n'est pas
 * une liste de contrôle décorative : un ajout non déclaré fait ÉCHOUER le test,
 * ce qui oblige à nommer le nouveau destinataire — et à se demander si une
 * application qui promet de ne rien divulguer a une raison de lui parler.
 *
 * La présence dans cette liste ne dit RIEN de la joignabilité : le test est
 * lexical, il ne résout aucun nom. Elle dit seulement « quelqu'un l'a vu passer
 * et l'a assumé ».
 */
const HOTES_DECLARES = new Set([
  // OXV
  'www.oxvehicle.fr',
  'oxvehicle.fr', // interdit en littéral d'URL (307) — toléré en prose/e-mail
  'oxv.app',
  'fouvuqkdxarjpjbqnsjq.supabase.co',
  // Cartographie, itinéraires, météo
  'api.open-meteo.com',
  'open-meteo.com',
  'overpass-api.de',
  'nominatim.openstreetmap.org',
  'api.openstreetmap.org',
  'graphhopper.com',
  'www.graphhopper.com',
  'api.kurviger.de',
  'us1.locationiq.com',
  'www.google.com',
  // Mesure d'audience et notifications
  'plausible.io',
  'exp.host',
  // Courriel et voix (fonctions serveur)
  'api.resend.com',
  'api.brevo.com',
  'api.elevenlabs.io',
  'api.openai.com',
  // Réseaux affichés sur les profils, et magasins d'applications
  'instagram.com',
  'facebook.com',
  'youtube.com',
  'open.spotify.com',
  'apps.apple.com',
  'play.google.com',
  // Chaînes de dépendances Deno / documentation citée en commentaire
  'deno.land',
  'esm.sh',
  'github.com',
  'docs.svix.com',
  // Exemples explicitement fictifs (jamais joints)
  'pay.example.com',
  'x.supabase.co',
]);

describe('garde — hôtes distants', () => {
  const sources = RACINES.flatMap(fichiersSource);

  it('trouve bien des fichiers à inspecter', () => {
    // Sans ce contrôle, une racine renommée rendrait la garde verte et vide.
    expect(sources.length).toBeGreaterThan(200);
  });

  it('aucun hôte sortant non déclaré', () => {
    const trouves = new Set<string>();
    for (const f of sources) {
      for (const m of readFileSync(f, 'utf8').matchAll(/https:\/\/([a-zA-Z0-9.-]+\.[a-z]{2,})/g)) {
        trouves.add(m[1]);
      }
    }
    const inconnus = [...trouves].filter((h) => !HOTES_DECLARES.has(h)).sort();

    // Le message d'échec DOIT nommer l'intrus : un test qui dit seulement « non »
    // se fait contourner en ajoutant l'hôte à la liste sans y penser.
    expect(inconnus).toEqual([]);
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
