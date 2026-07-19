/**
 * useClubPartenaires — chargement de l'écran PARTENAIRES (lot V2-L5, Mission B).
 *
 * Services EXISTANTS uniquement :
 *   - partnerService.listMarketplace : partenaires VALIDÉS + offres PUBLIÉES
 *     (via RLS) ;
 *   - partnerService.listMyPilotLeads : partenaires déjà sollicités ;
 *   - partnerService.requestPartnerContact : mise en relation CONSENTIE
 *     (coordonnées uniquement — JAMAIS de télémétrie, garde-fou v1).
 *
 * Mapping pur dans `partenairesLogic` (testé). Catalogue vide = StateView
 * empty côté écran, jamais une carte fabriquée.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listMarketplace,
  listMyPilotLeads,
  requestPartnerContact,
  type MarketplacePartner,
} from '@/services/partnerService';

import { primaryOfferId, toPartnerCards, type PartnerCardVM } from './partenairesLogic';

export interface ClubPartenaires {
  status: 'loading' | 'ready' | 'error';
  /** Partenaires bruts (pour la fiche Sheet : description, offres complètes). */
  partners: MarketplacePartner[];
  /** Cartes prêtes pour la FlashList. */
  cards: PartnerCardVM[];
  /** Partenaire dont la demande est en cours (bouton occupé), ou null. */
  busyId: string | null;
  /**
   * Mise en relation CONSENTIE : à n'appeler qu'APRÈS confirmation explicite
   * du consentement. Transmet les coordonnées + l'offre primaire, jamais de
   * donnée de pilotage. Retourne true si la demande a abouti.
   */
  requestContact: (partnerId: string) => Promise<boolean>;
  reload: () => void;
}

export function useClubPartenaires(): ClubPartenaires {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [partners, setPartners] = useState<MarketplacePartner[]>([]);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const [list, leads] = await Promise.all([listMarketplace(), listMyPilotLeads()]);
      if (!alive.current) return;
      setPartners(list);
      setRequestedIds(new Set(leads.map((l) => l.partnerId)));
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setStatus('loading');
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  const requestContact = useCallback(
    async (partnerId: string): Promise<boolean> => {
      if (busyId) return false;
      const partner = partners.find((p) => p.id === partnerId);
      if (!partner) return false;
      setBusyId(partnerId);
      try {
        const res = await requestPartnerContact({
          partnerId,
          offerId: primaryOfferId(partner),
        });
        if (res.ok && alive.current) {
          setRequestedIds((prev) => new Set(prev).add(partnerId));
        }
        return res.ok;
      } finally {
        if (alive.current) setBusyId(null);
      }
    },
    [busyId, partners]
  );

  const reload = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  return {
    status,
    partners,
    cards: toPartnerCards(partners, requestedIds),
    busyId,
    requestContact,
    reload,
  };
}
