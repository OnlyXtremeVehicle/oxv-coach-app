/**
 * Logique pure de la curation coach (§10.3c B+C OXV Mirror).
 *
 * B — priorisation du bilan (virages mis en avant) ;
 * C — gabarits de commentaire réutilisables.
 *
 * Aucune dépendance Supabase / RN : module unitairement testable (Jest).
 * Voir migration 20260526240000_0039_coach_curation_templates.sql.
 */

// --- B : priorisation -------------------------------------------------------

export interface CoachPilotHighlight {
  id: string;
  coachId: string;
  pilotId: string;
  highlightCornerIndexes: number[];
  note: string | null;
  updatedAt: string;
}

export interface HighlightInput {
  highlightCornerIndexes: number[];
  note?: string | null;
}

/**
 * Bascule l'appartenance d'un virage à la liste mise en avant, en préservant
 * l'ordre : si absent, ajouté en fin (ordre de lecture) ; si présent, retiré.
 */
export function toggleCornerIndex(indexes: number[], idx: number): number[] {
  return indexes.includes(idx) ? indexes.filter((i) => i !== idx) : [...indexes, idx];
}

/** Normalise une liste de virages mis en avant : entiers ≥ 1, uniques, ordre conservé. */
export function normalizeHighlightIndexes(indexes: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const i of indexes) {
    if (Number.isInteger(i) && i >= 1 && !seen.has(i)) {
      seen.add(i);
      out.push(i);
    }
  }
  return out;
}

/** Y a-t-il une priorisation exploitable (au moins un virage ou une note) ? */
export function highlightHasContent(input: HighlightInput): boolean {
  if (normalizeHighlightIndexes(input.highlightCornerIndexes).length > 0) return true;
  return typeof input.note === 'string' && input.note.trim().length > 0;
}

// --- C : gabarits -----------------------------------------------------------

export interface CoachAnnotationTemplate {
  id: string;
  coachId: string;
  label: string;
  body: string;
  updatedAt: string;
}

export interface TemplateInput {
  label: string;
  body: string;
}

/** Valide un gabarit. Retourne un message FR sobre ou `null`. */
export function validateTemplate(input: TemplateInput): string | null {
  if (input.label.trim().length === 0) return 'Donnez un nom au gabarit.';
  if (input.label.trim().length > 60) return 'Le nom du gabarit est trop long (60 maximum).';
  if (input.body.trim().length === 0) return 'Le gabarit ne peut pas être vide.';
  if (input.body.length > 1000) return 'Le gabarit est trop long (1000 caractères maximum).';
  return null;
}
