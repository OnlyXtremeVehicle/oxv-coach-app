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
  /** Nom court affiché. */
  name: string;
  /** Badge discret (N2 / N3 / N4, éventuellement « · 6 axes »). */
  badge: string;
  tier: InsightTier;
  /** Dimension QDI → couleur de donnée. */
  dimension: QdiDimension;
  /** Eyebrow mono (ex. « Niveau 2 · Décomposition »). Sert de sous-libellé. */
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
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'Niveau 2 · Décomposition',
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
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'Niveau 2 · Enveloppe d’adhérence',
    source:
      'Nuage de points (G longitudinal, G latéral) sur l’ensemble du tour, mesuré par l’accéléromètre.',
  },
  {
    key: 'dispersion',
    name: 'Dispersion de trajectoire',
    badge: 'N3',
    tier: 'N3',
    dimension: 'trajectory',
    eyebrow: 'Niveau 3 · Dispersion spatiale',
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
    badge: 'N3',
    tier: 'N3',
    dimension: 'accel',
    eyebrow: 'Niveau 3 · Potentiel démontré',
    source:
      'Meilleurs chronos déjà réalisés sur la séance. Aucune continuité vérifiée aux jonctions entre morceaux : jamais un tour garanti.',
  },
  {
    key: 'flow',
    name: 'Cohérence du flow',
    badge: 'N4',
    tier: 'N4',
    dimension: 'flow',
    eyebrow: 'Niveau 4 · Cohérence du rythme',
    source: 'Jerk (dérivée de l’accélération) lissé sur le tour, à partir du signal inertiel.',
  },
  {
    key: 'transfert',
    name: 'Transfert de charge',
    badge: 'N4 · 6 axes',
    tier: 'N4',
    dimension: 'accel',
    eyebrow: 'Niveau 4 · Transfert de charge',
    source:
      'Gyroscope (pitch / roll) croisé au G longitudinal et latéral : durée entre le début de l’action et la stabilisation.',
  },
];
