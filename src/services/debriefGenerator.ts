/**
 * Générateur de debrief J+1 — V1 sans IA.
 *
 * Sem 13 J2. Décision (Q31) : pour le test alpha juillet 2026, on livre
 * un générateur **côté app** à partir de templates qualitatifs. Pas de
 * dépendance OpenAI, pas d'Edge Function. La narration est honnête et
 * pédagogique sans rien inventer que les données ne portent.
 *
 * La V1.1 (post-alpha) substituera une Edge Function Supabase qui appelle
 * OpenAI avec le même format de sortie (3 paragraphes séparés par "---").
 * L'écran #19 reste agnostique à la source.
 *
 * Contraintes doctrinales (testées dans __tests__/debriefGenerator.test.ts) :
 *   - Aucun verbe directif ("freinez", "accélérez", "il faut", etc.)
 *   - Vouvoiement systématique
 *   - Pas de score affiché, pas de verdict
 *   - Pas d'emoji
 *   - Format : 3 paragraphes séparés par "\n---\n" (parsé par #19)
 */

import { type MarginZone, marginZoneOf } from '@/types/domain';

import { isDoctrineSafe } from './aiSafetyFilter';
import type { SegmentAnalysisRow } from './segmentAnalysesService';

export interface DebriefInput {
  firstName: string | null | undefined;
  circuitName: string;
  sessionStartedAt: string;
  marginGlobal: number;
  marginZone: MarginZone | null;
  marginVehicle: number | null;
  marginPilot: number | null;
  /** Nombre de tours valides analysés. */
  lapCount: number;
  /** Best lap en secondes, ou null. */
  bestLapSeconds: number | null;
  /** Segments analysés (peut être vide en l'absence de trackviz). */
  segments: SegmentAnalysisRow[];
}

export interface DebriefOutput {
  /** Texte concaténé prêt à persister dans `app_session_analyses.debrief_text`. */
  text: string;
  /** Découpage utile pour le rendu direct. */
  recit: string;
  meta: string;
  preparation: string;
}

/**
 * Génère un debrief J+1 doctrinal à partir des données d'analyse.
 *
 * Conservateur par construction : si l'input est incomplet, on tombe sur
 * les phrases pédagogiques génériques (déjà présentes dans #19) au lieu
 * de meubler avec du faux quantitatif.
 */
export function generateDebrief(input: DebriefInput): DebriefOutput {
  const zone = input.marginZone ?? marginZoneOf(input.marginGlobal);
  const recit = buildRecit(input, zone);
  const meta = buildMeta(input);
  const preparation = buildPreparation(input);

  return {
    recit,
    meta,
    preparation,
    text: [recit, meta, preparation].join('\n---\n'),
  };
}

// ============================================================================
// Garde-fou doctrinal (T-1) — aucune tournure prescriptive ne sort
// ============================================================================

export interface SafeDebriefOutput extends DebriefOutput {
  /**
   * Niveau de repli déclenché par le garde-fou doctrinal :
   *   - `clean`             : sortie nominale, déjà conforme ;
   *   - `stripped-segments` : le détail segment a été retiré (un nom de virage
   *      issu de la DB portait une tournure proscrite) ;
   *   - `generic`           : filet ultime, débrief générique constant.
   */
  safety: 'clean' | 'stripped-segments' | 'generic';
}

/**
 * Débrief générique GARANTI conforme — filet de dernier recours si même la
 * version sans segments échoue au filtre (vecteur résiduel : un prénom portant
 * une tournure proscrite). Sans prénom ni détail, 100 % statique et descriptif.
 */
const GENERIC_SAFE_DEBRIEF: DebriefOutput = (() => {
  const recit =
    'Votre session est enregistrée. Les données sont là, prêtes à être relues à tête reposée.';
  const meta =
    "La progression se construit dans le temps long. Chaque sortie s'ajoute à la précédente.";
  const preparation =
    'La prochaine fois, vous pourrez observer une zone à votre rythme. Une invitation, pas une consigne.';
  return { recit, meta, preparation, text: [recit, meta, preparation].join('\n---\n') };
})();

/**
 * Variante SÛRE de `generateDebrief` : garantit qu'aucune tournure prescriptive
 * n'atteint `debrief_text`. Le générateur V1 est statique et testé conforme,
 * mais il injecte des noms de segments issus de la DB — vecteur réaliste de
 * fuite. En cas de violation, on dégrade proprement (retrait du détail segment,
 * puis débrief générique) plutôt que de publier un texte non conforme.
 *
 * C'est le garde-fou de DERNIER recours, complémentaire de la validation
 * humaine côté coach — jamais un substitut. Voir `aiSafetyFilter`.
 */
export function generateSafeDebrief(input: DebriefInput): SafeDebriefOutput {
  const full = generateDebrief(input);
  if (isDoctrineSafe(full.text)) return { ...full, safety: 'clean' };

  const noSeg = generateDebrief({ ...input, segments: [] });
  if (isDoctrineSafe(noSeg.text)) return { ...noSeg, safety: 'stripped-segments' };

  return { ...GENERIC_SAFE_DEBRIEF, safety: 'generic' };
}

// ============================================================================
// Acte 1 — Récit (description de la session)
// ============================================================================

function buildRecit(input: DebriefInput, zone: MarginZone): string {
  const opening = input.firstName ? `Hier, ${input.firstName}, ` : 'Hier, ';
  const lapPart = lapPhrase(input.lapCount, input.bestLapSeconds);
  const tonePart = toneByZone(zone);
  const detailPart = detailFromSegments(input.segments, zone);

  return `${opening}${tonePart}${lapPart}${detailPart}`.trim();
}

function toneByZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return 'vous avez piloté avec aisance. La marge restait confortable, le geste était posé. ';
    case 'yellow':
      return 'vous avez exploré. La marge était travaillée, présente sans être inconfortable. ';
    case 'red':
      return "vous avez touché vos limites. La marge s'est rétractée. ";
  }
}

function lapPhrase(lapCount: number, bestLapSeconds: number | null): string {
  if (lapCount <= 0) return '';
  const lapWord = lapCount === 1 ? 'tour' : 'tours';
  if (bestLapSeconds && bestLapSeconds > 0) {
    return `${lapCount} ${lapWord} bouclés, votre meilleur en ${formatLap(bestLapSeconds)}. `;
  }
  return `${lapCount} ${lapWord} bouclés. `;
}

function detailFromSegments(segments: SegmentAnalysisRow[], zone: MarginZone): string {
  if (segments.length === 0) return '';

  // Trouver le segment au maxGLateral (l'engagement le plus fort)
  const sortedByG = [...segments]
    .filter((s) => s.maxGLateral !== null)
    .sort((a, b) => (b.maxGLateral ?? 0) - (a.maxGLateral ?? 0));

  if (sortedByG.length === 0) return '';

  const top = sortedByG[0];
  const corner = top.segmentName ?? `virage ${top.segmentIndex}`;
  const gMax = top.maxGLateral ?? 0;

  if (zone === 'green') {
    return `Le ${corner} est passé sans accroc, avec un appui à ${gMax.toFixed(2)} g.`;
  }
  if (zone === 'yellow') {
    return `Le ${corner} a porté l'appui le plus net de la session, à ${gMax.toFixed(2)} g.`;
  }
  return `Le ${corner} a été le plus chargé, à ${gMax.toFixed(2)} g d'appui latéral.`;
}

// ============================================================================
// Acte 2 — Méta-analyse (le temps long)
// ============================================================================

function buildMeta(input: DebriefInput): string {
  const balance = balancePhrase(input.marginVehicle, input.marginPilot);
  const base =
    "La progression se construit dans le temps long. Ce que vous avez senti hier s'ajoute à ce qui vient avant.";

  if (!balance) return `${base} Continuez à regarder.`;
  return `${base} ${balance}`;
}

function balancePhrase(vehicle: number | null, pilot: number | null): string {
  if (vehicle === null || pilot === null) return '';
  const delta = vehicle - pilot;
  if (Math.abs(delta) < 8) {
    return 'Voiture et pilote se sont rejoints dans la même zone — un équilibre rare.';
  }
  if (delta > 0) {
    return 'La voiture avait encore de la marge — votre lecture du jour était la variable.';
  }
  return 'Le pilote avait plus de marge que la voiture — la machine portait son lot.';
}

// ============================================================================
// Acte 3 — Préparation (la prochaine fois, sans consigne)
// ============================================================================

function buildPreparation(input: DebriefInput): string {
  const focus = focusPhrase(input.segments);
  const ending =
    'La prochaine fois, vous pourrez peut-être explorer une seule zone, à votre rythme. Une invitation, pas une consigne.';

  if (!focus) return ending;
  return `${focus} ${ending}`;
}

function focusPhrase(segments: SegmentAnalysisRow[]): string {
  if (segments.length === 0) return '';
  // Le focus est le segment à plus faible marge — celui qui mérite l'attention
  // la plus posée. On ne nomme PAS de geste à faire — juste le lieu.
  const valid = segments.filter((s) => s.marginPercent !== null);
  if (valid.length === 0) return '';
  const sorted = [...valid].sort((a, b) => (a.marginPercent ?? 100) - (b.marginPercent ?? 100));
  const focus = sorted[0];
  const name = focus.segmentName ?? `virage ${focus.segmentIndex}`;
  return `Le ${name} reste votre terrain le plus serré pour l'instant.`;
}

// ============================================================================
// Helpers
// ============================================================================

function formatLap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
