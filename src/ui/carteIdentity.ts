/**
 * Identité visuelle des CATÉGORIES de La carte OXV (build 23).
 *
 * Couleurs d'IDENTITÉ DE LIEU — jamais de la donnée de conduite, jamais l'or
 * (réservé chrono/record). Même précédent que les catégories POI de
 * creer-route.tsx : des teintes du thème ou documentées ici, une par onglet
 * fondateur (Événements · Garages · Restaurants · Hôtels · Autres), partagées
 * par les marqueurs, les chips, la légende et les liserés des panneaux —
 * carte pilote, formulaire partenaire et validation admin ne divergent jamais.
 *
 * Pictogrammes : une LETTRE mono par catégorie (langage repère de carte,
 * zéro emoji) dans une pastille sombre cerclée de la couleur d'identité.
 */

import { palette } from '@/theme/v2';

import type { CarteCategoryKey } from '@/services/socialPingsService';

/** Couleur d'identité par onglet (documentée ci-dessus — jamais l'or). */
export const CARTE_CATEGORY_COLOR: Record<CarteCategoryKey, string> = {
  evenements: '#3FD0D8', // cyan territoire (identité, pas une vitesse)
  garages: palette.pilotAmber, // ambre atelier (#F2792B, hors QDI)
  restaurants: '#E77CB8', // rose table (custom documenté, comme le bleu « eau »)
  hotels: '#A783F2', // violet séjour (même choix catégoriel que « Col »)
  autres: palette.creamSoft, // neutre
};

/** Pictogramme mono (initiale de repère) par onglet. */
export const CARTE_CATEGORY_GLYPH: Record<CarteCategoryKey, string> = {
  evenements: 'E',
  garages: 'G',
  restaurants: 'R',
  hotels: 'H',
  autres: 'A',
};

/** Les circuits gardent leur identité crème (repère maître du territoire). */
export const CARTE_CIRCUIT_COLOR = palette.cream;
