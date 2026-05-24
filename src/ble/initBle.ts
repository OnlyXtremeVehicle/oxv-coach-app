/**
 * Initialisation du pipeline BLE — wire-up bluetoothService ↔ stores +
 * watchdog de reconnexion automatique.
 *
 * Appelé une fois au démarrage de l'app (depuis app/_layout.tsx).
 *
 * Architecture :
 *   bluetoothService (V1 récupéré)
 *     ↓ onStatusChange  → useTelemetryStore + useAppStateStore + useUIStore
 *     ↓ onData          → useTelemetryStore.pushFrame
 *     ↓ onError         → log + (à terme) Sentry
 *     ↓ onDeviceFound   → utilisé par les écrans de scan, pas par init
 *
 * Reconnexion : sur 'disconnected', tente jusqu'à 4 reconnects avec
 * backoff exponentiel (2, 5, 10, 20s). Au-delà de ERROR_THRESHOLD_MS
 * (30s), bascule en condition 'lost' et affiche la modal #25.
 */

import { bluetoothService } from './bluetoothService';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useTelemetryStore } from '@/store/useTelemetryStore';
import { useUIStore } from '@/store/useUIStore';

const RECONNECT_BACKOFF_MS = [2_000, 5_000, 10_000, 20_000];
const ERROR_THRESHOLD_MS = 30_000;

let started = false;
let disposers: (() => void)[] = [];
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let disconnectedSince: number | null = null;

export function initBle(): void {
  if (started) return;
  started = true;

  const offStatus = bluetoothService.onStatusChange((status) => {
    useTelemetryStore.getState().setBleStatus(status);

    if (status === 'connected') {
      onConnectedReset();
    } else if (status === 'disconnected') {
      onDisconnected();
    } else if (status === 'scanning') {
      useAppStateStore.getState().setCondition('bluetooth', 'unused');
    }
  });

  const offData = bluetoothService.onData((frame) => {
    useTelemetryStore.getState().pushFrame(frame);
  });

  const offError = bluetoothService.onError((err) => {
    console.warn('[OXV BLE]', err);
  });

  // Rafraîchit le taux Hz dans le store toutes les secondes pendant le streaming.
  const rateTicker = setInterval(() => {
    if (bluetoothService.getStatus() === 'connected') {
      useTelemetryStore.getState().setRateHz(bluetoothService.getCurrentRate());
    }
  }, 1_000);

  disposers = [offStatus, offData, offError, () => clearInterval(rateTicker)];
}

export function teardownBle(): void {
  for (const dispose of disposers) dispose();
  disposers = [];
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  disconnectedSince = null;
  started = false;
}

function onConnectedReset(): void {
  reconnectAttempt = 0;
  disconnectedSince = null;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  useAppStateStore.getState().setCondition('bluetooth', 'stable');
  useUIStore.getState().setBleErrorModalVisible(false);
}

function onDisconnected(): void {
  const lastDevice = bluetoothService.getLastConnectedDeviceId();
  if (!lastDevice) {
    // Déconnexion volontaire ou pas de device précédent — pas de reconnect.
    useAppStateStore.getState().setCondition('bluetooth', 'unused');
    return;
  }

  if (disconnectedSince === null) disconnectedSince = Date.now();
  useAppStateStore.getState().setCondition('bluetooth', 'reconnecting');

  scheduleReconnect();
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;

  const sinceMs = disconnectedSince ? Date.now() - disconnectedSince : 0;
  if (sinceMs > ERROR_THRESHOLD_MS || reconnectAttempt >= RECONNECT_BACKOFF_MS.length) {
    useAppStateStore.getState().setCondition('bluetooth', 'lost');
    useUIStore.getState().setBleErrorModalVisible(true);
    return;
  }

  const delay = RECONNECT_BACKOFF_MS[reconnectAttempt];
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectAttempt += 1;
    const id = bluetoothService.getLastConnectedDeviceId();
    if (!id) return;
    try {
      await bluetoothService.connect(id);
    } catch {
      scheduleReconnect();
    }
  }, delay);
}

/**
 * Reconnexion manuelle déclenchée par l'utilisateur depuis la modal #25.
 * Reset les compteurs et tente immédiatement.
 */
export async function manualReconnect(): Promise<boolean> {
  const id = bluetoothService.getLastConnectedDeviceId();
  if (!id) return false;

  reconnectAttempt = 0;
  disconnectedSince = Date.now();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  useUIStore.getState().setBleErrorModalVisible(false);
  useAppStateStore.getState().setCondition('bluetooth', 'reconnecting');

  try {
    await bluetoothService.connect(id);
    return true;
  } catch {
    scheduleReconnect();
    return false;
  }
}

/**
 * Abandon explicite : oublie le device et coupe la reconnexion.
 * Utilisé par le bouton "Continuer sans équipement" de la modal #25.
 */
export function abandonReconnect(): void {
  bluetoothService.forgetLastDevice();
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempt = 0;
  disconnectedSince = null;
  useUIStore.getState().setBleErrorModalVisible(false);
  useAppStateStore.getState().setCondition('bluetooth', 'unused');
}
