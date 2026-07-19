/**
 * Logique PURE du catalogue de réservation (lot V2-L4, mission D — flux A1).
 *
 * Aucun I/O ici (ni Supabase, ni React Native) : uniquement le formatage des
 * prix, le calcul des places restantes / jauge, la résolution du prix d'une
 * offre depuis les lignes `pricing`, et le gating du drapeau `app_payments`.
 * L'I/O (lectures SELECT des tables site) vit dans `bookingCatalogService.ts`.
 * Ce découpage est imposé par le cadre Jest (ts-jest node, aucun rendu RN) :
 * la règle se teste ici en .ts pur, le service se vérifie en build réel.
 *
 * Source de vérité des colonnes (inspection lecture seule du 18/07, production) :
 *   - pricing(season, offer_key, format, price_first_session_cents,
 *             price_subsequent_cents, active) — RLS SELECT public WHERE active.
 *   - sessions(available_offers jsonb, capacity_*, max_capacity, format, …).
 *   - session_availability(session_id, taken_access, taken_signature,
 *             taken_promotion, taken_heritage, taken_total).
 * Correctif Heritage vérifié : heritage full_day = 249 000 cents → « 2 490 € ».
 *
 * Ton OXV : vouvoiement, sec, sans emoji. Données réelles : un prix absent rend
 * « — », jamais un 0 fabriqué.
 */

/** Offres du catalogue app (les quatre clés réelles de `pricing.offer_key`). */
export type OfferKey = 'access' | 'signature' | 'heritage' | 'promotion';

/** Ordre d'affichage canonique (Access/Signature en tête, cf. maquette). */
export const OFFER_ORDER: OfferKey[] = ['access', 'signature', 'heritage', 'promotion'];

/** Libellés humains des offres (sobres, sans emoji). */
export const OFFER_LABELS: Record<OfferKey, string> = {
  access: 'Access',
  signature: 'Signature',
  heritage: 'Heritage',
  promotion: 'Promotion',
};

/** Total fondateurs — borne dure (« 30 membres. Jamais plus. »). */
export const FOUNDER_TOTAL = 30;

/** Nombre maximal de segments dessinés dans la jauge de places (layout). */
export const PLACES_SEGMENTS_MAX = 20;

/**
 * Espace fine insécable (U+202F) — séparateur de milliers et avant « € »,
 * typographie française. Un prix ne se coupe pas en fin de ligne.
 */
export const NBSP = ' ';

/** Drapeau serveur qui ouvre le flux de réservation (fail-closed à la lecture). */
export const BOOKING_FLAG_KEY = 'app_payments';

/** Événements de tunnel (Plausible), un par pas — mesurés même flag OFF. */
export const RESERVE_FUNNEL_EVENTS = {
  catalog: 'reserve_funnel_1',
  day: 'reserve_funnel_2',
  payment: 'reserve_funnel_3',
} as const;

// ---------------------------------------------------------------------------
// Drapeau app_payments — gating (fail-closed en amont, ici pur)
// ---------------------------------------------------------------------------

export type BookingAccess = 'open' | 'closed';

/**
 * État d'accès au flux de réservation selon le drapeau `app_payments`.
 * OFF → 'closed' (écran « Réservations à l'ouverture »). Le fail-closed réel
 * (isFlagEnabled renvoie false en cas d'erreur) est côté service ; ici on ne
 * fait que traduire le booléen résolu.
 */
export function resolveBookingAccess(flagEnabled: boolean): BookingAccess {
  return flagEnabled ? 'open' : 'closed';
}

/** « 12/30 fondateurs » — libellé de la jauge fondateurs (borné [0, total]). */
export function foundersProgressLabel(count: number, total: number = FOUNDER_TOTAL): string {
  const c = Math.max(0, Math.min(Math.floor(Number.isFinite(count) ? count : 0), total));
  return `${c}/${total} fondateurs`;
}

// ---------------------------------------------------------------------------
// Prix — cents → « 2 490 € »
// ---------------------------------------------------------------------------

/**
 * Formate un montant en centimes vers un prix euros français : séparateur de
 * milliers fin insécable, « € » précédé d'une fine insécable, décimales
 * seulement si non nulles. `null`/non fini → « — » (jamais un 0 fabriqué).
 *
 * formatPriceEur(249000) === '2 490 €' (correctif Heritage).
 * formatPriceEur(39000)  === '390 €'.
 */
export function formatPriceEur(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  const euros = cents / 100;
  const whole = Math.trunc(Math.abs(euros));
  const frac = Math.round((Math.abs(euros) - whole) * 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const sign = euros < 0 ? '−' : '';
  const body = frac === 0 ? grouped : `${grouped},${String(frac).padStart(2, '0')}`;
  return `${sign}${body}${NBSP}€`;
}

// ---------------------------------------------------------------------------
// Places restantes + jauge segmentée
// ---------------------------------------------------------------------------

/** Places encore disponibles : max(0, capacité − prises). Absents → 0. */
export function placesRemaining(capacity: number | null, taken: number | null): number {
  const cap = Math.max(0, Math.floor(capacity ?? 0));
  const tk = Math.max(0, Math.floor(taken ?? 0));
  return Math.max(0, cap - tk);
}

export interface PlacesGauge {
  /** Capacité réelle (max_capacity de la journée). */
  capacity: number;
  /** Places prises (taken_total), bornées à la capacité. */
  taken: number;
  /** Places restantes = capacity − taken. */
  remaining: number;
  /** Nombre de segments dessinés (= min(capacity, 20)). */
  segments: number;
  /** Segments « remplis » (prises) — rendus en text.dim. */
  filledSegments: number;
  /** Segments « libres » (restants) — rendus en accent (la rareté se voit). */
  freeSegments: number;
  /** Complet (0 place) OU capacité nulle → LISTE D'ATTENTE. */
  isWaitlist: boolean;
}

/**
 * Jauge de places : segments remplis (pris, text.dim) vs libres (restants,
 * accent). La capacité pilote le nombre de segments (plafonné à 20 pour le
 * layout ; les journées réelles tiennent en 20). Complet → liste d'attente.
 */
export function placesGauge(capacity: number | null, taken: number | null): PlacesGauge {
  const cap = Math.max(0, Math.floor(capacity ?? 0));
  const tk = Math.min(cap, Math.max(0, Math.floor(taken ?? 0)));
  const remaining = cap - tk;
  const segments = Math.min(cap, PLACES_SEGMENTS_MAX);
  const filledSegments = cap === 0 ? 0 : Math.min(segments, Math.round((tk / cap) * segments));
  return {
    capacity: cap,
    taken: tk,
    remaining,
    segments,
    filledSegments,
    freeSegments: segments - filledSegments,
    isWaitlist: cap === 0 || remaining <= 0,
  };
}

/** « 3 places » / « 1 place » / « Liste d'attente ». */
export function placesLabel(gauge: PlacesGauge): string {
  if (gauge.isWaitlist) return "Liste d'attente";
  return `${gauge.remaining} place${gauge.remaining > 1 ? 's' : ''}`;
}

// ---------------------------------------------------------------------------
// Offres disponibles + résolution de prix depuis `pricing`
// ---------------------------------------------------------------------------

/**
 * Clés d'offres actives d'une journée depuis `sessions.available_offers`
 * (jsonb {access:true, signature:false, …}). Filtré aux clés connues, dans
 * l'ordre canonique. Entrée absente/malformée → [].
 */
export function availableOfferKeys(raw: unknown): OfferKey[] {
  if (!raw || typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  return OFFER_ORDER.filter((k) => obj[k] === true);
}

/** Saison `pricing` d'une journée = l'année de sa date (« 2026-12-24 » → « 2026 »). */
export function seasonForDate(isoDate: string): string {
  return typeof isoDate === 'string' ? isoDate.slice(0, 4) : '';
}

/** Ligne `pricing` telle que lue (colonnes réelles). */
export interface PricingRow {
  season: string;
  offer_key: string;
  format: string;
  price_first_session_cents: number;
  price_subsequent_cents: number;
  active: boolean | null;
}

/**
 * Formats de demi-journée du site (`sessions.format`) mappés vers la clé
 * `pricing.format = 'half_day'`. Sans ce mapping, une demi-journée ne trouverait
 * aucune ligne et serait facturée au plein tarif — surfacturation silencieuse.
 */
const HALF_DAY_FORMATS = new Set(['half_day', 'morning', 'afternoon']);

/** Normalise un format de session vers la clé `pricing.format` correspondante. */
function normalizePricingFormat(format: string): string {
  return HALF_DAY_FORMATS.has(format) ? 'half_day' : format;
}

/**
 * Prix « première séance » (cents) d'une offre pour une journée. Match strict
 * (season, offer, format), en ne retenant QUE les lignes actives — jamais un
 * prix archivé. Les demi-journées ('morning'/'afternoon') sont normalisées vers
 * 'half_day' AVANT résolution ; aucun repli sur 'full_day' (qui surfacturerait
 * une demi-journée). Aucune correspondance active → `null` (le prix s'affiche
 * « — », jamais un montant inventé).
 */
export function resolveOfferPriceCents(
  rows: PricingRow[],
  opts: { season: string; offerKey: string; format: string }
): number | null {
  const format = normalizePricingFormat(opts.format);
  const pick = rows.find(
    (r) =>
      r.active === true &&
      r.season === opts.season &&
      r.offer_key === opts.offerKey &&
      r.format === format
  );
  return pick ? pick.price_first_session_cents : null;
}
