/**
 * Logique pure des objectifs de plan coach (P-plan). SANS dépendance Supabase —
 * testable en isolation (motif qdiLogic / coachBillingLogic). Le service
 * coachObjectivesService importe et ré-exporte ce module.
 */

export type ObjectiveMetric =
  | 'regularity'
  | 'personal_best'
  | 'corner_braking'
  | 'corner_speed'
  | 'top_speed'
  | 'qualitative'
  | 'avg_lap'
  | 'lap_count'
  | 'sessions';
export type ObjectiveDirection = 'below' | 'above' | 'reach';
export type ObjectiveStatus = 'active' | 'achieved' | 'archived';

/** Libellé humain d'une métrique (factuel, jamais une consigne). */
export const METRIC_LABEL: Record<ObjectiveMetric, string> = {
  regularity: 'Régularité',
  personal_best: 'Meilleur tour',
  corner_braking: 'Freinage en virage',
  corner_speed: 'Vitesse en virage',
  top_speed: 'Vitesse de pointe',
  qualitative: 'Qualitatif',
  avg_lap: 'Tour moyen',
  lap_count: 'Nombre de tours',
  sessions: 'Séances',
};

/** Libellé de direction de cible (factuel). */
export const DIRECTION_LABEL: Record<ObjectiveDirection, string> = {
  below: 'sous',
  above: 'au-dessus de',
  reach: 'atteindre',
};

/** Ordre d'affichage des métriques dans un sélecteur. */
export const METRICS: ObjectiveMetric[] = [
  'regularity',
  'personal_best',
  'corner_speed',
  'corner_braking',
  'top_speed',
  'avg_lap',
  'lap_count',
  'sessions',
  'qualitative',
];

/**
 * Phrase factuelle décrivant la cible d'un objectif (pur, testable). Sans valeur
 * cible, seule la métrique est nommée — jamais une consigne, jamais un chiffre
 * inventé.
 */
export function objectiveTargetLabel(o: {
  metric: ObjectiveMetric;
  targetDirection: ObjectiveDirection;
  targetValue: number | null;
}): string {
  const metric = METRIC_LABEL[o.metric];
  if (o.targetValue == null) return metric;
  if (o.targetDirection === 'reach') return `${metric} · atteindre ${o.targetValue}`;
  return `${metric} · ${DIRECTION_LABEL[o.targetDirection]} ${o.targetValue}`;
}
