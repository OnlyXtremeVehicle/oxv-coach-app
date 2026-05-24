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

import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { Buffer } from 'buffer';
import { parseRaceBoxDataMessage, UbxFrameBuffer, isRaceBoxDataMessage } from '@/ubx/parser';
import { RaceBoxData, RaceBoxDevice, BleStatus, RACEBOX_PROTOCOL } from '@/types/telemetry';

type StatusListener = (status: BleStatus) => void;
type DeviceListener = (device: RaceBoxDevice) => void;
type DataListener = (data: RaceBoxData) => void;
type ErrorListener = (error: string) => void;
type RawDataListener = (bytes: Uint8Array) => void;

export class RaceBoxBluetoothService {
  private manager: BleManager;
  private currentDevice: Device | null = null;
  /** Dernier device connecté — conservé après déconnexion pour permettre la reconnexion auto. */
  private lastConnectedDeviceId: string | null = null;
  private notificationSubscription: Subscription | null = null;
  private frameBuffer: UbxFrameBuffer;
  private status: BleStatus = 'idle';

  // Listeners
  private statusListeners: StatusListener[] = [];
  private deviceListeners: DeviceListener[] = [];
  private dataListeners: DataListener[] = [];
  private errorListeners: ErrorListener[] = [];
  private rawDataListeners: RawDataListener[] = [];

  // Compteur de trames pour debug
  private frameCount = 0;
  private lastFrameCountReset = Date.now();
  private currentRateHz = 0;

  constructor() {
    this.manager = new BleManager();
    this.frameBuffer = new UbxFrameBuffer();
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
    this.errorListeners.forEach((l) => l(error));
  }

  // ============================================================
  // SCAN
  // ============================================================

  public async startScan(): Promise<void> {
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
    this.manager.stopDeviceScan();
    if (this.status === 'scanning') {
      this.emitStatus('idle');
    }
  }

  // ============================================================
  // CONNEXION
  // ============================================================

  public async connect(deviceId: string): Promise<void> {
    try {
      this.stopScan();
      this.emitStatus('connecting');

      const device = await this.manager.connectToDevice(deviceId, {
        timeout: 10000,
      });
      await device.discoverAllServicesAndCharacteristics();
      this.currentDevice = device;

      device.onDisconnected(() => {
        if (this.status === 'connected') {
          this.handleDisconnection();
        }
      });

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

      this.lastConnectedDeviceId = deviceId;
      this.emitStatus('connected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emitError(`Connexion échouée : ${message}`);
      this.emitStatus('error');
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
    try {
      if (this.notificationSubscription) {
        this.notificationSubscription.remove();
        this.notificationSubscription = null;
      }
      if (this.currentDevice) {
        await this.currentDevice.cancelConnection();
        this.currentDevice = null;
      }
      this.frameBuffer.clear();
      this.emitStatus('disconnected');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      this.emitError(`Déconnexion échouée : ${message}`);
    }
  }

  private handleDisconnection(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.remove();
      this.notificationSubscription = null;
    }
    this.currentDevice = null;
    this.frameBuffer.clear();
    this.emitStatus('disconnected');
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
    this.manager.destroy();
  }
}

/**
 * Singleton du service BLE
 */
export const bluetoothService = new RaceBoxBluetoothService();
