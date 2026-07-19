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
 * Écritures optimistes : l'état local bascule d'abord, l'I/O suit. supabase-js
 * ne rejette PAS sur erreur RLS/contrainte — chaque bascule inspecte donc le
 * retour (`{ error }` direct, ou `{ ok }` des setters de service) et, sur échec,
 * ANNULE l'état optimiste (rollback vers la valeur précédente) puis pose
 * `lastError`. Rien n'est jamais affiché comme « activé » si l'écriture a raté.
 *
 * Exception PESSIMISTE — révocation de la capture cardio (donnée de santé) :
 * l'UI ne passe OFF qu'APRÈS confirmation serveur, jamais avant (on ne prétend
 * pas avoir coupé une collecte de santé qui resterait horodatée en base).
 *
 * Données réelles : une préférence absente prend son défaut documenté, jamais
 * une valeur inventée.
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

// Messages d'échec (factuels, vouvoiement, sans emoji, non prescriptifs). Posés
// dans `lastError` quand une écriture Supabase renvoie `{ error }` : l'état
// optimiste est alors annulé (rollback) et l'écran affiche ce message.
const WRITE_ERROR = 'Réglage non enregistré. Vérifiez votre connexion et réessayez.';
const REVOKE_ERROR = 'La collecte n’a pas pu être arrêtée. Réessayez.';

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
      const prev = state.pushEnabled;
      patch({ pushEnabled: next });
      const { error } = await supabase
        .from('users')
        .update({ push_notif_enabled: next } as never)
        .eq('id', userId);
      if (error) {
        patch({ pushEnabled: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
      if (!next) await cancelAllOxvNotifications();
    },
    [userId, state.pushEnabled, patch]
  );

  /** Écrit une clé du JSONB (canal « reminder » ou rituel) en préservant le reste. */
  const writeNotifKey = useCallback(
    async (updated: Record<string, unknown>) => {
      if (!userId) return;
      const prev = state.notifPrefs;
      patch({ notifPrefs: updated });
      const { error } = await supabase
        .from('users')
        .update({ notification_preferences: updated } as never)
        .eq('id', userId);
      if (error) {
        patch({ notifPrefs: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
    },
    [userId, state.notifPrefs, patch]
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
      const prev = state.offersEnabled;
      patch({ offersEnabled: next });
      const { error } = await supabase
        .from('users')
        .update({ notif_offers: next } as never)
        .eq('id', userId);
      if (error) {
        patch({ offersEnabled: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
    },
    [userId, state.offersEnabled, patch]
  );

  // --- Consentements IA / audience ----------------------------------------

  const toggleAiDebrief = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      const prev = state.aiDebrief;
      patch({ aiDebrief: next });
      const res = await setAiDebriefConsent(userId, next);
      if (!res.ok) {
        patch({ aiDebrief: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
    },
    [userId, state.aiDebrief, patch]
  );

  const toggleCoachAi = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      const prev = state.coachAi;
      patch({ coachAi: next });
      const res = await setCoachAiConsent(userId, next);
      if (!res.ok) {
        patch({ coachAi: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
    },
    [userId, state.coachAi, patch]
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
      const prev = state.liveCoach;
      patch({ liveCoach: next });
      const results = await Promise.all(liveAssignmentIds.map((id) => setLiveSharing(id, next)));
      if (results.some((r) => !r.ok)) {
        patch({ liveCoach: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
    },
    [liveAssignmentIds, state.liveCoach, patch]
  );

  // --- Biométrie (invariant capture ⇒ partage) -----------------------------

  /**
   * Applique la capture cardio (donnée de santé, RGPD).
   *   - Activation (opt-in) : état optimiste, un tap affirmatif suffit ; rollback
   *     si l'écriture échoue.
   *   - Révocation : flux PESSIMISTE — l'UI ne passe OFF qu'APRÈS confirmation
   *     serveur (le Sheet reste bloquant avant l'appel). On ne prétend jamais
   *     avoir coupé une collecte de santé qui reste horodatée en base. La
   *     révocation coupe AUSSI le partage coach : le service le fait en cascade
   *     (un seul update), et l'état cible calculé ici met coachShare=false —
   *     double garde-fou BE-1.
   */
  const applyBiometryCapture = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      const prev = state.biometry;
      const target = nextBiometryConsents(prev, { which: 'capture', value: next });
      if (next) {
        patch({ biometry: target });
        const res = await setBiometryCaptureConsent(userId, true);
        if (!res.ok) {
          patch({ biometry: prev, lastError: WRITE_ERROR });
          return;
        }
        patch({ lastError: null });
        return;
      }
      // Révocation : n'écrit rien à l'écran tant que le serveur n'a pas confirmé.
      const res = await setBiometryCaptureConsent(userId, false);
      if (!res.ok) {
        patch({ lastError: REVOKE_ERROR });
        return;
      }
      patch({ biometry: target, lastError: null });
    },
    [userId, state.biometry, patch]
  );

  const toggleBiometryCoachShare = useCallback(
    async (next: boolean) => {
      if (!userId) return;
      const prev = state.biometry;
      patch({ biometry: nextBiometryConsents(prev, { which: 'coachShare', value: next }) });
      const res = await setBiometryCoachShareConsent(userId, next);
      if (!res.ok) {
        patch({ biometry: prev, lastError: WRITE_ERROR });
        return;
      }
      patch({ lastError: null });
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
