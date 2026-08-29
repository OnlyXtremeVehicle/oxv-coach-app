/**
 * bilanLogic — logique PURE de l'écran Bilan de séance (V2-L1, écran 2/3).
 *
 * Zéro I/O, zéro React : tout se teste sous ts-jest node
 * (__tests__/bilanLogic.test.ts). Le hook useBilan orchestre les services
 * EXISTANTS et délègue chaque décision à ce module.
 *
 * Règle fondateur « données réelles câblées » : une valeur absente reste
 * absente (null / '—' / section masquée), jamais un défaut plausible.
 * Gating biométrie STRICTEMENT fail-closed (flag ET consentement ET données).
 */

import {
  arbitrerSources,
  phraseArbitrage,
  regrouperParSource,
} from '@/features/biometrie/arbitrageSources';
import type { IdSource } from '@/features/biometrie/sourcesBiometrie';
import { projectToMeters, type LatLon } from '@/circuit/circuitGenerator';
import { getCorner } from '@/lib/circuitTopology';
import { isDoctrineSafe } from '@/services/aiSafetyFilter';
import type { MarginBase } from '@/services/marginCalculator';
import { colors } from '@/ui/v2/tokens';

// ---------------------------------------------------------------------------
// HeroMorph — identifiant partagé accueil → bilan
// ---------------------------------------------------------------------------

/**
 * Identifiant HeroMorph du bloc chrono+photo qui voyage depuis l'accueil
 * Miroir (SessionCard/héros) vers l'ouverture du Bilan. L'accueil capture
 * avec CE même id ; toute désynchronisation retombe proprement sur la porte
 * (useHeroMorphTarget gère l'absence de géométrie).
 */
export function bilanHeroMorphId(sessionId: string): string {
  return `bilan-hero:${sessionId}`;
}

// ---------------------------------------------------------------------------
// Chrono — meilleur tour, record personnel
// (la garde de célébration une-seule-fois vit dans ./recordCelebration —
//  module PARTAGÉ accueil/bilan, contrat V2-L1 : une célébration par séance,
//  tous écrans confondus.)
// ---------------------------------------------------------------------------

export interface BilanLapLite {
  lap_number: number;
  duration_seconds: number;
  is_outlap?: boolean | null;
  is_inlap?: boolean | null;
}

/** Tours valides (lancés) : ni outlap, ni inlap, durée > 0. */
export function validLapsOf<T extends BilanLapLite>(laps: readonly T[]): T[] {
  return laps.filter((l) => !l.is_outlap && !l.is_inlap && l.duration_seconds > 0);
}

/**
 * Meilleur tour de la séance en MILLISECONDES (contrat ChronoHero).
 * Priorité aux tours réels ; à défaut, l'agrégat `best_lap_seconds` de la
 * session. Rien de mesuré → null (jamais un zéro d'apparence mesurée).
 */
export function bestLapMsOf(
  laps: readonly BilanLapLite[],
  sessionBestSeconds: number | null | undefined
): number | null {
  const valid = validLapsOf(laps);
  if (valid.length > 0) {
    const best = valid.reduce((m, l) => (l.duration_seconds < m.duration_seconds ? l : m));
    return Math.round(best.duration_seconds * 1000);
  }
  if (typeof sessionBestSeconds === 'number' && sessionBestSeconds > 0) {
    return Math.round(sessionBestSeconds * 1000);
  }
  return null;
}

export interface SessionChronoLite {
  id: string;
  best_lap_seconds: number | null;
}

/**
 * Record personnel : le meilleur tour de CETTE séance bat strictement le
 * meilleur de toutes les AUTRES séances closes. Soi contre soi uniquement —
 * jamais un autre pilote.
 *
 * ===========================================================================
 * CETTE FONCTION A CÉLÉBRÉ CHAQUE SÉANCE COMME UN RECORD
 * ===========================================================================
 *
 * Le filtre testait `typeof s.best_lap_seconds === 'number'`. Or PostgREST
 * sérialise `numeric` en CHAÎNE, et `fetchAllSessions` ne convertissait rien :
 * `typeof` valait `'string'` sur TOUTES les autres séances, `others` était
 * TOUJOURS vide, et la fonction tombait sur son `return true`.
 *
 * Conséquence à l'écran : flash de record et retour haptique sur chaque
 * séance, y compris la plus lente jamais roulée. Et comme `markCelebrated` est
 * posé au passage, la fausse célébration consommait la garde une-fois-par-
 * séance : un VRAI record ultérieur n'aurait plus rien déclenché.
 *
 * La conversion est réparée à la frontière (`@/lib/numeriquesPostgrest`). Mais
 * une conversion réparée ne suffit pas ici, parce que le défaut ne venait pas
 * seulement du typage :
 *
 * ===========================================================================
 * LE DÉFAUT DE PRINCIPE : ÊTRE SANS COMPARAISON N'EST PAS ÊTRE LE MEILLEUR
 * ===========================================================================
 *
 * `others.length === 0 → true` confondait deux situations opposées :
 *
 *   - « c'est votre première séance chronométrée » — le record est vrai ;
 *   - « les autres séances sont là mais aucune n'est lisible » — on ne sait
 *     rien, et l'app décidait de célébrer.
 *
 * On distingue désormais les deux. Une séance qui existe mais dont le chrono
 * ne se lit pas EMPÊCHE la célébration : l'absence de comparaison n'est pas
 * une victoire, et fabriquer une distinction est précisément ce que la
 * doctrine interdit. Le premier chrono d'un pilote reste un record.
 */
export function isPersonalRecord(
  bestLapMs: number | null,
  sessionId: string,
  allSessions: readonly SessionChronoLite[]
): boolean {
  if (bestLapMs === null || !Number.isFinite(bestLapMs) || bestLapMs <= 0) return false;

  const autres = allSessions.filter((s) => s.id !== sessionId);
  const chiffrees = autres.filter(
    (s) =>
      typeof s.best_lap_seconds === 'number' &&
      Number.isFinite(s.best_lap_seconds) &&
      (s.best_lap_seconds as number) > 0
  );

  // Aucune autre séance du tout : ce chrono est le premier, donc le meilleur.
  if (autres.length === 0) return true;
  // Des séances existent, aucune n'est lisible : on ne tranche pas.
  if (chiffrees.length === 0) return false;

  const bestOtherMs = Math.min(
    ...chiffrees.map((s) => Math.round((s.best_lap_seconds as number) * 1000))
  );
  return bestLapMs < bestOtherMs;
}

// ---------------------------------------------------------------------------
// Ligne méta — « 22 tours · 87 km »
// ---------------------------------------------------------------------------

/** Faits de séance sous le chrono. Rien de mesuré → null (ligne absente). */
export function sessionMetaLine(
  validLapCount: number,
  distanceKm: number | null | undefined
): string | null {
  const parts: string[] = [];
  if (validLapCount > 0) parts.push(`${validLapCount} ${validLapCount > 1 ? 'tours' : 'tour'}`);
  if (typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm > 0) {
    parts.push(`${Math.round(distanceKm)} km`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// Quatre piliers — branches QDI (app_session_analyses.qdi), null explicite
// ---------------------------------------------------------------------------

export const BILAN_PILLAR_KEYS = ['trajectoire', 'freinage', 'acceleration', 'fluidite'] as const;

export type BilanPillarKey = (typeof BILAN_PILLAR_KEYS)[number];

export interface BilanPillar {
  key: BilanPillarKey;
  label: string;
  /** Couleur QDI de la branche — la couleur est une donnée. */
  color: string;
  /** Valeur réelle 0-100, ou null EXPLICITE si non mesurée. */
  value: number | null;
}

const PILLAR_LABELS: Record<BilanPillarKey, string> = {
  trajectoire: 'Trajectoire',
  freinage: 'Freinage',
  acceleration: 'Accélération',
  fluidite: 'Fluidité',
};

/**
 * Les 4 piliers du Bilan (la régularité vit dans le chrono héros, pas ici —
 * même découpage que le bilan v1). Branche absente ou non finie → value null,
 * jamais un zéro : PillarBar affichera « — » et une barre vide.
 */
export function mapPillars(
  branches: Partial<Record<BilanPillarKey, number | null>> | null | undefined
): BilanPillar[] {
  return BILAN_PILLAR_KEYS.map((key) => {
    const raw = branches ? branches[key] : null;
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
    return { key, label: PILLAR_LABELS[key], color: colors.qdi[key], value };
  });
}

// ---------------------------------------------------------------------------
// Moments-clés — couleur par NATURE du moment (jamais décorative)
// ---------------------------------------------------------------------------

/**
 * reference = or Heritage (l'or ne marque QUE le chrono/record),
 * engaged = rouge de donnée (freinage/appui), variation = violet régularité.
 * Même mapping que le bilan v1, transposé aux tokens V2.
 */
export function momentColor(key: string): string {
  if (key === 'reference') return colors.heritage.gold;
  if (key === 'engaged') return colors.qdi.freinage;
  return colors.qdi.regularite;
}

// ---------------------------------------------------------------------------
// Tracé — positions curvilignes des puces (segments réels, virages réels)
// ---------------------------------------------------------------------------

export interface SegmentProgressLite {
  segmentIndex: number;
  maxGLateral: number | null;
  startProgress: number | null;
  endProgress: number | null;
}

/**
 * Abscisse curviligne (0..1) du passage le plus engagé : milieu du segment
 * au G latéral max, à partir des progress RÉELS de app_segment_analyses.
 * Segment sans position mesurée → null (pas de puce, rien d'inventé).
 */
export function engagedSegmentRatio(segments: readonly SegmentProgressLite[]): number | null {
  const withG = segments.filter((s) => typeof s.maxGLateral === 'number' && s.maxGLateral > 0);
  if (withG.length === 0) return null;
  const top = withG.reduce((m, s) => ((s.maxGLateral ?? 0) > (m.maxGLateral ?? 0) ? s : m));
  const start = top.startProgress;
  const end = top.endProgress;
  if (typeof start !== 'number' || typeof end !== 'number') return null;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start > 1 || end < 0 || end > 1) return null;
  // Segment qui enjambe la ligne (end < start) : milieu modulaire.
  const mid = end >= start ? (start + end) / 2 : ((start + end + 1) / 2) % 1;
  return mid;
}

/**
 * Abscisse curviligne (0..1) du point de la centerline le plus proche d'un
 * point GPS (apex de virage). Projection métrique équirectangulaire via
 * `projectToMeters` (circuitGenerator, réutilisé tel quel), longueur cumulée
 * sur la polyligne FERMÉE. Centerline inexploitable → null.
 */
export function centerlineRatioForLatLon(
  centerline: readonly LatLon[] | null | undefined,
  lat: number,
  lon: number
): number | null {
  if (!centerline || centerline.length < 2) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  // Projection commune (même origine) : centerline + apex en dernier point.
  const projected = projectToMeters([...centerline, { lat, lon }]);
  const apex = projected[projected.length - 1];
  const points = projected.slice(0, -1);

  let nearest = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = (points[i].x - apex.x) ** 2 + (points[i].y - apex.y) ** 2;
    if (d < bestD) {
      bestD = d;
      nearest = i;
    }
  }

  let total = 0;
  let toNearest = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (i < nearest) toNearest += len;
    total += len;
  }
  if (total <= 0) return null;
  return toNearest / total;
}

export type BilanMarkerKind = 'engaged' | 'coach' | 'focus';

export interface BilanTraceMarker {
  /** Abscisse curviligne 0..1 sur le tracé. */
  t: number;
  /** Couleur de la puce : donnée (engaged) ou OR Heritage (note du coach). */
  color: string;
  kind: BilanMarkerKind;
}

/**
 * Puces du tracé : le passage le plus engagé (données segments) + une puce
 * OR par virage annoté par le coach. Seuls les moments qui ONT une position
 * mesurable deviennent des puces — les moments de tour (référence,
 * variation) n'ont pas de position sur le tracé et restent dans la liste.
 */
export function buildTraceMarkers(args: {
  segments: readonly SegmentProgressLite[];
  annotatedCornerIndexes: readonly number[];
  centerline: readonly LatLon[] | null;
}): BilanTraceMarker[] {
  const markers: BilanTraceMarker[] = [];

  const engaged = engagedSegmentRatio(args.segments);
  if (engaged !== null) {
    markers.push({ t: engaged, color: colors.qdi.freinage, kind: 'engaged' });
  }

  const seen = new Set<number>();
  for (const index of args.annotatedCornerIndexes) {
    if (seen.has(index)) continue;
    seen.add(index);
    const corner = getCorner(index);
    if (!corner) continue;
    const t = centerlineRatioForLatLon(args.centerline, corner.apexLat, corner.apexLon);
    if (t === null) continue;
    markers.push({ t, color: colors.heritage.gold, kind: 'coach' });
  }

  return markers;
}

// ---------------------------------------------------------------------------
// Bande annotation coach — présente SEULEMENT s'il y a des notes
// ---------------------------------------------------------------------------

export interface AnnotationLite {
  id: string;
  coachId: string;
  /**
   * `null` quand la note ne porte pas sur un virage — un marqueur horodaté, ou
   * une NOTE DE SÉANCE (le bilan du coach sur la séance entière, depuis le
   * 14/08). Ces deux formes ne sont PAS des notes de virage et n'entrent pas
   * dans cette liste : `buildCoachNotes` les écarte.
   */
  cornerIndex: number | null;
  body: string;
  /** Séance rattachée — null = note GÉNÉRIQUE du coach (« Repère général »). */
  telemetrySessionId: string | null;
  /**
   * Chemin de la note vocale attachée à CE virage, ou `null`.
   *
   * P36 du catalogue : « vocal 10–20 s déclenché sur la preuve, réécoutable au
   * bon endroit ». La colonne existait, le service la rendait déjà — et ce
   * modèle la laissait tomber. Le pilote n'entendait donc que la note de
   * SÉANCE, jamais celle posée sur le virage qu'il regarde.
   *
   * FACULTATIF EN ENTRÉE, obligatoire en sortie (`CoachNoteModel`) : une source
   * qui ne connaît pas encore ce champ reste valide, et l'écran, lui, teste
   * toujours une valeur — jamais une clé absente.
   */
  audioUrl?: string | null;
}

export interface ThreadLite {
  coachId: string;
  /** Nom réel de l'autre membre du binôme (le coach, côté pilote). */
  otherName: string;
}

export interface CoachNoteModel {
  id: string;
  cornerIndex: number;
  /** Nom du virage (topologie réelle) ou « Virage N » à défaut. */
  cornerName: string;
  body: string;
  /** Nom réel du coach (binôme consenti), null si non résolu. */
  coachName: string | null;
  /**
   * Note générique du coach (telemetry_session_id NULL) : étiquetée
   * « Repère général » à l'écran — jamais présentée comme une note posée
   * SUR cette séance (la parole du coach n'est pas datée faussement).
   */
  generic: boolean;
  /** La voix du coach sur CE virage, quand elle existe (P36). */
  audioUrl: string | null;
}

/**
 * Notes du coach visibles, dans l'ordre : d'abord celles de CETTE séance
 * (par virage), puis les repères généraux (par virage), marqués `generic`.
 * Le nom du coach vient du binôme réel (coach_pilots via listMyThreads) —
 * jamais inventé : non résolu → null, l'eyebrow reste « NOTE DU COACH ».
 * Aucune note → [] : la bande est ABSENTE de l'écran.
 */
export function buildCoachNotes(
  annotations: readonly AnnotationLite[],
  threads: readonly ThreadLite[]
): CoachNoteModel[] {
  const nameByCoach = new Map(threads.map((t) => [t.coachId, t.otherName]));

  // Seules les notes DE VIRAGE entrent ici. Une note de séance et un marqueur
  // portent `cornerIndex = null` : les laisser passer donnerait « Virage null »
  // et un tri qui compare des `null`. Ils ont leur propre place.
  const surVirage = annotations.filter(
    (a): a is AnnotationLite & { cornerIndex: number } => a.cornerIndex !== null
  );

  const byCorner = (a: { cornerIndex: number }, b: { cornerIndex: number }) =>
    a.cornerIndex - b.cornerIndex;
  const specific = surVirage.filter((a) => a.telemetrySessionId !== null).sort(byCorner);
  const generic = surVirage.filter((a) => a.telemetrySessionId === null).sort(byCorner);
  return [...specific, ...generic].map((a) => ({
    id: a.id,
    cornerIndex: a.cornerIndex,
    cornerName: getCorner(a.cornerIndex)?.name ?? `Virage ${a.cornerIndex}`,
    body: a.body,
    coachName: nameByCoach.get(a.coachId) ?? null,
    generic: a.telemetrySessionId === null,
    // La voix suit sa note. `?? null` parce qu'une annotation ancienne, lue
    // avant que le champ n'existe, ne doit pas devenir `undefined` — l'écran
    // teste une valeur, pas une absence de clé.
    audioUrl: a.audioUrl ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Biométrie — gating STRICTEMENT fail-closed
// ---------------------------------------------------------------------------

/**
 * La section biométrie n'existe que si TOUT est vrai : flag serveur activé,
 * consentement de capture posé, données non vides. Le moindre doute (flag
 * indéterminé, consentement absent, zéro échantillon) → false. Pas de
 * teasing : la section est ABSENTE, pas grisée.
 */
export function biometryVisible(args: {
  flagEnabled: boolean;
  captureConsent: boolean;
  sampleCount: number;
}): boolean {
  return args.flagEnabled === true && args.captureConsent === true && args.sampleCount > 0;
}

export interface BiometryRowLite {
  /** Horodatage ISO 8601 (colonne `ts` de biometry_raw). */
  ts: string;
  hr: number;
  source: string;
  quality: number | null;
}

/**
 * Lignes base → échantillons {ts ms, hr} du BiometryStrip (invalides filtrés).
 *
 * `cleSource` EST OBLIGATOIRE DEPUIS LE LOT 10a, et ce n'était pas un oubli
 * anodin. La clé naturelle de `biometry_raw` est `(session_id, ts, source)` :
 * deux sources peuvent donc écrire sur la même séance — c'est même le cas
 * nominal d'un pilote qui porte sa montre ET enfile une ceinture au paddock.
 * Sans filtre, la sparkline mêlait deux capteurs, deux sites de mesure et deux
 * horloges, sous un badge unique. Aucun de ses points n'avait plus d'origine
 * identifiable. On ne trace donc QUE la source retenue par l'arbitrage.
 */
export function toBiometrySamples(
  rows: readonly BiometryRowLite[],
  cleSource: string
): { ts: number; hr: number }[] {
  return rows
    .filter((r) => r.source === cleSource)
    .map((r) => ({ ts: Date.parse(r.ts), hr: r.hr }))
    .filter((s) => Number.isFinite(s.ts) && Number.isFinite(s.hr) && s.hr > 0);
}

/**
 * Arbitre les sources d'une séance et rend la retenue, son badge et son motif.
 *
 * REMPLACE `biometrySourceOf`, qui posait le badge à la MAJORITÉ des lignes. Ce
 * vote-là était biaisé par construction : la ceinture rend ~1 point / s, la
 * montre ~1 point / 5 s, donc la ceinture gagnait presque toujours — non parce
 * qu'elle avait été retenue, mais parce qu'elle est plus bavarde. La règle vit
 * maintenant dans `@/features/biometrie/arbitrageSources`, elle est explicite,
 * et son motif est RENDU au pilote.
 *
 * `consentiePar` est demandé à l'appelant : ce module ne lit aucun consentement.
 */
export interface BiometrieArbitree {
  /** Clé base de la source retenue — le filtre de `toBiometrySamples`. */
  cleSource: string;
  /** Badge du BiometryStrip. */
  badge: 'montre' | 'ceinture';
  /** Phrase du motif, ou null s'il n'y a rien à expliquer (source unique). */
  motif: string | null;
}

export function arbitrerBiometrie(
  rows: readonly BiometryRowLite[],
  consentiePar: (id: IdSource) => boolean
): BiometrieArbitree | null {
  const { flux, inconnues } = regrouperParSource(rows, consentiePar);
  const arbitrage = arbitrerSources(flux, inconnues);
  if (arbitrage.retenue === null) return null;
  return {
    cleSource: arbitrage.retenue.cleBase,
    badge: arbitrage.retenue.badge,
    motif: phraseArbitrage(arbitrage),
  };
}

/** Seuils de lecture de la qualité 0-100 (computeQuality, BE-1). */
export const BIOMETRY_QUALITY_HIGH = 70;
export const BIOMETRY_QUALITY_MEDIUM = 40;

/**
 * Moyenne des qualités mesurées → étiquette du badge. Aucune qualité en
 * base → undefined (pas de badge — on n'estime rien ici).
 */
export function biometryQualityOf(
  rows: readonly Pick<BiometryRowLite, 'quality'>[]
): 'haute' | 'moyenne' | 'basse' | undefined {
  const values = rows
    .map((r) => r.quality)
    .filter((q): q is number => typeof q === 'number' && Number.isFinite(q));
  if (values.length === 0) return undefined;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean >= BIOMETRY_QUALITY_HIGH) return 'haute';
  if (mean >= BIOMETRY_QUALITY_MEDIUM) return 'moyenne';
  return 'basse';
}

// ---------------------------------------------------------------------------
// Debrief J+1 — 3 actes, garde doctrinale, repli pédagogique v1
// ---------------------------------------------------------------------------

export interface DebriefAct {
  title: string;
  body: string;
}

export type BilanDebrief =
  | {
      kind: 'generated' | 'fallback';
      acts: DebriefAct[];
    }
  | { kind: 'pending' };

/** Même convention que l'écran #19 v1 : 3 paragraphes séparés par « --- ». */
export function parseDebriefText(text: string): {
  recit: string;
  meta: string;
  preparation: string;
} {
  const parts = text
    .split(/\n\s*---\s*\n|\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return { recit: parts[0] ?? '', meta: parts[1] ?? '', preparation: parts[2] ?? '' };
}

// Repli pédagogique v1 (écran #19) — descriptif, vouvoyé, jamais prescriptif.
// Tournures ÉPICÈNES uniquement (clientèle vouvoyée, aucun accord genré).
function fallbackRecit(marginGlobal: number | null, firstName: string | null | undefined): string {
  const opening = firstName ? `Lors de cette séance, ${firstName}, ` : 'Lors de cette séance, ';
  // Marge NON mesurée (margin_global NULL en base) : aucun récit d'intensité
  // n'est fabriqué depuis une valeur inexistante — repli neutre, sans chiffre
  // ni qualification (règle données réelles).
  if (marginGlobal === null) {
    return `${opening}vous avez roulé. La marge n'a pas été mesurée : le récit s'en tient à ce qui a été observé.`;
  }
  if (marginGlobal >= 30) {
    return `${opening}vous avez piloté avec aisance. La marge restait confortable, le geste était posé. Une séance qu'on aimerait reproduire.`;
  }
  if (marginGlobal >= 15) {
    return `${opening}vous avez exploré. La marge était travaillée, présente sans être inconfortable. Quelque chose a bougé dans certains virages.`;
  }
  // « marge » plutôt que « limite » — vocabulaire OXV (Principe 1).
  return `${opening}vous avez cherché loin. La marge s'est rétractée. Une séance dense, à digérer avant de revenir.`;
}

function fallbackMeta(): string {
  return "La progression se construit dans le temps long. Ce que vous avez senti s'ajoute à ce qui vient avant. Continuez à regarder.";
}

function fallbackPreparation(): string {
  return 'La prochaine fois, vous pourrez peut-être explorer une seule zone, à votre rythme. Une invitation, pas une consigne.';
}

/** Texte affiché quand aucune analyse n'existe encore. */
export const DEBRIEF_PENDING_TEXT = 'Le débrief littéraire personnalisé arrive sous 24 h.';

/**
 * Modèle de la carte Debrief J+1 :
 *   - analyse absente → pending (la carte le dit, sans meubler) ;
 *   - debrief_text présent ET doctrinalement sûr → actes générés SEULS
 *     (provenance HONNÊTE : un acte manquant reste ABSENT, jamais comblé
 *     par un gabarit maison sous la bannière « généré automatiquement ») ;
 *   - sinon → repli pédagogique v1 INTÉGRAL (gabarits descriptifs maîtrisés).
 * `marginGlobal` = marge réellement MESURÉE (null si absente en base) — le
 * repli ne fabrique jamais un récit d'intensité depuis un 0 par défaut.
 * Fail-closed au dernier mètre : un texte prescriptif persisté est REFUSÉ
 * ici même si le serveur l'a laissé passer (même ceinture que #19 v1).
 */
/**
 * SUR QUOI LE CHIFFRE REPOSE — DIT PAR LA SECTION MARGE, PAS ICI.
 *
 * Une note de base a vécu ici du 14 au 15/08 : « cette marge porte sur votre
 * pilotage seul ». Le lot A3 a ensuite posé une vraie section MARGE, avec le
 * nombre, sa décomposition pondérée et la ligne « Véhicule non caractérisé —
 * exclu du calcul ». La phrase du débrief en devenait le doublon, à deux blocs
 * de distance sur le même écran.
 *
 * Le débrief raconte la séance ; la section MARGE répond de son chiffre. Deux
 * fois la même précaution ne rassure pas davantage — elle dilue.
 */
export function debriefModel(
  analysis: {
    debriefText: string | null;
    marginGlobal: number | null;
    /** Sur quoi la marge repose. `null` = ligne antérieure au 14/08. */
    marginBase?: MarginBase | null;
  } | null,
  firstName: string | null | undefined
): BilanDebrief {
  if (analysis === null) return { kind: 'pending' };

  const raw = analysis.debriefText ?? '';
  const safe = raw && isDoctrineSafe(raw) ? raw : '';
  if (safe) {
    const parsed = parseDebriefText(safe);
    const acts: DebriefAct[] = [];
    if (parsed.recit) acts.push({ title: 'Récit', body: parsed.recit });
    if (parsed.meta) acts.push({ title: 'Méta-analyse', body: parsed.meta });
    if (parsed.preparation) acts.push({ title: 'Préparation', body: parsed.preparation });
    // Provenance pure : soit tout est généré, soit repli intégral — jamais
    // un mélange étiqueté « généré » (transparence RGPD/IA).
    if (acts.length > 0) return { kind: 'generated', acts };
  }

  return {
    kind: 'fallback',
    acts: [
      { title: 'Récit', body: fallbackRecit(analysis.marginGlobal, firstName) },
      { title: 'Méta-analyse', body: fallbackMeta() },
      { title: 'Préparation', body: fallbackPreparation() },
    ],
  };
}

// ---------------------------------------------------------------------------
// Fil présentiel — les 3 dernières bulles
// ---------------------------------------------------------------------------

/** Les n derniers messages (ordre chronologique conservé). */
export function lastThreadMessages<T>(messages: readonly T[], n = 3): T[] {
  if (n <= 0) return [];
  return messages.slice(Math.max(0, messages.length - n));
}

// ---------------------------------------------------------------------------
// Viewer photos — décision de dismiss (swipe bas)
// ---------------------------------------------------------------------------

/** Tirage (px) au-delà duquel le relâchement ferme le viewer. */
export const VIEWER_DISMISS_DRAG = 120;
/** Vitesse (px/s) d'un flick bas qui ferme même sur un petit tirage. */
export const VIEWER_DISMISS_VELOCITY = 900;
/** Tirage minimal (px) pour qu'un flick compte comme une intention. */
export const VIEWER_FLICK_MIN_DRAG = 24;

/** Ferme-t-on le viewer au relâchement du swipe vers le bas ? */
export function viewerShouldDismiss(translationY: number, velocityY: number): boolean {
  'worklet';
  if (translationY >= VIEWER_DISMISS_DRAG) return true;
  return velocityY >= VIEWER_DISMISS_VELOCITY && translationY >= VIEWER_FLICK_MIN_DRAG;
}

/** Le pan du viewer déplace l'image (zoomé) ou suit le dismiss (échelle ~1). */
export const VIEWER_PAN_ZOOM_THRESHOLD = 1.05;
