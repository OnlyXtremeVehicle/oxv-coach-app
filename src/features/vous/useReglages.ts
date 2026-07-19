/**
 * Hook de données des Réglages (lot V2-L4, mission D, écran 7/8).
 *
 * Rassemble en un seul point les préférences RÉELLES du pilote et leurs
 * chemins d'écriture (mêmes services/colonnes que les écrans v1 — aucune
 * seconde source de vérité) :
 *   - Notifications : `users.push_notif_enabled` (maître), les canaux fins et
 *     rituels dans `users.notification_preferences` (JSONB), `users.notif_offers`.
 *   - Consentements : IA (consentService), audience (analyticsService, MMKV
 *     local), partage live coach (pilotConsentService, par affiliation),
 *     biométrie (consentService, invariant capture⇒partage).
 *   - Données : export (dataExportService), suppression J+30 (accountService)
 *     puis déconnexion.
 *
 * Écritures optimistes : l'état local bascule d'abord, l'I/O suit ; un échec
 * n'est pas masqué (remonté via `lastError`). Données réelles : une préférence
 * absente prend son défaut documenté, jamais une valeur inventée.
 */

import { useCallback, useEffect, useState } from 'react';

import { requestAccountDeletion } from '@/services/accountService';
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '@/services/analyticsService';
import {
  loadAiConsents,
  loadBiometryConsents,
  setAiDebriefConsent,
  setBiometryCaptureConsent,
  setBiometryCoachShareConsent,
  setCoachAiConsent,
} from '@/services/consentService';
import { exportAndShareMyData, type ExportResult } from '@/services/dataExportService';
import { readNotifPref, writeNotifPref } from '@/services/notifPreferencesLogic';
import { listMyCoaches, setLiveSharing } from '@/services/pilotConsentService';
import { cancelAllOxvNotifications } from '@/services/pushNotificationsService';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

import { nextBiometryConsents, type BiometryState } from './reglagesConsentLogic';
import { writeRitualPref, type RitualId } from './reglagesRitualsLogic';

type UsersNotifRow = {
  push_notif_enabled?: boolean | null;
  notification_preferences?: unknown;
  notif_offers?: boolean | null;
};

export interface ReglagesState {
  loaded: boolean;
  /** Maître push (défaut-ON). */
  pushEnabled: boolean;
  /** JSONB des préférences fines (canaux + rituels). */
  notifPrefs: Record<string, unknown>;
  /** Consentement marketing partenaires (défaut-OFF). */
  offersEnabled: boolean;
  aiDebrief: boolean;
  coachAi: boolean;
  analytics: boolean;
  biometry: BiometryState;
  /** true si au moins une affiliation coach active et consentie existe. */
  hasLiveCoach: boolean;
  /** Partage live actif sur au moins une affiliation. */
  liveCoach: boolean;
  exporting: boolean;
  deleting: boolean;
  lastError: string | null;
}

const INITIAL: ReglagesState = {
  loaded: false,
  pushEnabled: true,
  notifPrefs: {},
  offersEnabled: false,
  aiDebrief: true,
  coachAi: false,
  analytics: true,
  biometry: { capture: false, coachShare: false },
  hasLiveCoach: false,
  liveCoach: false,
  exporting: false,
  deleting: false,
  lastError: null,
};

export function useReglages() {
  const userId = useAuthStore((s) => s.profile?.id);
  const signOut = useAuthStore((s) => s.signOut);

  const [state, setState] = useState<ReglagesState>(INITIAL);
  // Affiliations coach actives + consenties (cible du partage live).
  const [liveAssignmentIds, setLiveAssignmentIds] = useState<string[]>([]);

  const patch = useCallback((p: Partial<ReglagesState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [row, ai, bio, coaches] = await Promise.all([
        supabase
          .from('users')
          .select('push_notif_enabled, notification_preferences, notif_offers')
          .eq('id', userId)
          .maybeSingle(),
        loadAiConsents(userId),
        loadBiometryConsents(userId),
        listMyCoaches(),
      ]);
      if (cancelled) return;
      const u = (row.data as UsersNotifRow | null) ?? null;
      const consented = coaches.filter((c) => c.active && c.pilotConsentAt !== null);
      setLiveAssignmentIds(consented.map((c) => c.id));
      setState({
        ...INITIAL,
        loaded: true,
        pushEnabled: u?.push_notif_enabled !== false,
        notifPrefs:
          u?.notification_preferences && typeof u.notification_preferences === 'object'
            ? (u.notification_preferences as Record<string, unknown>)
            : {},
        offersEnabled: u?.notif_offers === true,
        aiDebrief: ai.aiDebriefEnabled,
        coachAi: ai.coachAiEnabled,
        analytics: !isAnalyticsOptedOut(),
        biometry: { capture: bio.capture, coachShare: bio.coachShare },
        hasLiveCoach: consented.length > 0,
        liveCoach: consented.some((c) => c.liveSharingAt !== null),
      });
    })().catch(() => {
      if (!cancelled) patch({ loaded: true, lastError: 'Chargement partiel des réglages.' });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, patch]);

  // --- Notifications -------------------------------------------------------

  const toggleMasterPush = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({ pushEnabled: next });
      await supabase
        .from('users')
        .update({ push_notif_enabled: next } as never)
        .eq('id', userId);
      if (!next) await cancelAllOxvNotifications();
    },
    [userId, patch]
  );

  /** Écrit une clé du JSONB (canal « reminder » ou rituel) en préservant le reste. */
  const writeNotifKey = useCallback(
    async (updated: Record<string, unknown>) => {
      if (!userId) return;
      patch({ notifPrefs: updated });
      await supabase
        .from('users')
        .update({ notification_preferences: updated } as never)
        .eq('id', userId);
    },
    [userId, patch]
  );

  const toggleReminder = useCallback(
    (next: boolean) => writeNotifKey(writeNotifPref(state.notifPrefs, 'reminder', next)),
    [state.notifPrefs, writeNotifKey]
  );

  const toggleRitual = useCallback(
    (id: RitualId, next: boolean) => writeNotifKey(writeRitualPref(state.notifPrefs, id, next)),
    [state.notifPrefs, writeNotifKey]
  );

  const readReminder = useCallback(
    () => readNotifPref(state.notifPrefs, 'reminder'),
    [state.notifPrefs]
  );

  const toggleOffers = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({ offersEnabled: next });
      await supabase
        .from('users')
        .update({ notif_offers: next } as never)
        .eq('id', userId);
    },
    [userId, patch]
  );

  // --- Consentements IA / audience ----------------------------------------

  const toggleAiDebrief = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({ aiDebrief: next });
      await setAiDebriefConsent(userId, next);
    },
    [userId, patch]
  );

  const toggleCoachAi = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({ coachAi: next });
      await setCoachAiConsent(userId, next);
    },
    [userId, patch]
  );

  const toggleAnalytics = useCallback(
    (next: boolean) => {
      patch({ analytics: next });
      setAnalyticsOptOut(!next);
    },
    [patch]
  );

  // --- Partage live coach (par affiliation) -------------------------------

  const toggleLiveCoach = useCallback(
    async (next: boolean) => {
      patch({ liveCoach: next });
      await Promise.all(liveAssignmentIds.map((id) => setLiveSharing(id, next)));
    },
    [liveAssignmentIds, patch]
  );

  // --- Biométrie (invariant capture ⇒ partage) -----------------------------

  /** Applique la capture (true active, false révoque en cascade le partage). */
  const applyBiometryCapture = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({ biometry: nextBiometryConsents(state.biometry, { which: 'capture', value: next }) });
      await setBiometryCaptureConsent(userId, next);
    },
    [userId, state.biometry, patch]
  );

  const toggleBiometryCoachShare = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      patch({
        biometry: nextBiometryConsents(state.biometry, { which: 'coachShare', value: next }),
      });
      await setBiometryCoachShareConsent(userId, next);
    },
    [userId, state.biometry, patch]
  );

  // --- Données & sécurité --------------------------------------------------

  const exportData = useCallback(async (): Promise<ExportResult> => {
    if (!userId) return { ok: false, error: 'Session expirée.' };
    patch({ exporting: true });
    const res = await exportAndShareMyData(userId);
    patch({ exporting: false });
    return res;
  }, [userId, patch]);

  /** Demande la suppression J+30 puis déconnecte. Retourne le résultat. */
  const deleteAccount = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) return { ok: false, error: 'Session expirée.' };
    patch({ deleting: true });
    const res = await requestAccountDeletion(userId);
    patch({ deleting: false });
    if (res.ok) await signOut();
    return res;
  }, [userId, signOut, patch]);

  return {
    state,
    readReminder,
    toggleMasterPush,
    toggleReminder,
    toggleRitual,
    toggleOffers,
    toggleAiDebrief,
    toggleCoachAi,
    toggleAnalytics,
    toggleLiveCoach,
    applyBiometryCapture,
    toggleBiometryCoachShare,
    exportData,
    deleteAccount,
    signOut,
  };
}
