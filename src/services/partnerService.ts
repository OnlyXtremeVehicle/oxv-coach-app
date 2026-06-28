/**
 * Service partenaire — lecture du compte business, des offres et des leads du
 * partenaire courant. Marketplace (§8, §8.1, §22). Aucun accès à la télémétrie.
 *
 * RLS (migration 0017) :
 *   - `partner_accounts` : le partenaire lit/édite le sien ; admin tout ; les
 *     comptes `validated` sont publics (pilote/coach les voient).
 *   - `partner_offers` : le partenaire CRUD les siennes ; pilote lit `published`.
 *   - `partner_leads` : le partenaire lit les siens ; pilote crée (consentement
 *     requis) ; coach JAMAIS.
 */

import { supabase } from '@/lib/supabase';

export type PartnerStatus = 'pending' | 'validated' | 'disabled';
export type OfferStatus = 'draft' | 'published' | 'archived';
export type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost' | 'archived';

export interface PartnerAccount {
  id: string;
  profileId: string;
  displayName: string;
  type: string;
  description: string | null;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPolicy: string | null;
  status: PartnerStatus;
}

export interface PartnerOffer {
  id: string;
  partnerId: string;
  title: string;
  description: string | null;
  priceEur: number | null;
  quota: number | null;
  status: OfferStatus;
}

export interface PartnerLead {
  id: string;
  partnerId: string;
  pilotId: string;
  offerId: string | null;
  consentContact: boolean;
  consentAt: string;
  channel: string;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
}

/** Compte partenaire du user courant, ou null s'il n'en a pas encore. */
export async function loadMyPartnerAccount(): Promise<PartnerAccount | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('partner_accounts')
    .select(
      'id, profile_id, display_name, type, description, logo_url, contact_email, contact_policy, status'
    )
    .eq('profile_id', uid)
    .maybeSingle();
  if (error || !data) {
    if (error) console.warn('[OXV][partner] loadMyPartnerAccount :', error.message);
    return null;
  }
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    profileId: r.profile_id as string,
    displayName: r.display_name as string,
    type: r.type as string,
    description: (r.description as string | null) ?? null,
    logoUrl: (r.logo_url as string | null) ?? null,
    contactEmail: (r.contact_email as string | null) ?? null,
    contactPolicy: (r.contact_policy as string | null) ?? null,
    status: r.status as PartnerStatus,
  };
}

/** Offres du partenaire (toutes : draft/published/archived). */
export async function listMyOffers(partnerId: string): Promise<PartnerOffer[]> {
  const { data, error } = await supabase
    .from('partner_offers')
    .select('id, partner_id, title, description, price_eur, quota, status')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][partner] listMyOffers :', error.message);
    return [];
  }
  return (data ?? []).map((r0) => {
    const r = r0 as Record<string, unknown>;
    return {
      id: r.id as string,
      partnerId: r.partner_id as string,
      title: r.title as string,
      description: (r.description as string | null) ?? null,
      priceEur: (r.price_eur as number | null) ?? null,
      quota: (r.quota as number | null) ?? null,
      status: r.status as OfferStatus,
    };
  });
}

/** Leads reçus par le partenaire (demandes de contact consenties). */
export async function listMyLeads(partnerId: string): Promise<PartnerLead[]> {
  const { data, error } = await supabase
    .from('partner_leads')
    .select(
      'id, partner_id, pilot_id, offer_id, consent_contact, consent_at, channel, status, notes, created_at'
    )
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[OXV][partner] listMyLeads :', error.message);
    return [];
  }
  return (data ?? []).map((r0) => {
    const r = r0 as Record<string, unknown>;
    return {
      id: r.id as string,
      partnerId: r.partner_id as string,
      pilotId: r.pilot_id as string,
      offerId: (r.offer_id as string | null) ?? null,
      consentContact: Boolean(r.consent_contact),
      consentAt: r.consent_at as string,
      channel: r.channel as string,
      status: r.status as LeadStatus,
      notes: (r.notes as string | null) ?? null,
      createdAt: r.created_at as string,
    };
  });
}

export interface UpsertOfferInput {
  id: string | null;
  partnerId: string;
  title: string;
  description: string | null;
  priceEur: number | null;
  quota: number | null;
  status: OfferStatus;
}

/** Crée (id null) ou met à jour une offre du partenaire. RLS : owns_partner_account. */
export async function upsertOffer(
  input: UpsertOfferInput
): Promise<{ ok: boolean; error?: string }> {
  const row = {
    partner_id: input.partnerId,
    title: input.title,
    description: input.description,
    price_eur: input.priceEur,
    quota: input.quota,
    status: input.status,
  };
  const { error } = input.id
    ? await supabase.from('partner_offers').update(row).eq('id', input.id)
    : await supabase.from('partner_offers').insert(row);
  if (error) {
    console.warn('[OXV][partner] upsertOffer :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Supprime une offre du partenaire. RLS : owns_partner_account ou admin. */
export async function deleteOffer(id: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('partner_offers').delete().eq('id', id);
  if (error) {
    console.warn('[OXV][partner] deleteOffer :', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
