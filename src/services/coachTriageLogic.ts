/**
 * Smart Flagging coach — TRIAGE FACTUEL des virages (Studio Coach, décision
 * fondateur 2026-07-04, cf. docs/refonte-app/VISION_COACH_STUDIO.md).
 *
 * Classe les segments d'une séance par déficit de marge (la marge la plus
 * SERRÉE en tête) pour que le coach sache où porter son débriefing en un coup
 * d'œil au stand. FAITS UNIQUEMENT (décision C3) : on désigne le virage et sa
 * marge mesurée ; la CAUSE (« réaccélération tardive ») appartient au coach, ou
 * à une suggestion IA qu'il valide — jamais affirmée ici.
 *
 * Pur, sans réseau — testé dans __tests__/coachTriageLogic.test.ts.
 */

export type TriageZone = 'green' | 'yellow' | 'red' | null;

export interface TriageSegment {
  segmentIndex: number;
  segmentName: string | null;
  marginPercent: number | null;
  marginZone: TriageZone;
}

export interface TriageCorner {
  segmentIndex: number;
  label: string;
  marginPercent: number;
  marginZone: TriageZone;
  /** Énoncé factuel (jamais une consigne). */
  fact: string;
}

function zoneLabel(zone: TriageZone): string {
  if (zone === 'green') return 'confortable';
  if (zone === 'yellow') return 'à explorer';
  if (zone === 'red') return 'terrain serré';
  return 'marge non qualifiée';
}

/**
 * Renvoie les `limit` virages au plus faible marge (les plus serrés), triés du
 * plus serré au moins serré. Ignore les segments sans marge mesurée (honnêteté).
 */
export function rankTriageCorners(segments: TriageSegment[], limit = 3): TriageCorner[] {
  const withMargin = segments.filter(
    (s): s is TriageSegment & { marginPercent: number } =>
      typeof s.marginPercent === 'number' && Number.isFinite(s.marginPercent)
  );
  const sorted = [...withMargin].sort((a, b) => a.marginPercent - b.marginPercent);
  return sorted.slice(0, Math.max(0, limit)).map((s, i) => {
    const label = s.segmentName ?? `Virage ${s.segmentIndex}`;
    const pct = Math.round(s.marginPercent);
    const rank = i === 0 ? 'la plus serrée' : 'parmi les plus serrées';
    return {
      segmentIndex: s.segmentIndex,
      label,
      marginPercent: s.marginPercent,
      marginZone: s.marginZone,
      fact: `${label} — marge ${pct} % (${zoneLabel(s.marginZone)}), ${rank} de la séance.`,
    };
  });
}
