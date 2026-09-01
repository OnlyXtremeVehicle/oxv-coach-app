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
import { virgule } from '@/utils/format';

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
  const meta = "Chaque sortie s'ajoute à la précédente, et la saison les tient toutes.";
  const preparation =
    'Les mesures de la séance restent consultables, tour par tour et virage par virage.';
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
  if (isDoctrineSafe(full.text, 'application')) return { ...full, safety: 'clean' };

  const noSeg = generateDebrief({ ...input, segments: [] });
  if (isDoctrineSafe(noSeg.text, 'application'))
    return { ...noSeg, safety: 'stripped-segments' };

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

/**
 * LA PHRASE D'OUVERTURE DIT LA MESURE, PAS CE QU'ELLE VAUDRAIT.
 *
 * Elle disait « vous avez piloté avec aisance », « la marge restait
 * confortable », « le geste était posé » — trois appréciations portées sur le
 * pilote, dont deux que rien ne mesure. Sur la séance de référence, une boucle
 * routière roulée de nuit avec deux arrêts, elles sortaient toutes les trois
 * parce que la marge globale de 60,4 % franchit le seuil de 30 %.
 *
 * La zone est un fait : la marge tombe dans une plage, et la plage a un nom.
 * C'est ce qu'on énonce. Le lecteur juge.
 */
function toneByZone(zone: MarginZone): string {
  switch (zone) {
    case 'green':
      return 'la marge globale se situe dans la plage haute. ';
    case 'yellow':
      return 'la marge globale se situe dans la plage intermédiaire. ';
    case 'red':
      return 'la marge globale se situe dans la plage basse. ';
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

  // Le virage au plus fort appui LATÉRAL, quelle que soit la zone. La phrase
  // était déclinée en trois versions dont la première — « passé sans accroc » —
  // jugeait un passage que la mesure ne décrit pas. Le fait est le même dans
  // les trois cas : c'est ce virage qui a porté l'appui le plus fort.
  const sujet = leOuL(corner);
  return virgule(
    `${sujet.charAt(0).toUpperCase()}${sujet.slice(1)} a porté l'appui latéral le plus fort, à ${gMax.toFixed(2)} g.`
  );
}

// ============================================================================
// Acte 2 — Méta-analyse (le temps long)
// ============================================================================

function buildMeta(input: DebriefInput): string {
  const balance = balancePhrase(input.marginVehicle, input.marginPilot);
  // « Ce que vous avez SENTI » affirmait une sensation que rien ne mesure, et
  // « Continuez à regarder » était un impératif — l'application ne demande rien.
  const base = "Chaque séance s'ajoute aux précédentes, et la saison les tient toutes.";

  if (!balance) return base;
  return `${base} ${balance}`;
}

/**
 * LES DEUX MARGES, CÔTE À CÔTE — SANS LE TRAIT QUI LES RELIAIT.
 *
 * Les trois phrases d'origine expliquaient : « votre lecture du jour était la
 * variable », « la machine portait son lot », « un équilibre rare ». La
 * première désigne une cause, la deuxième aussi, la troisième juge. La doctrine
 * pose les faits côte à côte et ne les relie pas.
 *
 * Restent les deux nombres et leur écart. C'est exactement ce que la base
 * porte.
 */
function balancePhrase(vehicle: number | null, pilot: number | null): string {
  if (vehicle === null || pilot === null) return '';
  const v = virgule(vehicle.toFixed(0));
  const p = virgule(pilot.toFixed(0));
  return `Marge véhicule ${v} %, marge pilote ${p} %.`;
}

// ============================================================================
// Acte 3 — Préparation (la prochaine fois, sans consigne)
// ============================================================================

/**
 * Le troisième acte NOMMAIT UN GESTE À FAIRE, en s'en défendant : « vous
 * pourrez peut-être explorer une seule zone… Une invitation, pas une consigne. »
 * Une phrase qui doit préciser qu'elle n'est pas une consigne en est une.
 *
 * Il ne reste que le lieu — le secteur à la marge la plus faible — et le fait
 * qu'il soit consultable. Aucun geste, aucune prochaine fois.
 */
function buildPreparation(input: DebriefInput): string {
  const focus = focusPhrase(input.segments);
  const ending = 'Les mesures de la séance restent consultables, tour par tour et virage par virage.';

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
  const marge = virgule((focus.marginPercent ?? 0).toFixed(0));
  return `La marge la plus faible de la séance se lit ${auOuALApostrophe(name)}, à ${marge} %.`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * L'ÉLISION — « Le Épingle » se lisait tel quel.
 *
 * Les noms de virage viennent de la base : « Épingle », « Esses », « Ancienne
 * chicane ». Collés derrière un article fixe, un sur trois sortait faux.
 *
 * Le `h` est traité comme une voyelle : les `h` aspirés sont rares dans un nom
 * de virage, et « l'hairpin » vaut mieux que « le Épingle ».
 */
const COMMENCE_PAR_VOYELLE = /^[aàâäeéèêëiîïoôöuùûüyh]/i;

function leOuL(nom: string): string {
  return COMMENCE_PAR_VOYELLE.test(nom) ? `l'${nom}` : `le ${nom}`;
}

function auOuALApostrophe(nom: string): string {
  return COMMENCE_PAR_VOYELLE.test(nom) ? `à l'${nom}` : `au ${nom}`;
}

function formatLap(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return virgule(`${m}:${s.toFixed(3).padStart(6, '0')}`);
}
