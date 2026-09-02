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

import { READINGS } from '@/components/insights/catalogue';
import { RAISONS } from '@/components/insights/disponibilite';
import { estPhrase, motifRefusMotCle } from '@/lib/regleMotsCles';

/**
 * LE CATALOGUE DES SIX LECTURES, ajouté le 02/09/2026 — et il aurait dû y être
 * dès l'écriture de ce fichier.
 *
 * `READINGS.court` et `READINGS.eyebrow` sont montés sur
 * `app/(app2)/data/session/[id].tsx`, feuille de données DÉCLARÉE. Ils naissent
 * dans un `.ts`, donc `check-doctrine` ne les voit pas — c'est le trou même que
 * ce fichier existe pour combler, et le catalogue n'y figurait pas.
 *
 * Ce que la mesure a rendu avant correction, sur les douze chaînes alors
 * affichées (`name` et `eyebrow`) : DOUZE refusées. Quatre `name` portaient un
 * mot outil, et DEUX `eyebrow` étaient des PHRASES au sens du brief —
 * « Niveau 4 · Cohérence du rythme » et « Niveau 4 · Transfert de charge »,
 * cinq mots chacune.
 *
 * `name` n'est PAS éprouvé ici, et c'est délibéré : depuis la décision du
 * fondateur du 30/08, le nom du catalogue reste ce qu'il est — « Potentiel
 * démontré » a été tranché le 26/08 — et c'est `court` qui s'affiche. Éprouver
 * `name` reviendrait à interdire un nom que le brief a écrit lui-même.
 */
const parCle = (champ: 'court' | 'eyebrow'): Record<string, string> =>
  Object.fromEntries(READINGS.map((r) => [r.key, r[champ]]));

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
}[] = [
  { source: 'components/insights/disponibilite.ts · RAISONS', libelles: RAISONS },
  { source: 'components/insights/catalogue.ts · READINGS.court', libelles: parCle('court') },
  { source: 'components/insights/catalogue.ts · READINGS.eyebrow', libelles: parCle('eyebrow') },
];

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
   * LE CHAMP `court` EST OBLIGATOIRE, comme sur les 65 fiches du registre.
   * Une lecture ajoutée demain sans lui afficherait son nom de catalogue sur la
   * feuille de données, et le scanner ne le verrait pas.
   */
  it('les six lectures portent toutes un `court`', () => {
    const sans = READINGS.filter(
      (r) => typeof r.court !== 'string' || r.court.trim().length === 0
    ).map((r) => r.key);
    expect(sans).toEqual([]);
    expect(READINGS).toHaveLength(6);
  });

  /**
   * ET IL NE RECOPIE PAS LE NOM. Un `court` égal au `nom` serait le mécanisme
   * désarmé en silence — c'est la même assertion que porte
   * `registreMotsCles.guard.test.ts` sur les fiches.
   */
  it('aucun `court` ne recopie le nom du catalogue', () => {
    const copies = READINGS.filter((r) => r.court === r.name).map((r) => r.key);
    expect(copies).toEqual([]);
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
