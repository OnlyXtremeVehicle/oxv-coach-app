/**
 * Habillage « cockpit » partagé des six visualisations d'insight.
 *
 * Le langage gaming a une signature : panneau sombre (card2) cerné d'un halo
 * or discret — la donnée éclaire son boîtier d'instrument. Ce module centralise
 * ce boîtier et la couleur ambre pilote, pour que les six vizs parlent la même
 * langue sans dupliquer les valeurs.
 *
 * Doctrine : l'or est la donnée (neutre). Le rouge figé de la dimension
 * trajectory (#E63946) est réservé à la marque et à la voix du coach ; côté
 * pilote on le neutralise en ambre. dataColors reste gelé (partagé avec le site).
 */

import { theme } from '@/theme/v2';

/** Ambre pilote — remplace le rouge trajectory dans les vizs. */
export const PILOT_AMBER = '#F2792B';

/**
 * Boîtier d'instrument : matière card2, filet, et halo or léger. À étaler dans
 * le style du panneau racine de chaque viz (`{ ...cockpitPanel, padding… }`).
 */
export const cockpitPanel = {
  backgroundColor: theme.palette.card2,
  borderColor: theme.palette.line,
  borderWidth: 1,
  borderRadius: theme.radius.lg,
  shadowColor: theme.palette.gold,
  shadowOpacity: 0.07,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
} as const;
