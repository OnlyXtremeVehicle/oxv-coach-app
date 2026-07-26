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
  isAcceptablePaymentLink,
  linesAmountHtCents,
  tauxTvaUtilisable,
  type VatRegime,
} from '@/services/coachBillingLogic';
import { listMyPilots } from '@/services/coachService';

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
    // `vat_rate` est une colonne `numeric` : PostgREST la rend en CHAÎNE au
    // runtime malgré le type TypeScript. On coerce ici, à la frontière, une
    // seule fois — sans quoi tout calcul en aval traite « 20.00 » comme absent.
    vatRate: tauxTvaUtilisable(r.vat_rate),
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
  // Garde SEC-1 : payment_link est publié (policy read_published) — on refuse
  // tout ce qui n'est pas une URL http(s), en particulier un IBAN.
  if (fields.paymentLink !== undefined && !isAcceptablePaymentLink(fields.paymentLink)) {
    return { ok: false, error: 'invalid_payment_link' };
  }
  const patch: Record<string, unknown> = { coach_id: coachId };
  if (fields.paymentLink !== undefined) {
    const trimmed = (fields.paymentLink ?? '').trim();
    patch.payment_link = trimmed === '' ? null : trimmed;
  }
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

export interface CoachInvoiceSummary {
  id: string;
  number: string;
  issuedAt: string;
  serviceDate: string | null;
  amountTotalCents: number;
  pilotId: string | null;
}

interface InvoiceRow {
  id: string;
  number: string;
  issued_at: string;
  service_date: string | null;
  amount_total: number;
  pilot_id: string | null;
}

/** Factures émises par le coach courant (les siennes seulement, RLS). */
export async function listMyInvoices(limit = 30): Promise<CoachInvoiceSummary[]> {
  const coachId = await currentCoachId();
  if (!coachId) return [];
  const { data } = await supabase
    .from('coach_invoices')
    .select('id, number, issued_at, service_date, amount_total, pilot_id')
    .eq('coach_id', coachId)
    .order('issued_at', { ascending: false })
    .limit(limit);
  const rows = (data as unknown as InvoiceRow[] | null) ?? [];
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    issuedAt: r.issued_at,
    serviceDate: r.service_date ?? null,
    amountTotalCents: r.amount_total,
    pilotId: r.pilot_id ?? null,
  }));
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
  /** Nom du destinataire, FIGÉ à l'émission (snapshot conformité). */
  buyerName?: string | null;
  bookingId?: string | null;
  serviceDate?: string | null;
  lines: InvoiceLine[];
  year: number;
}): Promise<{ ok: boolean; number?: string; id?: string; error?: string }> {
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

  // Source unique du HT (même calcul que l'aperçu écran, cf. coachBillingLogic).
  const amountHtCents = linesAmountHtCents(input.lines);
  const totals = computeInvoiceTotals(amountHtCents, profile.vatRegime, profile.vatRate);

  // Une facture est un document légal : on refuse de l'émettre plutôt que d'y
  // imprimer une TVA à zéro pour un coach assujetti. Le régime dit qu'il y a de
  // la TVA, le taux est inexploitable : c'est un profil à compléter, pas une
  // facture à sortir.
  if (profile.vatRegime !== 'franchise' && totals.vatRate === null) {
    return { ok: false, error: 'vat_rate_missing' };
  }

  const { data: seq, error: rpcError } = await supabase.rpc(
    'next_coach_invoice_number' as never,
    {
      p_coach: coachId,
      p_year: input.year,
    } as never
  );
  // Un séquence < 1 (ou 0, ou non entière) est une anomalie : on refuse plutôt
  // que d'émettre un numéro masqué en « ANNÉE-0001 » (collision silencieuse).
  if (rpcError || !Number.isInteger(seq) || (seq as number) < 1) {
    return { ok: false, error: rpcError?.message ?? 'numbering_failed' };
  }
  const number = formatInvoiceNumber(input.year, seq);

  const { data: inserted, error } = await supabase
    .from('coach_invoices')
    .insert({
      coach_id: coachId,
      number,
      pilot_id: input.pilotId ?? null,
      buyer_name: input.buyerName?.trim() || null,
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
    } as never)
    .select('id')
    .single();
  if (error) {
    // Le numéro a DÉJÀ été consommé par `next_coach_invoice_number` : la
    // séquence a avancé, et rien ne permet de la faire reculer. Se taire
    // laisserait un trou inexpliqué dans une numérotation légale. On rend donc
    // le numéro réservé avec l'échec, pour que l'écran puisse le dire et que le
    // coach sache quoi expliquer à son comptable.
    return { ok: false, error: error.message, number };
  }
  return { ok: true, number, id: (inserted as { id?: string } | null)?.id };
}

export interface InvoiceSeller {
  name: string | null;
  address: string | null;
  siret: string | null;
  legalForm: string | null;
  vatRegime: VatRegime;
}

export interface CoachInvoiceDetail {
  id: string;
  number: string;
  issuedAt: string;
  serviceDate: string | null;
  currency: string;
  lines: InvoiceLine[];
  amountHtCents: number;
  vatRate: number | null;
  vatAmountCents: number;
  amountTotalCents: number;
  vatNote: string | null;
  seller: InvoiceSeller;
  pilotId: string | null;
  /** Nom du destinataire (résolu parmi les binômes du coach), sinon null. */
  buyerName: string | null;
}

interface InvoiceDetailRow {
  id: string;
  number: string;
  issued_at: string;
  service_date: string | null;
  currency: string | null;
  lines: unknown;
  amount_ht: number;
  vat_rate: number | null;
  vat_amount: number | null;
  amount_total: number;
  vat_note: string | null;
  seller: unknown;
  pilot_id: string | null;
  buyer_name: string | null;
}

function parseLines(raw: unknown): InvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      return {
        label: typeof o.label === 'string' ? o.label : '',
        quantity: typeof o.quantity === 'number' ? o.quantity : 0,
        unitPriceCents: typeof o.unitPriceCents === 'number' ? o.unitPriceCents : 0,
      };
    })
    .filter((l) => l.label.length > 0);
}

function parseSeller(raw: unknown): InvoiceSeller {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : null,
    address: typeof o.address === 'string' ? o.address : null,
    siret: typeof o.siret === 'string' ? o.siret : null,
    legalForm: typeof o.legalForm === 'string' ? o.legalForm : null,
    vatRegime: (o.vatRegime as VatRegime) ?? 'franchise',
  };
}

/**
 * Détail complet d'une facture du coach courant (RLS : la sienne). Résout le nom
 * du destinataire parmi les binômes du coach (sans exposer d'autres données).
 */
export async function getInvoiceDetail(id: string): Promise<CoachInvoiceDetail | null> {
  const coachId = await currentCoachId();
  if (!coachId) return null;
  const { data } = await supabase
    .from('coach_invoices')
    .select(
      'id, number, issued_at, service_date, currency, lines, amount_ht, vat_rate, vat_amount, amount_total, vat_note, seller, pilot_id, buyer_name'
    )
    .eq('id', id)
    .eq('coach_id', coachId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as InvoiceDetailRow;

  // Priorité au nom FIGÉ à l'émission (conformité). Repli sur résolution vive
  // uniquement pour les factures antérieures au snapshot (buyer_name absent).
  let buyerName: string | null = r.buyer_name?.trim() || null;
  if (!buyerName && r.pilot_id) {
    const pilots = await listMyPilots();
    const match = pilots.find((p) => p.pilotId === r.pilot_id);
    if (match) buyerName = [match.firstName, match.lastName].filter(Boolean).join(' ') || null;
  }

  return {
    id: r.id,
    number: r.number,
    issuedAt: r.issued_at,
    serviceDate: r.service_date ?? null,
    currency: r.currency ?? 'EUR',
    lines: parseLines(r.lines),
    amountHtCents: r.amount_ht,
    vatRate: r.vat_rate ?? null,
    vatAmountCents: r.vat_amount ?? 0,
    amountTotalCents: r.amount_total,
    vatNote: r.vat_note ?? null,
    seller: parseSeller(r.seller),
    pilotId: r.pilot_id ?? null,
    buyerName,
  };
}
