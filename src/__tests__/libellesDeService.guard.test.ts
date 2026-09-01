/**
 * GARDE — les libellés qu'un SERVICE envoie sur une feuille de données.
 *
 * ===========================================================================
 * LA LIMITE DU SCANNER, ET POURQUOI ELLE NE SE COMBLE PAS PAR LUI
 * ===========================================================================
 *
 * `check-doctrine` lit les fichiers `.tsx` — les écrans. Il attrape ce qui y
 * est écrit en clair, et rien d'autre.
 *
 * Or un écran affiche aussi ce qu'un service lui donne. `disponibilite.ts` pose
 * les sept raisons d'absence des lectures approfondies ; le registre pose les
 * soixante-cinq libellés de présentation. Ces chaînes traversent un ou deux
 * modules avant d'atteindre un `<Text>`, et le scanner ne les voit jamais.
 *
 * Suivre une valeur à travers deux modules demanderait une analyse de flot que
 * ce dépôt n'a pas et n'a pas besoin d'avoir. La réponse est ailleurs : la
 * règle s'applique à la SOURCE, là où la chaîne est ÉCRITE.
 *
 * ===========================================================================
 * QUATRE DES SEPT ÉTAIENT DES PHRASES, MESURÉ LE 01/09/2026
 * ===========================================================================
 *
 *   « Aucune mesure sur cette séance »          → AUCUNE MESURE
 *   « Pas assez de tours pour comparer »        → TOURS INSUFFISANTS
 *   « Chronos de secteur non calculés »         → CHRONOS SECTEUR · NON CALCULÉS
 *   « Lecture non calculée pour cette séance »  → LECTURE NON CALCULÉE
 *
 * Et les trois autres, sans être des phrases, n'étaient pas des mots-clés : la
 * règle d'écriture demande les majuscules, et elles étaient en bas de casse.
 *
 * ===========================================================================
 * CE QU'ELLE NE COUVRE PAS
 * ===========================================================================
 *
 * Les libellés d'un service qui ne figure pas ici. C'est une liste, pas une
 * découverte — comme celle des surfaces attribuantes, et pour la même raison :
 * une garde dont on ne comprend pas la sélection ne garde rien. Un service qui
 * s'ajoute s'inscrit à la main, et le commentaire ci-dessus dit pourquoi.
 */

import { RAISONS } from '@/components/insights/disponibilite';
import { estPhrase, motifRefusMotCle } from '@/lib/regleMotsCles';

/**
 * Les jeux de libellés qu'un service envoie sur une feuille de données.
 *
 * Le registre des présentations a sa propre garde — `registreMotsCles.guard` —
 * parce qu'il porte aussi des règles qui lui sont propres (unicité, nom du
 * catalogue conservé). On ne le redouble pas ici.
 */
const JEUX: readonly {
  readonly source: string;
  readonly libelles: Readonly<Record<string, string>>;
}[] = [{ source: 'components/insights/disponibilite.ts · RAISONS', libelles: RAISONS }];

describe('les libellés de service affichés sur une feuille de données', () => {
  it('la garde a de quoi mesurer', () => {
    const total = JEUX.reduce((n, j) => n + Object.keys(j.libelles).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it.each(JEUX.map((j) => j.source))('%s — aucune phrase', (source) => {
    const jeu = JEUX.find((j) => j.source === source);
    const phrases = Object.entries(jeu?.libelles ?? {})
      .filter(([, v]) => estPhrase(v))
      .map(([k, v]) => `${k} : « ${v} »`);
    expect(phrases).toEqual([]);
  });

  it.each(JEUX.map((j) => j.source))('%s — chacun est un mot-clé valide', (source) => {
    const jeu = JEUX.find((j) => j.source === source);
    const refuses = Object.entries(jeu?.libelles ?? {})
      .map(([k, v]) => ({ k, v, motif: motifRefusMotCle(v) }))
      .filter((r) => r.motif !== null)
      .map((r) => `${r.k} : ${r.motif} — « ${r.v} »`);
    expect(refuses).toEqual([]);
  });

  /**
   * UNE SEULE FORMULATION PAR CAUSE. Deux lectures absentes pour la même raison
   * doivent le dire avec les mêmes mots — c'est ce que l'en-tête de `RAISONS`
   * promet depuis l'origine, et rien ne le vérifiait.
   *
   * Deux libellés IDENTIQUES sous deux clés différentes seraient l'inverse :
   * une même phrase pour deux causes distinctes, indiscernables à l'écran.
   */
  it.each(JEUX.map((j) => j.source))('%s — deux causes ne partagent pas un libellé', (source) => {
    const jeu = JEUX.find((j) => j.source === source);
    const vus = new Map<string, string>();
    const collisions: string[] = [];
    for (const [k, v] of Object.entries(jeu?.libelles ?? {})) {
      const deja = vus.get(v);
      if (deja !== undefined) collisions.push(`${deja} et ${k} : « ${v} »`);
      else vus.set(v, k);
    }
    expect(collisions).toEqual([]);
  });
});
