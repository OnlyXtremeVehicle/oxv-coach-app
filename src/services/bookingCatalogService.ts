/**
 * Service catalogue de réservation (lot V2-L4, mission D — flux A1).
 *
 * LECTURE SEULE, ZÉRO WRITE. Ce service lit les tables/vues SITE pour peupler le
 * catalogue app :
 *   - `sessions_public` (vue, SELECT authenticated/anon) : journées + nom de
 *     circuit joint + capacités + `available_offers`.
 *   - `session_availability` (vue, SELECT authenticated/anon) : places prises
 *     par offre (`taken_*`) et total (`taken_total`).
 *   - `pricing` (table, RLS SELECT public WHERE active) : prix par
 *     (season, offer_key, format). Un pilote ne voit que les lignes actives —
 *     un prix absent rend « — », jamais un montant inventé.
 *
 * Toutes les décisions de calcul (prix, places, offres) vivent dans
 * `bookingCatalogLogic.ts` (pur, testé). Ici : uniquement l'I/O et le mapping.
 * Erreurs jamais masquées : on log et on rend un défaut sûr ([] / null) — l'UI
 * distingue vide réel et panne via son StateView.
 *
 * Le flux est construit COMPLET mais reste derrière le drapeau `app_payments`
 * (fail-closed, écran d'accueil) : ce service n'est appelé que lorsqu'il est ON.
 */

import { supabase } from '@/lib/supabase';
import {
  availableOfferKeys,
  formatPriceEur,
  OFFER_LABELS,
  placesGauge,
  resolveOfferPriceCents,
  seasonForDate,
  type OfferKey,
  type PlacesGauge,
  type PricingRow,
} from './bookingCatalogLogic';

/** Statuts de session à ne jamais proposer à la réservation. */
const NON_BOOKABLE_STATUSES = new Set(['cancelled', 'archived', 'completed', 'draft']);

const SESSION_COLS =
  'id, date, format, status, is_private, season_type, circuit_name, available_offers, ' +
  'capacity_access, capacity_signature, capacity_promotion, max_capacity, start_time, end_time';

const AVAIL_COLS =
  'session_id, taken_access, taken_signature, taken_promotion, taken_heritage, taken_total';

export interface AvailableOffer {
  key: OfferKey;
  label: string;
  /** Prix « première séance » en cents, ou null si aucune ligne pricing lisible. */
  priceCents: number | null;
  /** Prix formaté (« 2 490 € ») ou « — ». */
  priceLabel: string;
}

export interface AvailableDay {
  sessionId: string;
  date: string;
  format: string | null;
  circuitName: string | null;
  seasonType: string | null;
  startTime: string | null;
  endTime: string | null;
  offers: AvailableOffer[];
  places: PlacesGauge;
}

interface SessionRow {
  id: string;
  date: string;
  format: string | null;
  status: string | null;
  is_private: boolean | null;
  season_type: string | null;
  circuit_name: string | null;
  available_offers: unknown;
  capacity_access: number | null;
  capacity_signature: number | null;
  capacity_promotion: number | null;
  max_capacity: number | null;
  start_time: string | null;
  end_time: string | null;
}

interface AvailRow {
  session_id: string | null;
  taken_access: number | null;
  taken_signature: number | null;
  taken_promotion: number | null;
  taken_heritage: number | null;
  taken_total: number | null;
}

/** Date locale (pas UTC) au format ISO court — cohérent avec nextTrackDayService. */
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Capacité totale de la journée : max_capacity, à défaut somme des capacités d'offre. */
function dayCapacity(s: SessionRow): number {
  if (s.max_capacity != null) return s.max_capacity;
  return (s.capacity_access ?? 0) + (s.capacity_signature ?? 0) + (s.capacity_promotion ?? 0);
}

/** Construit le récap d'une journée à partir des trois sources déjà lues. */
function buildDay(s: SessionRow, avail: AvailRow | undefined, pricing: PricingRow[]): AvailableDay {
  const season = seasonForDate(s.date);
  const format = s.format ?? 'full_day';
  const offers: AvailableOffer[] = availableOfferKeys(s.available_offers).map((key) => {
    const priceCents = resolveOfferPriceCents(pricing, { season, offerKey: key, format });
    return { key, label: OFFER_LABELS[key], priceCents, priceLabel: formatPriceEur(priceCents) };
  });
  return {
    sessionId: s.id,
    date: s.date,
    format: s.format,
    circuitName: s.circuit_name,
    seasonType: s.season_type,
    startTime: s.start_time,
    endTime: s.end_time,
    offers,
    places: placesGauge(dayCapacity(s), avail?.taken_total ?? 0),
  };
}

/** Lit toutes les lignes pricing lisibles (RLS = actives). Défaut sûr : []. */
async function loadPricing(): Promise<PricingRow[]> {
  const { data, error } = await supabase
    .from('pricing')
    .select('season, offer_key, format, price_first_session_cents, price_subsequent_cents, active');
  if (error) {
    console.warn('[OXV][booking] loadPricing :', error.message);
    return [];
  }
  return (data ?? []) as unknown as PricingRow[];
}

/**
 * Journées à venir réservables : publiques, non annulées, à partir d'aujourd'hui.
 * Trie par date croissante. Réseau en panne → [] (l'UI affiche son StateView).
 */
export async function listAvailableDays(): Promise<AvailableDay[]> {
  const today = todayLocalIso();
  const { data, error } = await supabase
    .from('sessions_public')
    .select(SESSION_COLS)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(60);
  if (error) {
    console.warn('[OXV][booking] listAvailableDays :', error.message);
    return [];
  }

  const sessions = ((data ?? []) as unknown as SessionRow[]).filter(
    (s) => s.is_private !== true && !NON_BOOKABLE_STATUSES.has(s.status ?? '')
  );
  if (sessions.length === 0) return [];

  const ids = sessions.map((s) => s.id);
  const [{ data: availData }, pricing] = await Promise.all([
    supabase.from('session_availability').select(AVAIL_COLS).in('session_id', ids),
    loadPricing(),
  ]);
  const availById = new Map<string, AvailRow>();
  for (const row of (availData ?? []) as unknown as AvailRow[]) {
    if (row.session_id) availById.set(row.session_id, row);
  }

  return sessions.map((s) => buildDay(s, availById.get(s.id), pricing));
}

/**
 * Une journée par son id (détail & choix d'offre). null si introuvable/panne —
 * l'écran distingue les deux via son état.
 */
export async function getDay(sessionId: string): Promise<AvailableDay | null> {
  const { data, error } = await supabase
    .from('sessions_public')
    .select(SESSION_COLS)
    .eq('id', sessionId)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV][booking] getDay :', error.message);
    return null;
  }
  const s = data as unknown as SessionRow;

  const [{ data: availData }, pricing] = await Promise.all([
    supabase
      .from('session_availability')
      .select(AVAIL_COLS)
      .eq('session_id', sessionId)
      .maybeSingle(),
    loadPricing(),
  ]);
  return buildDay(s, (availData as unknown as AvailRow | null) ?? undefined, pricing);
}
