/**
 * Facturation coach — vue PILOTE (règlement).
 *
 * OXV N'ENCAISSE JAMAIS. Le coach encaisse DIRECTEMENT, hors application. Ce
 * service se contente de LIRE les factures qui concernent le pilote courant et
 * de résoudre le LIEN DE PAIEMENT du coach pour que l'app puisse l'OUVRIR — le
 * pilote règle dans SA banque / SON appli. Aucune saisie de coordonnées
 * bancaires, aucun traitement de paiement ici : on n'ouvre qu'un lien.
 *
 * Accès aux données (zéro schéma, tout existe) :
 *   - factures : `coach_invoices`, RLS `coach_invoices_pilot_select`
 *     (pilot_id = auth.uid()) — le pilote ne lit QUE les siennes.
 *   - lien de paiement : RETIRÉ LE 12/08/2026. Il vivait sur
 *     `coach_profiles.payment_link`, colonne lisible par TOUS via
 *     `coach_profiles_read_published`. Le plan V3 la supprime — « place de
 *     marché seule ». Zéro coach l'avait renseignée en production.
 *
 *     CONSÉQUENCE À DIRE : le pilote n'a plus de bouton « Régler » dans
 *     l'application. Le règlement se fait hors application, entre lui et son
 *     coach, jusqu'à ce que le drapeau `app_payments` soit armé. La facture
 *     porte d'ailleurs déjà cette mention en toutes lettres — OXV « n'intervient
 *     ni dans son émission, ni dans l'encaissement du règlement ».
 *   - état « réglé » : `coaching_bookings.billing_status`, posé par le coach,
 *     lisible par le pilote via `coaching_bookings_pilot_select`.
 *
 * Doctrine : vouvoiement, aucun emoji, données réelles uniquement (jamais de
 * montant ou de statut inventé). Best-effort : une résolution manquante retombe
 * sur un état neutre plutôt que de faire planter la liste.
 */

import { supabase } from '@/lib/supabase';
import { listMyCoaches } from '@/services/pilotConsentService';

/** Une facture du coach concernant le pilote courant (vue règlement). */
export interface MyCoachInvoice {
  id: string;
  number: string;
  /** Date de la prestation (`service_date`), ou null. */
  serviceDate: string | null;
  /** Date d'émission (`issued_at`) — repli d'affichage si `serviceDate` absente. */
  issuedAt: string;
  /** Montant TTC dû, en centimes. */
  amountTotalCents: number;
  /** Devise de la facture (`currency`, défaut EUR). */
  currency: string;
  /** Nom du coach émetteur (réel si résolu, « — » sinon). */
  coachName: string;
  /** Vrai UNIQUEMENT si le règlement est positivement constaté (billing_status='settled'). */
  settled: boolean;
}

/**
 * Formate un montant en centimes selon la devise de la facture (fr-FR, toujours
 * 2 décimales — canon des factures, cf. `coachInvoicePdfService`). Ex. « 120,00 € ».
 */
export function formatInvoiceAmount(cents: number, currency = 'EUR'): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return value.toLocaleString('fr-FR', {
      style: 'currency',
      currency: currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    // Devise inconnue de l'Intl : repli lisible plutôt que planter.
    return `${value.toFixed(2).replace('.', ',')} ${currency || 'EUR'}`;
  }
}

/**
 * Annuaire coach : headline seul, repli de nom pour les factures.
 *
 * Le lien de paiement a été retiré de cette lecture le 12/08/2026 — voir
 * l'en-tête du fichier.
 */
async function loadCoachDirectory(coachIds: string[]): Promise<{
  headline: Map<string, string>;
}> {
  const headline = new Map<string, string>();
  if (coachIds.length === 0) return { headline };

  const { data, error } = await supabase
    .from('coach_profiles')
    .select('coach_id, headline')
    .in('coach_id', coachIds);

  if (error) {
    console.warn('[OXV][pilot] listMyCoachInvoices profiles :', error.message);
    return { headline };
  }

  for (const p of data ?? []) {
    if (p.headline && p.headline.trim()) headline.set(p.coach_id, p.headline.trim());
  }
  return { headline };
}

/**
 * État de règlement des séances rattachées aux factures. On ne remonte `true` que
 * pour un `billing_status = 'settled'` positivement lu ; tout le reste (inconnu,
 * quote, none) reste neutre côté écran (aucun statut inventé).
 */
async function loadSettledBookings(bookingIds: string[]): Promise<Map<string, boolean>> {
  const settled = new Map<string, boolean>();
  if (bookingIds.length === 0) return settled;

  const { data, error } = await supabase
    .from('coaching_bookings')
    .select('id, billing_status')
    .in('id', bookingIds);

  if (error) {
    console.warn('[OXV][pilot] listMyCoachInvoices bookings :', error.message);
    return settled;
  }

  for (const b of data ?? []) settled.set(b.id, b.billing_status === 'settled');
  return settled;
}

/**
 * Liste les factures qui concernent le pilote courant, récentes d'abord. La RLS
 * `coach_invoices_pilot_select` borne déjà à `pilot_id = auth.uid()` ; on le
 * filtre aussi explicitement par robustesse. Résout le nom du coach (réel via
 * `listMyCoaches`, repli sur le headline de la fiche, « — » sinon), le lien de
 * paiement (chemin A) et l'état « réglé ».
 */
export async function listMyCoachInvoices(limit = 30): Promise<MyCoachInvoice[]> {
  const { data: auth } = await supabase.auth.getUser();
  const pilotId = auth.user?.id;
  if (!pilotId) return [];

  const { data, error } = await supabase
    .from('coach_invoices')
    .select(
      'id, number, service_date, issued_at, amount_total, currency, coach_id, coaching_booking_id'
    )
    .eq('pilot_id', pilotId)
    .order('issued_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[OXV][pilot] listMyCoachInvoices :', error.message);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const coachIds = Array.from(new Set(rows.map((r) => r.coach_id)));
  const bookingIds = Array.from(
    new Set(rows.map((r) => r.coaching_booking_id).filter((v): v is string => Boolean(v)))
  );

  // Résolutions parallèles, toutes best-effort (voir en-tête).
  const [coaches, directory, settledMap] = await Promise.all([
    listMyCoaches().catch(() => []),
    loadCoachDirectory(coachIds),
    loadSettledBookings(bookingIds),
  ]);

  // Nom réel (coach_pilots) prioritaire ; repli sur le headline de la fiche.
  const realName = new Map<string, string>();
  for (const c of coaches) {
    const name = [c.coachFirstName, c.coachLastName].filter(Boolean).join(' ').trim();
    if (name) realName.set(c.coachId, name);
  }

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    serviceDate: r.service_date ?? null,
    issuedAt: r.issued_at,
    amountTotalCents: r.amount_total,
    currency: r.currency ?? 'EUR',
    coachName: realName.get(r.coach_id) ?? directory.headline.get(r.coach_id) ?? '—',
    settled: r.coaching_booking_id ? (settledMap.get(r.coaching_booking_id) ?? false) : false,
  }));
}
