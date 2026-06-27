/**
 * Service BLE pour communiquer avec le RaceBox Mini S
 *
 * Porté du PoC oxv-telemetry (validé sur le terrain mai 2026)
 * Adapté pour s'intégrer avec Redux Toolkit
 *
 * Émet des événements pour Redux :
 *   - onStatusChange : changement état BLE
 *   - onDeviceFound : nouveau device détecté
 *   - onData : nouvelle trame parsée
 *   - onError : erreur
 */

import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { parseRaceBoxDataMessage, UbxFrameBuffer, isRaceBoxDataMessage } from '@/ubx/parser';
import { RaceBoxData, RaceBoxDevice, BleStatus, RACEBOX_PROTOCOL } from '@/types/telemetry';

/**
 * Charge `react-native-ble-plx` à la demande pour éviter le crash au
 * boot dans Expo Go (où le module natif n'existe pas). Retourne `null`
 * si l'import échoue — le service tombe alors en mode no-op.
 */
function loadBleManagerCtor(): (new () => BleManager) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-ble-plx').BleManager;
  } catch (e) {
    console.warn('[OXV] react-native-ble-plx indisponible (Expo Go ?) — BLE désactivé.', e);
    return null;
  }
}

type StatusListener = (status: BleStatus) => void;
type DeviceListener = (device: RaceBoxDevice) => void;
type DataListener = (data: RaceBoxData) => void;
type ErrorListener = (error: string) => void;
type RawDataListener = (bytes: Uint8Array) => void;

/**
 * Phase de reconnexion automatique, distincte du `BleStatus` brut.
 *
 * Le `BleStatus` flappe (connecting/disconnected) pendant les tentatives ;
 * cette phase donne au consommateur (UI capture, watchdog initBle) une lecture
 * stable de « est-on en train de récupérer le lien, et où en est-on ».
 *
 *   - `idle`         : pas de reconnexion en cours (état nominal).
 *   - `reconnecting` : lien tombé de façon inattendue, tentatives en cours.
 *   - `lost`         : tentatives épuisées — liaison perdue (terminal).
 */
export type ReconnectPhase = 'idle' | 'reconnecting' | 'lost';

/** Instantané de la reconnexion auto, pour l'UI et la coordination. */
export interface ReconnectState {
  phase: ReconnectPhase;
  /** Numéro de la tentative en cours (1..maxAttempts), 0 si aucune. */
  attempt: number;
  /** Nombre total de tentatives avant bascule en `lost`. */
  maxAttempts: number;
}

type ReconnectListener = (state: ReconnectState) => void;

/**
 * Paramètres de la reconnexion auto rapide pilotée par le service (au plus
 * près de la couche BLE, déclenchée par `device.onDisconnected`).
 *
 * Volontairement courts et bornés : sur site, on veut récupérer un micro-
 * décrochage en quelques secondes sans figer la capture. Le watchdog applicatif
 * `initBle` garde, lui, son backoff long + la modal paddock #25 comme filet.
 */
const RECONNECT_MAX_ATTEMPTS = 5;
const RECONNECT_BACKOFF_MS = 2_000;

export class RaceBoxBluetoothService {
  private manager: BleManager | null;
  private currentDevice: Device | null = null;
  /** Dernier device connecté — conservé après déconnexion pour permettre la reconnexion auto. */
  private lastConnectedDeviceId: string | null = null;
  private notificationSubscription: Subscription | null = null;
  /** Abonnement à l'événement de déconnexion inattendue du device courant. */
  private disconnectSubscription: Subscription | null = null;
  private frameBuffer: UbxFrameBuffer;
  private status: BleStatus = 'idle';

  // Reconnexion auto (service-level, déclenchée par device.onDisconnected)
  private reconnectPhase: ReconnectPhase = 'idle';
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Vrai pendant un `disconnect()` ou `destroy()` demandé par l'utilisateur :
   * sert à NE PAS déclencher la reconnexion auto sur une coupure volontaire.
   * Une déconnexion sans ce drapeau levé est considérée « inattendue ».
   */
  private userInitiatedDisconnect = false;

  // Listeners
  private statusListeners: StatusListener[] = [];
  private deviceListeners: DeviceListener[] = [];
  private dataListeners: DataListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private rawDataListeners: RawDataListener[] = [];
  private reconnectListeners: ReconnectListener[] = [];

  /** Dernier message d'erreur émis, pour pouvoir le « nettoyer » à la reco. */
  private lastError: string | null = null;

  // Compteur de trames pour debug
  private frameCount = 0;
  private lastFrameCountReset = Date.now();
  private currentRateHz = 0;

  constructor() {
    const Ctor = loadBleManagerCtor();
    this.manager = Ctor ? new Ctor() : null;
    this.frameBuffer = new UbxFrameBuffer();
  }

  /** `true` si le module BLE natif est chargé (faux en Expo Go). */
  public isAvailable(): boolean {
    return this.manager !== null;
  }

  // ============================================================
  // ABONNEMENTS
  // ============================================================

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  public onDeviceFound(listener: DeviceListener): () => void {
    this.deviceListeners.push(listener);
    return () => {
      this.deviceListeners = this.deviceListeners.filter((l) => l !== listener);
    };
  }

  public onData(listener: DataListener): () => void {
    this.dataListeners.push(listener);
    return () => {
      this.dataListeners = this.dataListeners.filter((l) => l !== listener);
    };
  }

  public onError(listener: ErrorListener): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notifie les changements de phase de reconnexion auto (reconnecting/lost).
   * Émet l'état courant à l'abonnement pour que l'UI parte du bon pied.
   */
  public onReconnectChange(listener: ReconnectListener): () => void {
    this.reconnectListeners.push(listener);
    listener(this.getReconnectState());
    return () => {
      this.reconnectListeners = this.reconnectListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Émet les bytes BLE bruts dès qu'ils arrivent, avant resync et parsing.
   * Utile pour capturer des fixtures (.ubx) reproductibles pour les tests.
   */
  public onRawData(listener: RawDataListener): () => void {
    this.rawDataListeners.push(listener);
    return () => {
      this.rawDataListeners = this.rawDataListeners.filter((l) => l !== listener);
    };
  }

  // ============================================================
  // ÉMISSION D'ÉVÉNEMENTS
  // ============================================================

  private emitStatus(status: BleStatus): void {
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }

  private emitDevice(device: RaceBoxDevice): void {
    this.deviceListeners.forEach((l) => l(device));
  }

  private emitData(data: RaceBoxData): void {
    this.dataListeners.forEach((l) => l(data));
  }

  private emitError(error: string): void {
    this.lastError = error;
    this.errorListeners.forEach((l) => l(error));
  }

  /**
   * Efface une erreur précédemment émise (ex. après une reconnexion réussie).
   * No-op s'il n'y avait aucune erreur affichée. La convention « chaîne vide =
   * pas d'erreur » est déjà celle des écrans (`bleError ? … : null`).
   */
  private clearError(): void {
    if (this.lastError === null) return;
    this.lastError = null;
    this.errorListeners.forEach((l) => l(''));
  }

  private emitReconnect(): void {
    const snapshot = this.getReconnectState();
    this.reconnectListeners.forEach((l) => l(snapshot));
  }

  private setReconnectPhase(phase: ReconnectPhase, attempt: number): void {
    this.reconnectPhase = phase;
    this.reconnectAttempt = attempt;
    this.emitReconnect();
  }

  // ============================================================
  // SCAN
  // ============================================================

  public async startScan(): Promise<void> {
    if (!this.manager) {
      this.emitError('Bluetooth indisponible dans ce runtime (Expo Go).');
      return;
    }
    const state = await this.manager.state();
    if (state !== 'PoweredOn') {
      this.emitError(`Bluetooth non disponible (état : ${state})`);
      return;
    }

    this.emitStatus('scanning');

    this.manager.startDeviceScan(
      [RACEBOX_PROTOCOL.UART_SERVICE_UUID],
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          this.emitError(`Erreur scan : ${error.message}`);
          this.emitStatus('error');
          return;
        }
        if (!device) return;

        const name = device.name || device.localName || '';
        if (!name.startsWith(RACEBOX_PROTOCOL.DEVICE_NAME_PREFIX)) return;

        this.emitDevice({
          id: device.id,
          name,
          rssi: device.rssi,
        });
      }
    );
  }

  public stopScan(): void {
    if (!this.manager) return;
    this.manager.stopDeviceScan();
    if (this.status === 'scanning') {
      this.emitStatus('idle');
    }
  }

  // ============================================================
  // CONNEXION
  // ============================================================

  public async connect(deviceId: string): Promise<void> {
    if (!this.manager) {
      this.emitError('Bluetooth indisponible dans ce runtime (Expo Go).');
      return;
    }
    try {
      this.stopScan();
      this.emitStatus('connecting');

      const device = await this.manager.connectToDevice(deviceId, {
        timeout: 10000,
      });
      await device.discoverAllServicesAndCharacteristics();

      this.attachDevice(device);
      this.subscribeToData(device);

      this.lastConnectedDeviceId = deviceId;
      // Connexion nominale réussie : on sort de toute phase de reconnexion et
      // on efface une erreur éventuellement affichée.
      this.setReconnectPhase('idle', 0);
      this.clearError();
      this.emitStatus('connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emitError(`Connexion échouée : ${message}`);
      this.emitStatus('error');
    }
  }

  /**
   * Mémorise le Device courant et s'abonne à sa déconnexion. Sépare la
   * détection de coupure (inattendue vs volontaire) de l'abonnement aux données,
   * pour que la reconnexion auto puisse réutiliser `subscribeToData`.
   */
  private attachDevice(device: Device): void {
    this.currentDevice = device;
    this.disconnectSubscription?.remove();
    this.disconnectSubscription = device.onDisconnected(() => {
      this.handleDeviceDisconnected();
    });
  }

  /**
   * (Ré)abonne le flux de notifications sur la caractéristique TX du RaceBox.
   * Le pipeline de parsing UBX est inchangé — extrait tel quel de `connect`
   * pour être rejoué à l'identique après une reconnexion.
   */
  private subscribeToData(device: Device): void {
    this.notificationSubscription?.remove();
    this.frameBuffer.clear();
    this.frameCount = 0;
    this.lastFrameCountReset = Date.now();

    this.notificationSubscription = device.monitorCharacteristicForService(
      RACEBOX_PROTOCOL.UART_SERVICE_UUID,
      RACEBOX_PROTOCOL.TX_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          this.emitError(`Erreur notification : ${error.message}`);
          return;
        }
        if (!characteristic?.value) return;

        const bytes = new Uint8Array(Buffer.from(characteristic.value, 'base64'));

        // Émet les bytes bruts AVANT le resync, pour capture de fixtures.
        if (this.rawDataListeners.length > 0) {
          for (const listener of this.rawDataListeners) listener(bytes);
        }

        const frames = this.frameBuffer.push(bytes);

        for (const frame of frames) {
          if (isRaceBoxDataMessage(frame)) {
            const data = parseRaceBoxDataMessage(frame);
            if (data) {
              this.frameCount++;
              this.updateRate();
              this.emitData(data);
            }
          }
        }
      }
    );
  }

  /**
   * Aiguillage de la déconnexion du Device (callback ble-plx).
   *
   *   - Déconnexion VOLONTAIRE (drapeau `userInitiatedDisconnect`) : ne rien
   *     déclencher, `disconnect()` gère déjà le nettoyage et l'état.
   *   - Déconnexion INATTENDUE pendant qu'on était connecté : on lâche le lien
   *     mort et on lance la reconnexion auto bornée.
   *
   * Tout autre cas (déjà en reconnexion, jamais connecté) est ignoré : la
   * boucle de reconnexion possède ses propres tentatives.
   */
  private handleDeviceDisconnected(): void {
    if (this.userInitiatedDisconnect) return;
    if (this.status === 'connected') {
      this.handleUnexpectedDisconnection();
    }
  }

  /** ID du dernier device connecté, pour reconnexion auto par initBle. */
  public getLastConnectedDeviceId(): string | null {
    return this.lastConnectedDeviceId;
  }

  /** Oublie le dernier device : empêche les futurs auto-reconnect. */
  public forgetLastDevice(): void {
    this.lastConnectedDeviceId = null;
  }

  public async disconnect(): Promise<void> {
    // Marque la coupure comme volontaire pour court-circuiter la reconnexion
    // auto déclenchée par device.onDisconnected, et annule toute repro en cours.
    this.userInitiatedDisconnect = true;
    this.cancelReconnect();
    this.setReconnectPhase('idle', 0);
    try {
      if (this.disconnectSubscription) {
        this.disconnectSubscription.remove();
        this.disconnectSubscription = null;
      }
      if (this.notificationSubscription) {
        this.notificationSubscription.remove();
        this.notificationSubscription = null;
      }
      if (this.currentDevice) {
        await this.currentDevice.cancelConnection();
        this.currentDevice = null;
      }
      this.frameBuffer.clear();
      // Déconnexion volontaire = on oublie le device pour que le
      // watchdog initBle ne tente pas de reconnect automatique.
      this.lastConnectedDeviceId = null;
      this.emitStatus('disconnected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emitError(`Déconnexion échouée : ${message}`);
    } finally {
      this.userInitiatedDisconnect = false;
    }
  }

  // ============================================================
  // RECONNEXION AUTO (déclenchée par une coupure inattendue)
  // ============================================================

  /**
   * Coupure inattendue alors qu'on enregistrait/streamait : on démonte le lien
   * mort (sans toucher `lastConnectedDeviceId`, qui sert de cible de reco) et on
   * entre en phase `reconnecting`. La cible est le dernier device connu.
   */
  private handleUnexpectedDisconnection(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.remove();
      this.notificationSubscription = null;
    }
    this.currentDevice = null;
    this.frameBuffer.clear();

    const targetId = this.lastConnectedDeviceId;
    if (!this.manager || !targetId) {
      // Pas de cible (ou BLE indispo) : rien à reconnecter, on s'arrête là.
      this.emitStatus('disconnected');
      return;
    }
    // IMPORTANT : on passe en phase `reconnecting` AVANT d'émettre 'disconnected',
    // pour que le watchdog initBle (sur 'disconnected') voie `isReconnecting()`
    // déjà vrai et NE programme PAS un second dialing concurrent.
    this.emitError('Liaison interrompue — reconnexion…');
    this.setReconnectPhase('reconnecting', 0);
    this.emitStatus('disconnected');
    this.scheduleReconnect(targetId);
  }

  /** Programme la prochaine tentative de reconnexion (backoff fixe, borné). */
  private scheduleReconnect(deviceId: string): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
      // Tentatives épuisées : liaison perdue (terminal). Le watchdog initBle
      // et sa modal paddock #25 restent le filet pour l'utilisateur.
      this.setReconnectPhase('lost', this.reconnectAttempt);
      this.emitError('Liaison perdue après plusieurs tentatives.');
      this.emitStatus('error');
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.attemptReconnect(deviceId);
    }, RECONNECT_BACKOFF_MS);
  }

  /**
   * Une tentative de reconnexion sur le MÊME device. En cas de succès :
   * réabonnement aux données, nettoyage de l'erreur, retour « connecté ». En
   * cas d'échec : on replanifie jusqu'à épuisement des tentatives.
   */
  private async attemptReconnect(deviceId: string): Promise<void> {
    if (!this.manager) return;
    // Une coupure volontaire a pu survenir entre-temps : on abandonne alors.
    if (this.userInitiatedDisconnect || this.reconnectPhase !== 'reconnecting') return;

    this.reconnectAttempt += 1;
    this.setReconnectPhase('reconnecting', this.reconnectAttempt);
    this.emitStatus('connecting');

    try {
      const device = await this.manager.connectToDevice(deviceId, { timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();

      this.attachDevice(device);
      this.subscribeToData(device);

      this.lastConnectedDeviceId = deviceId;
      this.reconnectAttempt = 0;
      this.setReconnectPhase('idle', 0);
      this.clearError();
      this.emitStatus('connected');
    } catch {
      // Échec : on retente, sauf si une coupure volontaire est intervenue.
      if (this.userInitiatedDisconnect) return;
      this.emitStatus('disconnected');
      this.scheduleReconnect(deviceId);
    }
  }

  /** Annule une reconnexion programmée (timer en attente). */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** `true` tant que la reconnexion auto rapide du service est en cours. */
  public isReconnecting(): boolean {
    return this.reconnectPhase === 'reconnecting';
  }

  /** Instantané de l'état de reconnexion auto, pour l'UI et la coordination. */
  public getReconnectState(): ReconnectState {
    return {
      phase: this.reconnectPhase,
      attempt: this.reconnectAttempt,
      maxAttempts: RECONNECT_MAX_ATTEMPTS,
    };
  }

  // ============================================================
  // DEBUG : taux d'arrivée des trames
  // ============================================================

  private updateRate(): void {
    const now = Date.now();
    const elapsed = now - this.lastFrameCountReset;
    if (elapsed >= 1000) {
      this.currentRateHz = (this.frameCount * 1000) / elapsed;
      this.frameCount = 0;
      this.lastFrameCountReset = now;
    }
  }

  public getCurrentRate(): number {
    return Math.round(this.currentRateHz);
  }

  public getStatus(): BleStatus {
    return this.status;
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  public destroy(): void {
    this.disconnect();
    this.manager?.destroy();
  }
}

/**
 * Singleton du service BLE
 */
export const bluetoothService = new RaceBoxBluetoothService();
