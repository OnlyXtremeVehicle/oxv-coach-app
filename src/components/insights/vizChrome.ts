/**
 * Habillage « cockpit » partagé des six visualisations d'insight.
 *
 * Le langage gaming a une signature : panneau sombre (card2), filet, ombre
 * neutre — l'or reste réservé à la donnée, jamais au boîtier (canon §7).
 * Ce module centralise ce boîtier et la couleur ambre pilote, pour que les
 * six vizs parlent la même langue sans dupliquer les valeurs.
 *
 * Doctrine : l'or est la donnée (neutre). Le rouge de donnée #E63946 code le
 * FREINAGE (convention télémétrie, décision 2026-07-04) — distinct du rouge de
 * MARQUE #C8102E (REC/insigne). La trajectoire pilote est en ambre. dataColors
 * partagé avec le site (à mirrorer côté site pour cohérence cross-plateforme).
 */

import { theme } from '@/theme/v2';

/** Ambre pilote — remplace le rouge trajectory dans les vizs. */
export const PILOT_AMBER = theme.palette.pilotAmber;

/**
 * Boîtier d'instrument : matière card2, filet, ombre neutre. À étaler dans
 * le style du panneau racine de chaque viz (`{ ...cockpitPanel, padding… }`).
 */
export const cockpitPanel = {
  backgroundColor: theme.palette.card2,
  borderColor: theme.palette.line,
  borderWidth: 1,
  borderRadius: theme.radius.lg,
  shadowColor: '#000',
  shadowOpacity: 0.07,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 0 },
  elevation: 8,
} as const;
