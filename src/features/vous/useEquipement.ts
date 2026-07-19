/**
 * useEquipement — chargement de l'écran Équipement (V2-L4, porte VOUS, 5/8).
 *
 * Services EXISTANTS uniquement :
 *   - deviceHealthService (getMyAssignedDevice, getDeviceHealthHistory) : le
 *     boîtier affecté au pilote + son dernier relevé (RLS own-row) ;
 *   - featureFlagsService (isFlagEnabled 'biometry') : garde Apple Watch ;
 *   - consentService (loadBiometryConsents) : consentement de capture cardio ;
 *   - healthKitService (requestAuthorization) : demande d'autorisation HealthKit,
 *     iOS-only, no-op tant que le module natif est absent.
 *
 * La batterie et l'état viennent du snapshot courant du boîtier (devices), avec
 * repli sur le dernier relevé (device_health_logs) pour la valeur et l'horodatage
 * du « dernier contact ». Absence → « — » / pastille inconnue (jamais fabriqué).
 *
 * Garde Watch fail-closed : la demande d'autorisation n'a lieu que si iOS +
 * drapeau `biometry` + consentement de capture (canRequestHealthAuth) ; sinon
 * l'écran renvoie vers les Réglages consentements. Android : carte Watch absente.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { loadBiometryConsents } from '@/services/consentService';
import {
  type MyDevice,
  getDeviceHealthHistory,
  getMyAssignedDevice,
} from '@/services/deviceHealthService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import { requestAuthorization } from '@/services/v2/healthKitService';

import { canRequestHealthAuth, parseBatteryPercent, type WatchAuthStatus } from './equipementLogic';

export interface EquipementState {
  status: 'loading' | 'ready' | 'error';
  device: MyDevice | null;
  /** Niveau batterie 0..100, ou null (cadran « — »). */
  batteryPercent: number | null;
  /** État de santé textuel du boîtier (pour la pastille), ou null. */
  healthStatus: string | null;
  /** Horodatage du dernier relevé/contact du boîtier (ISO), ou null. */
  lastContactAt: string | null;
  /** Drapeau `biometry` (fail-closed : défaut false). */
  biometryFlagOn: boolean;
  /** Consentement de capture cardio (loadBiometryConsents.capture). */
  captureConsent: boolean;
  /** Statut d'autorisation HealthKit côté écran. */
  watchStatus: WatchAuthStatus;
}

export interface Equipement extends EquipementState {
  /** iOS ? (la carte Watch n'existe que sur iOS). */
  isIOS: boolean;
  /** Les 3 conditions de la garde Watch sont-elles réunies ? */
  canAuthorizeWatch: boolean;
  /**
   * Demande l'autorisation HealthKit SI la garde le permet, et met à jour le
   * statut. Renvoie false si la garde a bloqué (l'écran renvoie alors vers les
   * Réglages consentements) — jamais d'accès cardio sans consentement.
   */
  requestWatchAuthorization: () => Promise<boolean>;
  reload: () => void;
}

const IS_IOS = Platform.OS === 'ios';

const INITIAL: EquipementState = {
  status: 'loading',
  device: null,
  batteryPercent: null,
  healthStatus: null,
  lastContactAt: null,
  biometryFlagOn: false,
  captureConsent: false,
  watchStatus: 'idle',
};

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export function useEquipement(userId: string | null): Equipement {
  const [state, setState] = useState<EquipementState>(INITIAL);
  const alive = useRef(true);

  const load = useCallback(async () => {
    const [deviceR, flagR, consentR] = await Promise.allSettled([
      getMyAssignedDevice(),
      isFlagEnabled('biometry'),
      userId
        ? loadBiometryConsents(userId)
        : Promise.resolve({ capture: false, coachShare: false }),
    ]);

    const device = settled(deviceR, null);
    const biometryFlagOn = settled(flagR, false); // fail-closed
    const captureConsent = settled(consentR, { capture: false, coachShare: false }).capture;

    // Dernier relevé du boîtier : valeur batterie de repli + horodatage « dernier
    // contact » (le boîtier journalise son état au connect BLE, source 'app').
    let historyBattery: string | null = null;
    let healthStatus: string | null = null;
    let lastContactAt: string | null = null;
    if (device !== null) {
      const history = await getDeviceHealthHistory(device.deviceId, 1).catch(() => []);
      const latest = history[0] ?? null;
      historyBattery = latest?.batteryStatus ?? null;
      healthStatus = device.healthStatus ?? latest?.healthStatus ?? null;
      lastContactAt = latest?.recordedAt ?? device.assignedAt ?? null;
    }

    const batteryPercent = parseBatteryPercent(device?.batteryStatus ?? historyBattery);

    if (!alive.current) return;
    setState((prev) => ({
      status: 'ready',
      device,
      batteryPercent,
      healthStatus,
      lastContactAt,
      biometryFlagOn,
      captureConsent,
      // Un statut Watch déjà obtenu dans la session est conservé au rechargement.
      watchStatus: prev.watchStatus,
    }));
  }, [userId]);

  useEffect(() => {
    alive.current = true;
    setState((s) => ({ ...s, status: 'loading' }));
    load().catch(() => {
      if (alive.current) setState({ ...INITIAL, status: 'error' });
    });
    return () => {
      alive.current = false;
    };
  }, [load]);

  const reload = useCallback(() => {
    load().catch(() => {
      if (alive.current) setState((s) => ({ ...s, status: 'error' }));
    });
  }, [load]);

  const canAuthorizeWatch = canRequestHealthAuth({
    isIOS: IS_IOS,
    biometryFlagOn: state.biometryFlagOn,
    captureConsent: state.captureConsent,
  });

  const requestWatchAuthorization = useCallback(async (): Promise<boolean> => {
    if (
      !canRequestHealthAuth({
        isIOS: IS_IOS,
        biometryFlagOn: state.biometryFlagOn,
        captureConsent: state.captureConsent,
      })
    ) {
      return false; // garde fermée → l'écran renvoie vers les Réglages
    }
    const result = await requestAuthorization();
    if (alive.current) setState((s) => ({ ...s, watchStatus: result }));
    return true;
  }, [state.biometryFlagOn, state.captureConsent]);

  return {
    ...state,
    isIOS: IS_IOS,
    canAuthorizeWatch,
    requestWatchAuthorization,
    reload,
  };
}
