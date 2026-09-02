/**
 * Catalogue des lectures approfondies (« moteur d'insights », spec
 * docs/specs-bundle-v4/02_moteur_insights.md §2).
 *
 * Ce fichier décrit ce que CHAQUE lecture est : son nom, son niveau, sa
 * dimension QDI, et la méthode qui la produit. **Il ne porte aucune valeur.**
 *
 * Doctrine (non négociable, §0 du moteur) : chaque lecture est un CONSTAT,
 * jamais une consigne. Pas de verbe impératif côté pilote. La couleur de chaque
 * lecture = sa dimension QDI (theme.dataColors), jamais heritageGold.
 *
 * ---
 *
 * LES CHIFFRES DE DÉMONSTRATION ONT ÉTÉ RETIRÉS — jalon 2, phase 3, lot 13.
 *
 * Chaque entrée portait un `fact` et un `reading` repris des maquettes :
 * « freinage sur 95 m », « 1,12 g latéral », « 1:41.2 », « 18 tours alignés ».
 * Des valeurs fabriquées, dans le fichier que son propre en-tête appelait
 * « SOURCE UNIQUE de vérité ».
 *
 * Elles n'étaient plus rendues — l'écran de séance affiche le NIVEAU de la
 * lecture en sous-libellé. Mais elles restaient à une ligne de l'être : un
 * `sublabel={r.fact}` aurait suffi. Le dossier demande de **séparer
 * physiquement** les chiffres de démonstration du code de production, et la
 * séparation la plus sûre est l'absence.
 *
 * `src/components/insights/__tests__/catalogueSansDemo.test.ts` interdit leur
 * retour, quelle que soit la clé sous laquelle on les remettrait.
 *
 * Sont partis avec eux, parce que plus rien ne les appelait : `InsightCard`
 * (qui rendait `fact`), `sparklines`, `DEMO_NOTICE`, `DemoBanner` — un bandeau
 * défini et **monté nulle part** —, `CONSTAT_TAG`, `DOCTRINE_FOOTER`, `TIERS`,
 * `getReading`, `dimensionColor`.
 *
 * L'en-tête précédent affirmait enfin desservir `app/(app)/insights.tsx` et
 * `app/(app)/insight/[reading].tsx`. **Ces deux écrans n'existent pas.** Le seul
 * consommateur réel est `app/(app2)/data/session/[id].tsx`.
 */

/** Dimension QDI d'une lecture → couleur de donnée figée (theme.dataColors). */
export type QdiDimension = 'trajectory' | 'flow' | 'brake' | 'accel' | 'regularity';

/** Niveau de profondeur du moteur d'insights (§2). */
export type InsightTier = 'N2' | 'N3' | 'N4';

/** Clé d'une lecture. */
export type ReadingKey = 'anatomie' | 'gg' | 'dispersion' | 'tour-ideal' | 'flow' | 'transfert';

export interface ReadingDef {
  key: ReadingKey;
  /**
   * Nom du CATALOGUE. Il se lit dans un index, dans un document, dans une
   * conversation — pas sur une feuille de données.
   *
   * Mesuré le 02/09/2026 : les six `name` et les six `eyebrow` sont montés sur
   * `app/(app2)/data/session/[id].tsx`, qui est une feuille de données DÉCLARÉE
   * (`surfacesRestitution.ts`). Passés à `motifRefusMotCle`, les douze sont
   * refusés — quatre `name` portent un mot outil (« Anatomie DE virage »,
   * « Dispersion DE trajectoire », « Cohérence DU flow », « Transfert DE
   * charge »), et DEUX `eyebrow` sont des PHRASES au sens du brief :
   *
   *     « Niveau 4 · Cohérence du rythme »   5 mots, mot outil « du »
   *     « Niveau 4 · Transfert de charge »   5 mots, mot outil « de »
   *
   * Le scanner `check-doctrine` ne pouvait pas les voir : il lit les `.tsx`, et
   * ces chaînes naissent dans un `.ts`. C'est exactement le trou que
   * `libellesDeService.guard.test.ts` a été écrit pour combler, et le catalogue
   * n'y figurait pas.
   */
  name: string;
  /**
   * La forme que le pilote LIT sur une feuille de données : majuscules, `SUJET`
   * ou `SUJET · PRÉCISION`, aucun mot outil.
   *
   * Ce n'est pas une invention : la décision du fondateur du 30/08/2026 —
   * « Champ `court` obligatoire ; la phrase reste au second geste » — est déjà
   * appliquée aux soixante-cinq fiches de `registrePresentations.ts`, avec sa
   * garde. Le catalogue des six lectures suivait la même règle et n'avait pas
   * le même mécanisme ; il l'a maintenant.
   *
   * Les deux coexistent, et c'est le point : « Potentiel démontré » ne se perd
   * pas — le brief a tranché ce nom le 26/08 — il cesse seulement de s'afficher
   * là où la règle des mots-clés l'interdit.
   */
  court: string;
  /** Badge discret (N2 / N3 / N4, éventuellement « · 6 axes »). */
  badge: string;
  tier: InsightTier;
  /** Dimension QDI → couleur de donnée. */
  dimension: QdiDimension;
  /**
   * Sous-libellé mono, monté sur la même feuille de données que `court`. Il est
   * donc soumis à la même règle, et il ne l'était pas : deux des six étaient des
   * phrases. Corrigés en place — contrairement à `name`, un eyebrow n'a pas de
   * forme « de catalogue » à préserver, c'est une chaîne d'affichage et rien
   * d'autre.
   */
  eyebrow: string;
  /**
   * MÉTHODE : d'où vient la donnée, comment elle est obtenue.
   *
   * Descriptif, et **sans aucune valeur mesurée** — décrire un instrument n'est
   * pas afficher un résultat. La ligne de `dispersion` disait « 18 tours
   * alignés » : un chiffre de démonstration déguisé en méthode.
   *
   * LE SEUL CHAMP OÙ LE JARGON RESTE (arbitrage du fondateur, 26/08/2026).
   * « G longitudinal et latéral », « jerk », « gyroscope » sont ici le mot
   * juste : ce champ répond à « d'où vient ce chiffre ? », question que le
   * pilote pose APRÈS avoir lu, et le §01 du catalogue d'expérience autorise la
   * densité à ce moment-là. `name` et `eyebrow`, eux, sont lus en premier :
   * ceux-là parlent pilote, et la garde `vocabulairePilote` les surveille en
   * laissant `source` hors de sa liste de propriétés lues.
   */
  source: string;
}

/** Les six lectures. Aucune valeur ici — elles vivent dans les vues, mesurées. */
export const READINGS: ReadingDef[] = [
  {
    key: 'anatomie',
    name: 'Anatomie de virage',
    court: 'ANATOMIE · VIRAGE',
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'NIVEAU 2 · DÉCOMPOSITION',
    source:
      'Vitesse GPS, G longitudinal et latéral. Le point de corde est le minimum de vitesse coïncidant avec le pic de G latéral.',
  },
  {
    key: 'gg',
    // « G-G » → « les appuis », charte anti-jargon du catalogue d'expérience
    // (§02). Le fondateur a tranché le 26/08 : ces six lectures ne sont montées
    // que dans l'onglet Data DU PILOTE (`app/(app2)/data/session/[id].tsx`),
    // jamais dans une console coach. Un « Lab » que seul le pilote ouvre est une
    // surface pilote, et son nom est la première chose qu'il lit.
    //
    // Le mot technique n'a pas disparu du fichier : il vit dans `source`
    // ci-dessous, qui est la MÉTHODE — nommer l'instrument n'est pas afficher un
    // verdict, et le §01 autorise la densité à qui est allé la chercher.
    name: 'Appuis combinés',
    court: 'APPUIS COMBINÉS',
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'NIVEAU 2 · ENVELOPPE ADHÉRENCE',
    source:
      'Nuage de points (G longitudinal, G latéral) sur l’ensemble du tour, mesuré par l’accéléromètre.',
  },
  {
    key: 'dispersion',
    name: 'Dispersion de trajectoire',
    court: 'DISPERSION · TRAJECTOIRE',
    badge: 'N3',
    tier: 'N3',
    dimension: 'trajectory',
    eyebrow: 'NIVEAU 3 · DISPERSION SPATIALE',
    source:
      'Tours alignés sur la distance parcourue ; écart-type de la position latérale GPS en chaque point du tracé.',
  },
  {
    key: 'tour-ideal',
    // « Optimal lap → Potentiel démontré · jamais "tour garanti" » — charte
    // anti-jargon du catalogue d'expérience (§02), reprise par la fiche M10 du
    // cahier de veille : « nommer le résultat potentiel démontré ».
    //
    // Le nom précédent — « Tour idéal composé » — annonçait au pilote une
    // composition que rien dans la chaîne ne fait : le moteur de production
    // (`compute-session-insights-v3`) écrit le MEILLEUR TOUR RÉEL de la séance,
    // et le moteur app-side (`sessionInsightsEngine`) fait de même, en le
    // disant. Le mot promettait donc davantage que la donnée.
    name: 'Potentiel démontré',
    court: 'POTENTIEL DÉMONTRÉ',
    badge: 'N3',
    tier: 'N3',
    dimension: 'accel',
    eyebrow: 'NIVEAU 3 · POTENTIEL DÉMONTRÉ',
    source:
      'Meilleurs chronos déjà réalisés sur la séance. Aucune continuité vérifiée aux jonctions entre morceaux : jamais un tour garanti.',
  },
  {
    key: 'flow',
    name: 'Cohérence du flow',
    court: 'COHÉRENCE · FLOW',
    badge: 'N4',
    tier: 'N4',
    dimension: 'flow',
    eyebrow: 'NIVEAU 4 · COHÉRENCE RYTHME',
    source: 'Jerk (dérivée de l’accélération) lissé sur le tour, à partir du signal inertiel.',
  },
  {
    key: 'transfert',
    name: 'Transfert de charge',
    court: 'TRANSFERT · CHARGE',
    badge: 'N4 · 6 axes',
    tier: 'N4',
    dimension: 'accel',
    eyebrow: 'NIVEAU 4 · TRANSFERT CHARGE',
    source:
      'Gyroscope (pitch / roll) croisé au G longitudinal et latéral : durée entre le début de l’action et la stabilisation.',
  },
];
