/**
 * GARDE R6 — jamais un écran blanc. Les cinq états, et le cinquième n'est pas
 * là où on le cherche.
 *
 * ===========================================================================
 * CE QUE « LES CINQ ÉTATS » VEUT DIRE ICI, MESURÉ ET NON SUPPOSÉ
 * ===========================================================================
 *
 * L'en-tête de `src/ui/v2/StateView.tsx` les nomme : **loading, empty, error,
 * offline**, plus l'état nominal — le contenu. Cinq.
 *
 * Mais ils ne vivent pas au même endroit, et c'est le point que cette garde
 * existe pour tenir :
 *
 *   — QUATRE sont portés par l'ÉCRAN : chargement, vide, erreur, contenu ;
 *   — le CINQUIÈME, `offline`, est GLOBAL. `app/_layout.tsx` monte
 *     `OfflineBanner` au-dessus de tout, et appelle `initNetInfo`, qui pose
 *     `setOfflineBannerVisible(!online)` sur chaque changement de réseau.
 *
 * J'ai d'abord mesuré « aucune des quatorze feuilles ne monte l'état offline »,
 * et c'était vrai à la lettre et TROMPEUR : `StateView state="offline"` ne
 * figure que dans `dev-galerie.tsx`, la galerie de composants. La couverture
 * est ailleurs, et elle est meilleure ainsi — un seul bandeau partout plutôt
 * que quatorze variantes à tenir d'accord.
 *
 * ===========================================================================
 * CE QUI EST GARDÉ, ET POURQUOI CETTE CHAÎNE-LÀ
 * ===========================================================================
 *
 * L'état hors-ligne tient à TROIS maillons, dans trois fichiers différents :
 * le bandeau monté, l'écoute réseau initialisée, et le drapeau posé. En retirer
 * un éteint le bandeau sans que rien ne le dise — l'application continue de
 * s'afficher, simplement elle ne prévient plus. C'est exactement la classe de
 * défaut de ce dépôt : celle qui ne casse rien.
 *
 * ===========================================================================
 * POURQUOI CETTE GARDE NE VÉRIFIE PAS QUE `StateView` EST MONTÉ
 * ===========================================================================
 *
 * `StateView` vit dans `src/ui/v2` — l'univers PILOTE. Les écrans de données
 * `(coach)` et `(admin)` portent leurs états avec leurs propres jetons, et
 * vérifier un composant précis reviendrait à garder une implémentation plutôt
 * qu'une règle. Cette garde vérifie que les trois états sont TRAITÉS, quelle
 * que soit la forme.
 *
 * ---------------------------------------------------------------------------
 * CORRECTION DU 03/09/2026 — CETTE SECTION AFFIRMAIT PLUS QUE LE VRAI
 * ---------------------------------------------------------------------------
 *
 * Elle disait : « les écrans `(coach)` et `(admin)` portent leurs états avec
 * leurs propres jetons, et c'est CONFORME, pas négligent ». **Trop large.**
 *
 * Vrai des écrans de données déclarés — `(admin)/analyse-session/[id].tsx`
 * emploie `@/theme/v2`, et aucun écran `(coach)` n'importe le kit pilote.
 * FAUX de la console admin en général : `app/(admin)/incidents.tsx:58` importe
 * `StateView` et l'emploie trois fois (l. 122, 126, 134).
 *
 * Ce n'est donc pas « conforme » : c'est un franchissement de R3, mesuré, l'un
 * des cinq recensés le 03/09. R3 n'est pas gardée — voir le brief. Une phrase
 * qui déclare conforme ce qui ne l'est pas est pire qu'un silence : elle ferme
 * la question.
 *
 * ===========================================================================
 * CE QU'ELLE NE COUVRE PAS
 * ===========================================================================
 *
 * Les surfaces de `src/` inscrites aux feuilles de données — `SaisonSections`,
 * `PetitsMultiples`, `NiveauxRestitution` — sont des SECTIONS montées dans un
 * écran qui porte déjà les états. `NiveauxRestitution` reçoit
 * `seance={data.etatSeance}`, déjà chargée par `data/session/[id].tsx`. Leur
 * demander leurs propres états dupliquerait ceux du parent.
 *
 * Et elle est LEXICALE : elle voit qu'un écran parle de chargement, de vide et
 * d'erreur. Elle ne monte rien, et ne prouve pas que les trois branches sont
 * atteignables. Un écran qui déclarerait les trois sans jamais les rendre lui
 * échapperait — c'est la limite, elle est écrite.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { FEUILLES_DE_DONNEES } from '@/lib/surfacesRestitution';

const RACINE = join(__dirname, '..', '..');

/**
 * Les ÉCRANS de données : les feuilles déclarées qui sont des routes.
 *
 * La liste vient de `surfacesRestitution.ts` et n'est pas recopiée ici — une
 * feuille ajoutée demain entre dans cette garde sans qu'on y pense, ce qui est
 * tout l'intérêt.
 */
const ECRANS = FEUILLES_DE_DONNEES.filter((f) => f.startsWith('app/'));

/** Les trois états que l'écran porte lui-même. Le quatrième est le contenu. */
const ETATS: { nom: string; motif: RegExp }[] = [
  {
    nom: 'chargement',
    motif: /state="loading"|state='loading'|\bloading\b|isLoading|[Cc]hargement|Shimmer|Skeleton/,
  },
  {
    nom: 'vide',
    motif: /state="empty"|state='empty'|emptyMessage|\bAucun|\baucune |\bAucune|\bvide\b|rien à/,
  },
  {
    nom: 'erreur',
    motif: /state="error"|state='error'|errorMessage|[Ee]rreur|échou|Réessayer|onRetry/,
  },
];

function lire(rel: string): string {
  return readFileSync(join(RACINE, rel), 'utf8');
}

describe('R6 — jamais un écran blanc', () => {
  it('la garde a de quoi mesurer', () => {
    // Onze écrans le 03/09/2026. Si la liste se vidait, c'est le filtre qui
    // serait cassé, pas le dépôt qui serait devenu parfait.
    expect(ECRANS.length).toBeGreaterThan(8);
  });

  /**
   * LES TROIS ÉTATS PORTÉS PAR L'ÉCRAN. Mesuré à l'écriture : les onze les
   * portent tous. Cette garde fige donc un état bon, elle ne constate pas un
   * manque.
   */
  it('chaque écran de données traite chargement, vide et erreur', () => {
    const manques: string[] = [];
    for (const ecran of ECRANS) {
      const code = lire(ecran);
      for (const e of ETATS) {
        if (!e.motif.test(code)) manques.push(`${ecran} — ${e.nom}`);
      }
    }
    expect(manques).toEqual([]);
  });

  /**
   * LE CINQUIÈME ÉTAT, ET SES TROIS MAILLONS. Retirer l'un des trois éteint le
   * bandeau hors-ligne en silence.
   */
  it('le bandeau hors-ligne est monté au-dessus de tout', () => {
    const layout = lire('app/_layout.tsx');
    expect(layout).toMatch(/<OfflineBanner\s*\/>/);
    expect(layout).toMatch(/from '@\/components\/OfflineBanner'/);
  });

  it('l’écoute réseau est initialisée par la racine', () => {
    const layout = lire('app/_layout.tsx');
    expect(layout).toMatch(/initNetInfo/);
    expect(layout).toMatch(/from '@\/lib\/netinfo'/);
  });

  it('et l’écoute réseau pose bien le drapeau du bandeau', () => {
    const net = lire('src/lib/netinfo.ts');
    expect(net).toMatch(/setOfflineBannerVisible\(/);
    // Le bandeau lit ce drapeau, et lui seul.
    expect(lire('src/components/OfflineBanner.tsx')).toMatch(/offlineBannerVisible/);
  });

  /**
   * LE CONTRE-TEST. Sans lui, les motifs pourraient ne rien reconnaître et tout
   * passerait au vert.
   */
  it('le contre-test : les trois motifs reconnaissent et discriminent', () => {
    const complet = `
      if (loading) return <StateView state="loading" />;
      if (erreur) return <StateView state="error" onRetry={recharger} />;
      if (!data.length) return <StateView state="empty" emptyMessage="Aucun tour capté." />;
    `;
    for (const e of ETATS) expect(e.motif.test(complet)).toBe(true);

    // Un écran qui ne dirait rien de ses états est bien vu comme muet.
    const muet = `export default function Ecran() { return <View><Chart data={d} /></View>; }`;
    for (const e of ETATS) expect(e.motif.test(muet)).toBe(false);
  });

  /**
   * ET LA LISTE VIENT BIEN DU MANIFESTE, pas d'une copie. Si quelqu'un
   * recopiait les chemins ici, la garde cesserait de suivre les feuilles
   * ajoutées — le défaut que la liste des orphelins a déjà payé une fois.
   */
  it('les écrans sont dérivés du manifeste des feuilles de données', () => {
    expect(FEUILLES_DE_DONNEES.length).toBeGreaterThan(ECRANS.length);
    expect(ECRANS).toContain('app/(app2)/data/session/[id].tsx');
    // Les sections de `src/` sont bien écartées : elles vivent dans un écran
    // qui porte déjà les états.
    expect(ECRANS.some((e) => e.startsWith('src/'))).toBe(false);
  });
});
