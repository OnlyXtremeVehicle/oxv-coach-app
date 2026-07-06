/**
 * Facturation coach — service (P2, VISION_COACH_STUDIO.md).
 *
 * Le CHOIX appartient au coach : `invoicing_assist_enabled`. S'il l'active et
 * renseigne son identité de facturation, l'app l'aide à émettre SA facture
 * (émetteur = le coach ; paiement direct au coach, hors OXV). Numéro alloué par
 * la fonction serveur atomique (séquence propre à chaque coach). RLS : le coach
 * ne gère que SES factures ; le pilote lit celles qui le concernent.
 *
 * ⚠ Gabarit + régime TVA à faire valider par un comptable ; le coach reste
 * responsable de SA facturation (l'app = outil). Rendu PDF = étape ultérieure.
 */

import { supabase } from '@/lib/supabase';
import {
  canIssueInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
  type VatRegime,
} from '@/services/coachBillingLogic';

export interface CoachBillingProfile {
  paymentLink: string | null;
  invoicingAssistEnabled: boolean;
  billingName: string | null;
  billingAddress: string | null;
  billingSiret: string | null;
  billingLegalForm: string | null;
  vatRegime: VatRegime;
  vatRate: number | null;
}

interface ProfileRow {
  payment_link: string | null;
  invoicing_assist_enabled: boolean | null;
  billing_name: string | null;
  billing_address: string | null;
  billing_siret: string | null;
  billing_legal_form: string | null;
  vat_regime: string | null;
  vat_rate: number | null;
}

async function currentCoachId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

/** Profil de facturation du coach courant (null si pas de profil). */
export async function getMyBillingProfile(): Promise<CoachBillingProfile | null> {
  const coachId = await currentCoachId();
  if (!coachId) return null;
  const { data } = await supabase
    .from('coach_profiles')
    .select('*')
    .eq('coach_id', coachId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as ProfileRow;
  return {
    paymentLink: r.payment_link ?? null,
    invoicingAssistEnabled: Boolean(r.invoicing_assist_enabled),
    billingName: r.billing_name ?? null,
    billingAddress: r.billing_address ?? null,
    billingSiret: r.billing_siret ?? null,
    billingLegalForm: r.billing_legal_form ?? null,
    vatRegime: (r.vat_regime as VatRegime) ?? 'franchise',
    vatRate: r.vat_rate ?? null,
  };
}

/** LE CHOIX du coach : activer/désactiver l'aide à la facturation. */
export async function setInvoicingAssist(
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  const coachId = await currentCoachId();
  if (!coachId) return { ok: false, error: 'not_authenticated' };
  const { error } = await supabase
    .from('coach_profiles')
    .upsert({ coach_id: coachId, invoicing_assist_enabled: enabled } as never, {
      onConflict: 'coach_id',
    });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Met à jour l'identité de facturation du coach. */
export async function updateMyBillingProfile(
  fields: Partial<Omit<CoachBillingProfile, 'invoicingAssistEnabled'>>
): Promise<{ ok: boolean; error?: string }> {
  const coachId = await currentCoachId();
  if (!coachId) return { ok: false, error: 'not_authenticated' };
  const patch: Record<string, unknown> = { coach_id: coachId };
  if (fields.paymentLink !== undefined) patch.payment_link = fields.paymentLink;
  if (fields.billingName !== undefined) patch.billing_name = fields.billingName;
  if (fields.billingAddress !== undefined) patch.billing_address = fields.billingAddress;
  if (fields.billingSiret !== undefined) patch.billing_siret = fields.billingSiret;
  if (fields.billingLegalForm !== undefined) patch.billing_legal_form = fields.billingLegalForm;
  if (fields.vatRegime !== undefined) patch.vat_regime = fields.vatRegime;
  if (fields.vatRate !== undefined) patch.vat_rate = fields.vatRate;
  const { error } = await supabase
    .from('coach_profiles')
    .upsert(patch as never, { onConflict: 'coach_id' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export interface InvoiceLine {
  label: string;
  quantity: number;
  unitPriceCents: number;
}

/**
 * Émet une facture pour le coach courant. Garde-fous : aide activée + identité
 * renseignée (canIssueInvoice). Numéro atomique via next_coach_invoice_number.
 * Le PDF est une étape ultérieure (gabarit à valider) ; ici on crée l'écriture.
 */
export async function issueInvoice(input: {
  pilotId?: string | null;
  bookingId?: string | null;
  serviceDate?: string | null;
  lines: InvoiceLine[];
  year: number;
}): Promise<{ ok: boolean; number?: string; error?: string }> {
  const coachId = await currentCoachId();
  if (!coachId) return { ok: false, error: 'not_authenticated' };

  const profile = await getMyBillingProfile();
  if (
    !profile ||
    !canIssueInvoice({
      invoicingAssistEnabled: profile.invoicingAssistEnabled,
      billingName: profile.billingName,
      billingSiret: profile.billingSiret,
    })
  ) {
    return { ok: false, error: 'billing_profile_incomplete' };
  }

  const amountHtCents = input.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  const totals = computeInvoiceTotals(amountHtCents, profile.vatRegime, profile.vatRate);

  const { data: seq, error: rpcError } = await supabase.rpc(
    'next_coach_invoice_number' as never,
    {
      p_coach: coachId,
      p_year: input.year,
    } as never
  );
  if (rpcError || typeof seq !== 'number') {
    return { ok: false, error: rpcError?.message ?? 'numbering_failed' };
  }
  const number = formatInvoiceNumber(input.year, seq);

  const { error } = await supabase.from('coach_invoices').insert({
    coach_id: coachId,
    number,
    pilot_id: input.pilotId ?? null,
    coaching_booking_id: input.bookingId ?? null,
    service_date: input.serviceDate ?? null,
    lines: input.lines as never,
    amount_ht: totals.amountHt,
    vat_rate: totals.vatRate,
    vat_amount: totals.vatAmount,
    amount_total: totals.amountTotal,
    vat_note: totals.vatNote,
    seller: {
      name: profile.billingName,
      address: profile.billingAddress,
      siret: profile.billingSiret,
      legalForm: profile.billingLegalForm,
      vatRegime: profile.vatRegime,
    } as never,
  } as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true, number };
}
