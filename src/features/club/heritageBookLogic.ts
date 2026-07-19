/**
 * heritageBookLogic — plan PUR du Carnet Heritage (V2-L5 CLUB, Mission D, C3).
 *
 * Module .ts strictement pur : aucune dépendance React, React Native, Supabase
 * ou expo — testé sous ts-jest node (__tests__/heritageBookLogic.test.ts). Il
 * décide la STRUCTURE du livret (quelles pages, dans quel ordre) à partir des
 * séances Heritage RÉELLES ; le service heritageBookExportService assemble le
 * HTML et rend le PDF.
 *
 * Doctrine « données réelles » : le livret n'existe que pour le tier Heritage,
 * et compte AUTANT de pages Signature que de séances réelles — jamais une page
 * fabriquée pour atteindre un total idéal. « 4 Signatures » est la taille TYPE
 * d'un pack Heritage ; le carnet s'adapte honnêtement au nombre réel.
 */

/** Taille type d'un pack Heritage (4 séances) — repère, jamais un plancher. */
export const HERITAGE_SIGNATURE_IDEAL = 4;

/** Un pilier QDI d'une page Signature (valeur nulle = non mesurée, « — »). */
export interface HeritagePillar {
  key: string;
  label: string;
  value: number | null;
}

/** Données réelles d'une séance Heritage pour sa page Signature. */
export interface HeritageBookSessionInput {
  sessionId: string;
  /** ISO — début de la séance (ou null). */
  startedAt: string | null;
  circuitName: string | null;
  /** Meilleur tour en millisecondes (contrat chrono), ou null. */
  bestLapMs: number | null;
  lapCount: number | null;
  /** Piliers QDI mesurés (branches nulles rendues « — »). */
  pillars: HeritagePillar[];
  /** URL signée d'une photo de la séance, ou null (aucune photo). */
  photoUrl: string | null;
  /** La séance porte-t-elle une géométrie de tracé exploitable. */
  hasTrace: boolean;
}

/** Une page du livret. */
export type HeritageBookPage =
  | { kind: 'cover'; year: number; sessionCount: number }
  | { kind: 'signature'; index: number; sessionId: string }
  | { kind: 'evolution'; sessionCount: number }
  | { kind: 'colophon' };

export interface HeritageBookPlan {
  year: number;
  sessionCount: number;
  pages: HeritageBookPage[];
}

export interface HeritageBookPlanInput {
  /** Tier Heritage (gating dur). Faux → aucun livret. */
  isHeritage: boolean;
  year: number;
  /** Séances Heritage réelles, dans l'ordre du récit (chronologique). */
  sessions: readonly HeritageBookSessionInput[];
}

/**
 * Plan du Carnet Heritage, ou `null` si le carnet ne doit pas exister :
 *   - tier non Heritage → null (gating dur, section absente ailleurs) ;
 *   - aucune séance réelle → null (jamais un livret vide/fabriqué).
 *
 * Sinon : couverture (insigne or) · une page Signature PAR séance réelle · une
 * page Évolution (seulement dès 2 séances — une évolution suppose une
 * comparaison soi contre soi) · colophon. Aucune page n'est ajoutée pour
 * « remplir » : le nombre de Signatures = le nombre de séances réelles.
 */
export function planHeritageBook(input: HeritageBookPlanInput): HeritageBookPlan | null {
  if (!input.isHeritage) return null;
  const sessions = input.sessions ?? [];
  if (sessions.length === 0) return null;

  const pages: HeritageBookPage[] = [
    { kind: 'cover', year: input.year, sessionCount: sessions.length },
  ];
  sessions.forEach((s, index) => {
    pages.push({ kind: 'signature', index, sessionId: s.sessionId });
  });
  if (sessions.length >= 2) {
    pages.push({ kind: 'evolution', sessionCount: sessions.length });
  }
  pages.push({ kind: 'colophon' });

  return { year: input.year, sessionCount: sessions.length, pages };
}

/**
 * Progression de génération (0..1) rapportée au nombre de pages produites :
 * une valeur honnête pour le Dial (jamais un timer décoratif). `done` >
 * `total` est borné à 1.
 */
export function heritageBookProgress(done: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const clamped = Math.max(0, Math.min(done, total));
  return clamped / total;
}
