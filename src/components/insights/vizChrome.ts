/**
 * Habillage « cockpit » partagé des six visualisations d'insight.
 *
 * Le langage gaming a une signature : panneau sombre (card2), filet, ombre
 * neutre — l'or reste STRICTEMENT réservé au chrono/record, jamais au boîtier
 * ni à une donnée de perf (canon §7). Ce module centralise ce boîtier et le
 * trait pilote neutre, pour que les six vizs parlent la même langue sans
 * dupliquer les valeurs.
 *
 * Doctrine V3 : l'or code le CHRONO uniquement. L'élément pilote/principal est
 * en crème (palette.cream), le secondaire/ghost en crème atténuée
 * (palette.creamMute). Les canaux de branche restent codés par dataColors :
 * freinage = rouge donnée (dataColors.brake), accélération = vert
 * (dataColors.accel), flow = jaune, trajectoire = bleu #4F9DF7
 * (dataColors.trajectory), régularité = violet. Le rouge de MARQUE #C8102E
 * (REC/insigne) ne touche jamais une donnée. dataColors partagé avec le site
 * (à mirrorer côté site pour cohérence cross-plateforme).
 */

import { theme } from '@/theme/v2';

/** Trait/point pilote principal — crème neutre (l'ambre pilote V3 est neutralisé). */
export const PILOT_AMBER = theme.palette.cream;

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
