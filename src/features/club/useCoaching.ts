/**
 * Hook du COACHING (V2-L5, écran 2/7) — orchestration des services EXISTANTS.
 *
 * Trois onglets, trois sources réelles :
 *  - Trouver : `listPublishedCoaches` → cartes SANS score (coachCardMap) ; la
 *    fiche charge bio + créneaux + avis EN CITATIONS (jamais d'étoile).
 *  - Mon coach : `pilotConsentService` (binômes + consentements granulaires,
 *    révocation immédiate) + `pilotCoachBillingService` (factures, flag
 *    `coach_billing` respecté fail-closed).
 *  - Demandes : `listMyBookings` (timeline d'états) + avis post-séance en texte
 *    libre (jamais d'étoile).
 *
 * Le lot ne crée aucun service. Toute source échoue proprement (best-effort).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cancelBooking,
  createReview,
  getCoachProfile,
  listCoachReviews,
  listMyBookings,
  listPublishedCoaches,
  requestBooking,
  type CoachAvailabilitySlot,
  type MyBooking,
  type RequestBookingInput,
} from '@/services/coachMarketplaceService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { listMyCoachInvoices, type MyCoachInvoice } from '@/services/pilotCoachBillingService';
import {
  listMyCoaches,
  revokeConsent,
  setLiveSharing,
  giveConsent,
  setConsentLevel,
  type CoachAccessLevel,
  type MyCoachAssignment,
} from '@/services/pilotConsentService';

import {
  coachCardMap,
  reviewCitations,
  sortCoachCards,
  type CoachCardVM,
  type ReviewCitationVM,
} from './coachingLogic';

/** Fiche coach chargée à l'ouverture de la Sheet (découverte). */
export interface CoachFiche {
  coachId: string;
  name: string;
  photoUrl: string | null;
  bio: string | null;
  specialties: string[];
  circuits: string[];
  citations: ReviewCitationVM[];
  availability: CoachAvailabilitySlot[];
}

export interface Coaching {
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  /** Onglet Trouver — cartes sans score, tri neutre. */
  coaches: CoachCardVM[];
  /** Onglet Mon coach — binômes actifs (souvent un seul). */
  assignments: MyCoachAssignment[];
  invoices: MyCoachInvoice[];
  /** Flag `coach_billing` (fail-closed) — masque la facturation si OFF. */
  billingEnabled: boolean;
  /** Onglet Demandes — les plus récentes d'abord. */
  bookings: MyBooking[];
  refresh: () => void;
  /** Charge la fiche d'un coach (bio, créneaux, avis citations). */
  loadFiche: (coachId: string) => Promise<CoachFiche | null>;
  submitBooking: (input: RequestBookingInput) => Promise<{ ok: boolean; error?: string }>;
  setConsent: (
    assignmentId: string,
    on: boolean,
    level?: CoachAccessLevel
  ) => Promise<{ ok: boolean; error?: string }>;
  setLevel: (
    assignmentId: string,
    level: CoachAccessLevel
  ) => Promise<{ ok: boolean; error?: string }>;
  setLive: (assignmentId: string, on: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** Fin de binôme : révoque le consentement (le coach cesse de voir les données). */
  endBinome: (assignmentId: string) => Promise<{ ok: boolean; error?: string }>;
  cancelRequest: (bookingId: string) => Promise<{ ok: boolean; error?: string }>;
  submitReview: (input: {
    coachId: string;
    bookingId?: string | null;
    comment: string;
    pilotFirstName?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function useCoaching(): Coaching {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [coaches, setCoaches] = useState<CoachCardVM[]>([]);
  const [assignments, setAssignments] = useState<MyCoachAssignment[]>([]);
  const [invoices, setInvoices] = useState<MyCoachInvoice[]>([]);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const aliveRef = useRef(true);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setStatus('loading');

    const [coachesRes, assignRes, bookingsRes, billingRes] = await Promise.allSettled([
      listPublishedCoaches(),
      listMyCoaches(),
      listMyBookings(),
      isFlagEnabled('coach_billing'),
    ]);
    if (!aliveRef.current) return;

    const billing = billingRes.status === 'fulfilled' ? billingRes.value : false;
    setBillingEnabled(billing);

    // Factures seulement si le flag est ON (fail-closed) — sinon liste vide.
    let invoiceList: MyCoachInvoice[] = [];
    if (billing) {
      invoiceList = await listMyCoachInvoices().catch(() => []);
    }
    if (!aliveRef.current) return;

    const allFailed = [coachesRes, assignRes, bookingsRes].every((r) => r.status === 'rejected');

    setCoaches(
      coachesRes.status === 'fulfilled' ? sortCoachCards(coachesRes.value.map(coachCardMap)) : []
    );
    setAssignments(assignRes.status === 'fulfilled' ? assignRes.value.filter((a) => a.active) : []);
    setBookings(bookingsRes.status === 'fulfilled' ? bookingsRes.value : []);
    setInvoices(invoiceList);

    setStatus(allFailed ? 'error' : 'ready');
    setRefreshing(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load('initial');
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    void load('refresh');
  }, [load]);

  const loadFiche = useCallback(async (coachId: string): Promise<CoachFiche | null> => {
    const [profileRes, reviewsRes] = await Promise.all([
      getCoachProfile(coachId),
      listCoachReviews(coachId),
    ]);
    if (profileRes === null) return null;
    const { profile, availability } = profileRes;
    return {
      coachId,
      name: profile.headline?.trim() ? profile.headline.trim() : 'Coach OXV',
      photoUrl: profile.photoUrl ?? null,
      bio: profile.bio ?? null,
      specialties: profile.specialties,
      circuits: profile.circuits,
      // DOCTRINE : citations factuelles uniquement, jamais la moyenne étoilée.
      citations: reviewCitations(reviewsRes.reviews),
      availability,
    };
  }, []);

  const submitBooking = useCallback(async (input: RequestBookingInput) => {
    const res = await requestBooking(input);
    if (res.ok) {
      const next = await listMyBookings().catch(() => []);
      if (aliveRef.current) setBookings(next);
    }
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  }, []);

  const reloadAssignments = useCallback(async () => {
    const next = await listMyCoaches().catch(() => []);
    if (aliveRef.current) setAssignments(next.filter((a) => a.active));
  }, []);

  const setConsent = useCallback(
    async (assignmentId: string, on: boolean, level: CoachAccessLevel = 'lecture_simple') => {
      const res = on ? await giveConsent(assignmentId, level) : await revokeConsent(assignmentId);
      if (res.ok) await reloadAssignments();
      return res;
    },
    [reloadAssignments]
  );

  const setLevel = useCallback(
    async (assignmentId: string, level: CoachAccessLevel) => {
      const res = await setConsentLevel(assignmentId, level);
      if (res.ok) await reloadAssignments();
      return res;
    },
    [reloadAssignments]
  );

  const setLive = useCallback(
    async (assignmentId: string, on: boolean) => {
      const res = await setLiveSharing(assignmentId, on);
      if (res.ok) await reloadAssignments();
      return res;
    },
    [reloadAssignments]
  );

  const endBinome = useCallback(
    async (assignmentId: string) => {
      const res = await revokeConsent(assignmentId);
      if (res.ok) await reloadAssignments();
      return res;
    },
    [reloadAssignments]
  );

  const cancelRequest = useCallback(async (bookingId: string) => {
    const res = await cancelBooking(bookingId);
    if (res.ok) {
      const next = await listMyBookings().catch(() => []);
      if (aliveRef.current) setBookings(next);
    }
    return res;
  }, []);

  const submitReview = useCallback(
    async (input: {
      coachId: string;
      bookingId?: string | null;
      comment: string;
      pilotFirstName?: string | null;
    }) => {
      const res = await createReview({
        coachId: input.coachId,
        bookingId: input.bookingId ?? null,
        // La note n'est pas un classement : on dépose une note neutre stable (3)
        // pour satisfaire la contrainte NOT NULL de la table, mais elle n'est
        // JAMAIS affichée (doctrine : citations uniquement, aucune étoile).
        rating: 3,
        comment: input.comment,
        pilotFirstName: input.pilotFirstName ?? null,
      });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    []
  );

  return {
    status,
    refreshing,
    coaches,
    assignments,
    invoices,
    billingEnabled,
    bookings,
    refresh,
    loadFiche,
    submitBooking,
    setConsent,
    setLevel,
    setLive,
    endBinome,
    cancelRequest,
    submitReview,
  };
}
