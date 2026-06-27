/**
 * Catalogue des lectures approfondies (« moteur d'insights », spec
 * docs/specs-bundle-v4/02_moteur_insights.md §2).
 *
 * SOURCE UNIQUE de vérité partagée par la galerie (app/(app)/insights.tsx)
 * et l'écran de détail (app/(app)/insight/[reading].tsx). Pass B réutilise
 * ce catalogue tel quel : il n'ajoute QUE des composants de visualisation,
 * pas de nouvelles entrées (les six sont déjà décrites ici).
 *
 * Doctrine (non négociable, §0 du moteur) : chaque `fact` est un CONSTAT,
 * jamais une consigne. Pas de verbe impératif côté pilote. La couleur de
 * chaque lecture = sa dimension QDI (theme.dataColors), jamais heritageGold.
 *
 * ÉTAT (§3/§5 du moteur) : `telemetry_frames` est vide. Tant que la première
 * vraie capture (Valence, juillet 2026) n'a pas eu lieu, toutes les valeurs
 * ci-dessous sont des données de DÉMONSTRATION reprises des maquettes. Le
 * marqueur DEMO_NOTICE doit rester visible à l'écran.
 */

import { theme } from '@/theme/v2';

/** Dimension QDI d'une lecture → couleur de donnée figée (theme.dataColors). */
export type QdiDimension = 'trajectory' | 'flow' | 'brake' | 'accel' | 'regularity';

/** Niveau de profondeur du moteur d'insights (§2). */
export type InsightTier = 'N2' | 'N3' | 'N4';

/** Clé d'une lecture = segment d'URL de /(app)/insight/<key>. */
export type ReadingKey = 'anatomie' | 'gg' | 'dispersion' | 'tour-ideal' | 'flow' | 'transfert';

export interface ReadingDef {
  key: ReadingKey;
  /** Nom court affiché (carte + titre Geist du détail). */
  name: string;
  /** Badge discret (N2 / N3 / N4, éventuellement « · 6 axes »). */
  badge: string;
  tier: InsightTier;
  /** Dimension QDI → couleur de donnée. */
  dimension: QdiDimension;
  /** Eyebrow mono de l'écran de détail (ex. « Niveau 2 · Décomposition »). */
  eyebrow: string;
  /**
   * Constat factuel (DÉMO). Le nombre marquant est entre **double astérisques**
   * pour être rendu en mono coloré ; le reste est descriptif, jamais impératif.
   */
  fact: string;
  /** Phrase de lecture longue sur l'écran de détail (constat, pas consigne). */
  reading: string;
  /** Traçabilité : d'où vient la donnée (moteur §2, champ « Source »). */
  source: string;
}

/** Marqueur DEMO commun (état §5 : données réelles dès Valence). */
export const DEMO_NOTICE = 'Démonstration — données réelles dès Valence' as const;

/** Tag doctrinal commun sur chaque détail (refonte gg : « un constat, pas une consigne »). */
export const CONSTAT_TAG = 'Un constat, pas une consigne' as const;

/** Pied de galerie (maquette galerie). */
export const DOCTRINE_FOOTER =
  'Chaque lecture est un miroir. Elle vous montre. Elle ne vous dirige pas.' as const;

/** Les trois familles (tiers), avec leur libellé de section mono. */
export const TIERS: { id: InsightTier; label: string }[] = [
  { id: 'N2', label: 'Décomposition · les fondations' },
  { id: 'N3', label: 'Régularité · soi contre soi' },
  { id: 'N4', label: 'Signature · comportement' },
];

/**
 * Les six lectures livrées avec un écran de détail (3 viz réelles cette passe,
 * 3 placeholders complétés par Pass B). Valeurs DÉMO issues des maquettes.
 */
export const READINGS: ReadingDef[] = [
  {
    key: 'anatomie',
    name: 'Anatomie de virage',
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'Niveau 2 · Décomposition',
    fact: 'Virage 3 : freinage sur **95 m**, corde à 78 km/h, réaccél. sur 140 m.',
    reading:
      'Au virage 3 : freinage sur 95 m, de 182 à 78 km/h. Vitesse mini 78 km/h à la corde, au pic de 1,12 g latéral. Réaccélération sur 140 m jusqu’à la zone suivante.',
    source:
      'Vitesse GPS, G longitudinal et latéral, cap. Le point de corde est le minimum de vitesse coïncidant avec le pic de G latéral.',
  },
  {
    key: 'gg',
    name: 'Diagramme G-G',
    badge: 'N2',
    tier: 'N2',
    dimension: 'brake',
    eyebrow: 'Niveau 2 · Enveloppe d’adhérence',
    fact: 'Votre grip se concentre sur les **axes purs** — freiner ou tourner.',
    reading:
      'En virage pur, vous tenez 1,3 g. En freinage pur, 1,1 g. Mais quand il faut freiner et tourner ensemble — le combiné — le nuage descend à 0,7 g : les deux phases restent dissociées.',
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
    fact: 'Votre corde varie de **1,8 m** au virage 4, contre 0,3 m au virage 1.',
    reading:
      'Le virage 4 est votre point le moins reproductible : votre corde y varie de 1,8 m d’un tour à l’autre. Le virage 1 ne bouge que de 0,3 m.',
    source:
      '18 tours alignés sur la distance parcourue ; écart-type de la position latérale GPS en chaque point du tracé.',
  },
  {
    key: 'tour-ideal',
    name: 'Tour idéal composé',
    badge: 'N3',
    tier: 'N3',
    dimension: 'accel',
    eyebrow: 'Niveau 3 · Tour idéal composé',
    fact: 'Votre potentiel : **1:41.2** — 80 % de l’écart se loge dans le secteur 2.',
    reading:
      'En assemblant vos meilleurs secteurs, votre tour idéal serait 1:41.2 — soit 1,6 s sous votre meilleur tour réel. 80 % de cet écart se loge dans le secteur 2.',
    source:
      'Découpage micro-sectoriel et comparaison intra-session : meilleur secteur de chaque tour assemblé.',
  },
  {
    key: 'flow',
    name: 'Cohérence du flow',
    badge: 'N4',
    tier: 'N4',
    dimension: 'flow',
    eyebrow: 'Niveau 4 · Cohérence du rythme',
    fact: 'Vos tours les plus rapides sont vos plus **fluides**, pas les plus agressifs.',
    reading:
      'Vos tours les plus rapides sont aussi vos plus fluides — moins d’à-coups dans les transitions — et non vos plus agressifs.',
    source:
      'Jerk (dérivée de l’accélération) lissé sur le tour, à partir du signal inertiel 25 Hz.',
  },
  {
    key: 'transfert',
    name: 'Transfert de charge',
    badge: 'N4 · 6 axes',
    tier: 'N4',
    dimension: 'accel',
    eyebrow: 'Niveau 4 · Transfert de charge',
    fact: 'Votre entrée la plus progressive : le roulis s’établit en **0,4 s** au V3.',
    reading:
      'En entrée du virage 3, votre prise de roulis se stabilise en 0,4 s ; au virage 9, en 0,7 s — c’est votre entrée la plus progressive.',
    source:
      'Gyroscope (pitch / roll) croisé au G longitudinal et latéral : durée entre le début de l’action et la stabilisation.',
  },
];

/** Accès direct par clé (détail). */
export function getReading(key: string | undefined): ReadingDef | undefined {
  return READINGS.find((r) => r.key === key);
}

/**
 * Couleur de donnée QDI d'une dimension, côté pilote. Identique à
 * theme.dataColors, SAUF `trajectory` : sa couleur figée (#E63946, un rouge)
 * est réservée à la marque et à la voix du coach. On la neutralise ici en
 * ambre, sans toucher dataColors (gelé, partagé avec le site).
 */
export const PILOT_TRAJECTORY_COLOR = '#F2792B';
export function dimensionColor(dimension: QdiDimension): string {
  if (dimension === 'trajectory') return PILOT_TRAJECTORY_COLOR;
  return theme.dataColors[dimension];
}
