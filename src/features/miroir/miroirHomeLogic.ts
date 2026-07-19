/**
 * miroirHomeLogic — logique PURE de l'accueil Miroir (lot V2-L1, écran 1/3).
 *
 * Module .ts strictement pur : aucune dépendance React, React Native ou
 * Supabase — testé sous ts-jest node (__tests__/miroirHomeLogic.test.ts).
 *
 * Règle fondatrice « données réelles câblées » : chaque fonction rend null /
 * un objet vide quand la donnée manque — jamais une valeur plausible inventée.
 * Le hook (useMiroirHome) fait les lectures ; ici, uniquement les décisions.
 */

// ---------------------------------------------------------------------------
// Mode d'accueil — deux visages du Miroir (décision fondateur 18/07)
// ---------------------------------------------------------------------------

export type HomeMode = 'apres_seance' | 'entre_journees';

/** Fenêtre « après-séance » : séance de moins de 7 jours. */
export const APRES_SEANCE_WINDOW_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * Le visage de l'accueil : 'apres_seance' si la dernière séance a STRICTEMENT
 * moins de 7 jours, 'entre_journees' sinon (7 jours pile compris — frontière
 * verrouillée par test). Pas de séance, date invalide ou datée dans le futur
 * (donnée suspecte) → 'entre_journees', le visage calme.
 */
export function decideHomeMode(lastSessionStartedAt: string | Date | null, now: Date): HomeMode {
  if (lastSessionStartedAt === null) return 'entre_journees';
  const t =
    typeof lastSessionStartedAt === 'string'
      ? new Date(lastSessionStartedAt).getTime()
      : lastSessionStartedAt.getTime();
  if (!Number.isFinite(t)) return 'entre_journees';
  const ageMs = now.getTime() - t;
  if (ageMs < 0) return 'entre_journees';
  return ageMs < APRES_SEANCE_WINDOW_DAYS * DAY_MS ? 'apres_seance' : 'entre_journees';
}

// ---------------------------------------------------------------------------
// Fait de saison — UN fait factuel depuis les stats réelles
// ---------------------------------------------------------------------------

/** Clé du bucket « séance sans circuit » de statsService — exclue du fait. */
export const NO_CIRCUIT_KEY = 'Inconnu';

/** Sous-ensemble structurel de PilotStats (statsService) consommé ici. */
export interface SeasonFactInput {
  totalSessions: number;
  totalDistanceKm: number;
  byCircuit: Record<string, unknown>;
}

/**
 * UN fait factuel français depuis les stats réelles du pilote — jamais un
 * jugement, jamais une consigne. Aucune stat (0 séance) → null : on n'invente
 * pas un fait. Exemple : « 8 séances · 412 km de piste · 3 circuits. »
 */
export function seasonFact(stats: SeasonFactInput | null): string | null {
  if (stats === null || stats.totalSessions <= 0) return null;
  const parts: string[] = [
    `${stats.totalSessions} ${stats.totalSessions > 1 ? 'séances' : 'séance'}`,
  ];
  const km = Math.round(stats.totalDistanceKm);
  if (km > 0) parts.push(`${km} km de piste`);
  const circuits = Object.keys(stats.byCircuit).filter((name) => name !== NO_CIRCUIT_KEY).length;
  if (circuits > 0) parts.push(`${circuits} ${circuits > 1 ? 'circuits' : 'circuit'}`);
  return `${parts.join(' · ')}.`;
}

// ---------------------------------------------------------------------------
// Sélection des photos — fallbacks honnêtes (null, jamais une image inventée)
// ---------------------------------------------------------------------------

export interface GarageVehicleRef {
  id: string;
}

/**
 * Photo du VÉHICULE PRINCIPAL du garage : le premier véhicule (listMyVehicles
 * trie par created_at asc — patron garage v1), via la carte des covers signées
 * (getMyVehicleCovers). Pas de véhicule → null ; véhicule sans photo → null
 * (on ne retombe PAS sur un autre véhicule : ce ne serait pas « sa » voiture).
 */
export function pickVehicleCover(
  vehicles: readonly GarageVehicleRef[],
  covers: Record<string, string>
): string | null {
  const principal = vehicles[0];
  if (principal === undefined) return null;
  return covers[principal.id] ?? null;
}

export interface SessionMediaRef {
  mediaType: string;
  signedUrl?: string | null;
}

/**
 * Premier média AFFICHABLE de la séance : première PHOTO avec URL signée
 * (une vidéo ne se rend pas dans HeroPhoto). Rien d'affichable → null.
 */
export function pickSessionPhotoUrl(items: readonly SessionMediaRef[]): string | null {
  for (const m of items) {
    if (m.mediaType === 'photo' && typeof m.signedUrl === 'string' && m.signedUrl.length > 0) {
      return m.signedUrl;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Chrono — meilleur tour de la séance, record personnel
// ---------------------------------------------------------------------------

export interface LapRef {
  duration_seconds: number | null;
  is_outlap: boolean;
  is_inlap: boolean;
}

/**
 * Meilleur tour de la séance en MILLISECONDES : minimum des tours lancés
 * (sortie/rentrée des stands exclues), repli sur l'agrégat de séance
 * (best_lap_seconds, écrit à la complétion) si les lignes laps manquent —
 * même chaîne que le Paddock v1 et le Bilan. Rien de mesurable → null.
 */
export function bestLapMs(laps: readonly LapRef[], aggBestSeconds: number | null): number | null {
  let best: number | null = null;
  for (const lap of laps) {
    if (lap.is_outlap || lap.is_inlap) continue;
    const s = lap.duration_seconds !== null ? Number(lap.duration_seconds) : Number.NaN;
    if (Number.isFinite(s) && s > 0 && (best === null || s < best)) best = s;
  }
  const seconds =
    best ??
    (aggBestSeconds !== null && Number.isFinite(aggBestSeconds) && aggBestSeconds > 0
      ? aggBestSeconds
      : null);
  return seconds !== null ? Math.round(seconds * 1000) : null;
}

/**
 * La séance porte-t-elle le record personnel all-time ? Vrai si son meilleur
 * tour égale (à l'epsilon flottant près) ou améliore le meilleur all-time —
 * le all-time INCLUT la séance : l'égalité signifie « c'est elle le record ».
 */
export function isPersonalRecord(
  sessionBestSeconds: number | null,
  allTimeBestSeconds: number | null
): boolean {
  if (sessionBestSeconds === null || allTimeBestSeconds === null) return false;
  return sessionBestSeconds <= allTimeBestSeconds + 1e-9;
}

// NB : la garde une-fois du RecordFlash est UNIFIÉE accueil/bilan dans
// ./recordCelebration (une seule clé MMKV par séance, jamais par écran) —
// l'ancienne clé miroir:recordFlash:{id} est supprimée.

// ---------------------------------------------------------------------------
// Prochaine journée — compte à rebours et fenêtre météo
// ---------------------------------------------------------------------------

/** Horizon du cadran countdown : l'arc encode l'approche sur 30 jours. */
export const DIAL_COUNTDOWN_MAX_DAYS = 30;

/**
 * Jours calendaires (locaux) restants avant `dateIso` (AAAA-MM-JJ) : 0 = jour
 * J, 1 = demain. Journée passée ou date invalide → null.
 */
export function daysUntil(dateIso: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (m === null) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / DAY_MS);
  return diff >= 0 ? diff : null;
}

/** Fenêtre d'affichage météo : journée à 7 jours ou moins (au-delà, silence). */
export const WEATHER_WINDOW_DAYS = 7;

export function weatherEligible(dateIso: string, now: Date): boolean {
  const d = daysUntil(dateIso, now);
  return d !== null && d <= WEATHER_WINDOW_DAYS;
}

// ---------------------------------------------------------------------------
// QDI — branches persistées → valeurs radar (branches nulles MASQUÉES)
// ---------------------------------------------------------------------------

/** Ordre canonique des 5 branches (aligné vizMath / qdiLogic). */
export const QDI_KEYS = [
  'trajectoire',
  'fluidite',
  'freinage',
  'acceleration',
  'regularite',
] as const;

export type QdiKey = (typeof QDI_KEYS)[number];

/**
 * Branches QDI persistées → valeurs du RadarQdi : une branche nulle ou non
 * finie est OMISE (le radar la masque), jamais tirée à zéro.
 */
export function qdiToRadarValues(
  branches: Partial<Record<QdiKey, number | null>> | null | undefined
): Partial<Record<QdiKey, number>> {
  const out: Partial<Record<QdiKey, number>> = {};
  if (!branches) return out;
  for (const key of QDI_KEYS) {
    const v = branches[key];
    if (v !== null && v !== undefined && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// RÉSERVER — gating flag app_payments (fail-closed)
// ---------------------------------------------------------------------------

export interface ReserveDecision {
  href: string;
  analyticsEvent: 'reserve_intent';
}

/**
 * Cible du CTA RÉSERVER. Flag `app_payments` OFF (fail-closed) : aucun flux
 * de paiement — la porte Club (catalogue navigable) + l'intention mesurée
 * (`reserve_intent`). Flag ON : le flux A1 arrive au lot L4 ; en attendant,
 * même porte (aucun écran de paiement n'existe dans (app2)) — verrouillé
 * par test pour que le futur branchement soit un choix, pas un accident.
 */
export function decideReserve(paymentsEnabled: boolean): ReserveDecision {
  if (!paymentsEnabled) {
    return { href: '/(app2)/club', analyticsEvent: 'reserve_intent' };
  }
  return { href: '/(app2)/club', analyticsEvent: 'reserve_intent' };
}

// ---------------------------------------------------------------------------
// Tier Heritage — lecture registrations.offer_type (patron getQdiAccessLevel)
// ---------------------------------------------------------------------------

/** Statuts d'inscription EFFECTIFS — même ensemble que getQdiAccessLevel. */
const ACTIVE_REG_STATUSES = new Set(['confirmed', 'attended', 'pending_payment', 'pending']);

export interface RegistrationRef {
  offer_type: string | null;
  status: string | null;
}

export interface HeritageTier {
  isHeritage: boolean;
}

/**
 * Tier Heritage depuis les inscriptions (triées created_at DESC — contrat de
 * l'appelant, patron getQdiAccessLevel) : le niveau suit l'inscription
 * EFFECTIVE la plus récente. Ne porte QUE l'appartenance au tier (eyebrow
 * or) — le compteur « x/y » du pack vient de heritage_packs, jamais d'une
 * reconstruction depuis les inscriptions (voir activeHeritagePack).
 */
export function heritageOf(rows: readonly RegistrationRef[]): HeritageTier {
  const current = rows.find((r) => ACTIVE_REG_STATUSES.has(String(r.status)));
  const isHeritage =
    current !== undefined &&
    String(current.offer_type ?? '')
      .toLowerCase()
      .includes('heritage');
  return { isHeritage };
}

// ---------------------------------------------------------------------------
// Pack Heritage — compteur x/y depuis les VRAIES colonnes heritage_packs
// ---------------------------------------------------------------------------

/** Sous-ensemble structurel d'une ligne heritage_packs (database.types). */
export interface HeritagePackRef {
  sessions_used: number | null;
  sessions_total: number | null;
  status: string | null;
  valid_until: string | null;
}

export interface HeritagePackCounter {
  used: number;
  total: number;
}

/**
 * Compteur « x/y » du pack Heritage ACTIF — lu depuis sessions_used /
 * sessions_total (colonnes réelles), jamais reconstruit depuis les
 * inscriptions ni un total codé en dur (un membre au 2ᵉ pack repartirait
 * sinon à « 4/4 » à vie). Pack absent, non actif, périmé (valid_until
 * passé — ceinture-bretelles si le cron site n'a pas basculé le status)
 * ou total non mesurable → null : la cellule SÉANCES prend la place,
 * jamais un « x/4 » inventé. `used` est rendu tel quel (donnée réelle).
 */
export function activeHeritagePack(
  row: HeritagePackRef | null,
  now: Date
): HeritagePackCounter | null {
  if (row === null || row.status !== 'active') return null;
  if (row.valid_until !== null) {
    // Comparaison CALENDAIRE locale (même patron que daysUntil) : une date
    // nue « AAAA-MM-JJ » parsée par new Date() serait minuit UTC — la
    // validité basculerait selon le fuseau de l'appareil. Jour `valid_until`
    // inclus.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.valid_until);
    const until =
      m !== null
        ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
        : new Date(row.valid_until).getTime();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (Number.isFinite(until) && until < today) return null;
  }
  const total = row.sessions_total !== null ? Number(row.sessions_total) : Number.NaN;
  const used = row.sessions_used !== null ? Number(row.sessions_used) : Number.NaN;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(used) || used < 0) return null;
  return { used, total };
}

// ---------------------------------------------------------------------------
// Bandeau rituel B3 (version MINIMALE, données réelles) — la préférence
// rituels (opt-out par catégorie) arrive au lot L4 ; ici uniquement le
// bandeau J-3 factuel, adossé à la prochaine journée RÉELLE du pilote.
// ---------------------------------------------------------------------------

/** Fenêtre du rituel J-3 : bandeau affiché à 3 jours ou moins de la journée. */
export const RITUAL_BANNER_WINDOW_DAYS = 3;

/** Le bandeau rituel s'affiche-t-il ? Journée réelle à J-3..J-0 uniquement. */
export function shouldShowRitualBanner(daysToNextDay: number | null): boolean {
  return daysToNextDay !== null && daysToNextDay <= RITUAL_BANNER_WINDOW_DAYS;
}

/** Clé MMKV du dismiss — par JOURNÉE (date ISO) : une nouvelle journée ré-affiche. */
export function ritualBannerKey(dayDateIso: string): string {
  return `miroir:rituelJ3:${dayDateIso}`;
}

/**
 * Texte du bandeau — factuel, jamais prescriptif : le compte à rebours réel
 * et le circuit réel. « J-3 · Circuit de Haute Saintonge. Votre préparation
 * vous attend. » ; jour J → « Jour J » ; circuit inconnu → pas de nom inventé.
 */
export function ritualBannerText(daysToNextDay: number, circuitName: string | null): string {
  const j = daysToNextDay === 0 ? 'Jour J' : `J-${daysToNextDay}`;
  return circuitName !== null && circuitName.length > 0
    ? `${j} · ${circuitName}. Votre préparation vous attend.`
    : `${j}. Votre préparation vous attend.`;
}

// ---------------------------------------------------------------------------
// RollingCounter — valeur « zéro » de départ, même gabarit que la cible
// ---------------------------------------------------------------------------

/**
 * Réplique un label chiffré avec tous ses digits à 0, séparateurs intacts
 * (« 1:24.318 » → « 0:00.000 », « 412 » → « 000 ») : le RollingCounter part
 * de ce gabarit au premier viewport et ROULE vers la valeur réelle — effet
 * odomètre sans changement de longueur.
 */
export function zeroLike(label: string): string {
  return label.replace(/\d/g, '0');
}
