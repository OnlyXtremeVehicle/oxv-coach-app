/**
 * Parser du protocole UBX RaceBox Mini S
 *
 * Porté du PoC oxv-telemetry (validé en condition réelle, mai 2026)
 * Implémentation propriétaire OXV, écrite from scratch.
 *
 * Réf : RACEBOX_PROTOCOLE_SPEC.md
 */

import { RACEBOX_PROTOCOL, RaceBoxData, GpsFix } from '@/types/telemetry';

/**
 * Calcule le checksum Fletcher-8 d'une trame UBX
 */
export function computeChecksum(bytes: Uint8Array): { ckA: number; ckB: number } {
  let ckA = 0;
  let ckB = 0;
  // On démarre après les 2 octets de header (0xB5 0x62)
  // On s'arrête avant les 2 octets de checksum
  for (let i = 2; i < bytes.length - 2; i++) {
    ckA = (ckA + bytes[i]) & 0xff;
    ckB = (ckB + ckA) & 0xff;
  }
  return { ckA, ckB };
}

export function isChecksumValid(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const { ckA, ckB } = computeChecksum(bytes);
  const receivedCkA = bytes[bytes.length - 2];
  const receivedCkB = bytes[bytes.length - 1];
  return ckA === receivedCkA && ckB === receivedCkB;
}

export function isRaceBoxDataMessage(bytes: Uint8Array): boolean {
  if (bytes.length !== RACEBOX_PROTOCOL.RACEBOX_DATA_TOTAL_SIZE) return false;

  if (bytes[0] !== RACEBOX_PROTOCOL.UBX_SYNC_1 || bytes[1] !== RACEBOX_PROTOCOL.UBX_SYNC_2) {
    return false;
  }

  if (
    bytes[2] !== RACEBOX_PROTOCOL.RACEBOX_CLASS ||
    bytes[3] !== RACEBOX_PROTOCOL.RACEBOX_DATA_ID
  ) {
    return false;
  }

  return isChecksumValid(bytes);
}

/**
 * Parse une trame RaceBox Data Message en objet RaceBoxData
 */
export function parseRaceBoxDataMessage(bytes: Uint8Array): RaceBoxData | null {
  if (!isRaceBoxDataMessage(bytes)) return null;

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const LE = true; // little-endian

  const fixStatusFlags = dv.getUint8(27);
  const batteryStatus = dv.getUint8(73);

  return {
    timestamp: {
      iTOW: dv.getUint32(6, LE),
      year: dv.getUint16(10, LE),
      month: dv.getUint8(12),
      day: dv.getUint8(13),
      hour: dv.getUint8(14),
      minute: dv.getUint8(15),
      second: dv.getUint8(16),
      nanoseconds: dv.getUint32(22, LE),
    },
    gps: {
      fix: dv.getUint8(26) as GpsFix,
      satellites: dv.getUint8(29),
      latitude: dv.getInt32(34, LE) / 1e7,
      longitude: dv.getInt32(30, LE) / 1e7,
      altitude: dv.getInt32(42, LE) / 1000,
      accuracy: dv.getUint32(46, LE) / 1000,
    },
    motion: {
      speed: (dv.getUint32(54, LE) * 3.6) / 1000,
      heading: dv.getUint32(58, LE) / 1e5,
      headingValid: (fixStatusFlags & 0x20) !== 0,
    },
    imu: {
      gForceX: dv.getInt16(74, LE) / 1000,
      gForceY: dv.getInt16(76, LE) / 1000,
      gForceZ: dv.getInt16(78, LE) / 1000,
      rotRateX: dv.getInt16(80, LE) / 100,
      rotRateY: dv.getInt16(82, LE) / 100,
      rotRateZ: dv.getInt16(84, LE) / 100,
    },
    battery: {
      isCharging: (batteryStatus & 0x80) !== 0,
      level: batteryStatus & 0x7f,
    },
  };
}

/**
 * Buffer accumulateur pour reconstruire les trames depuis le flux BLE
 */
export class UbxFrameBuffer {
  private buffer: number[] = [];

  public push(newBytes: Uint8Array): Uint8Array[] {
    // Ajout au buffer
    for (let i = 0; i < newBytes.length; i++) {
      this.buffer.push(newBytes[i]);
    }

    const frames: Uint8Array[] = [];

    while (this.buffer.length >= 8) {
      // Resynchronisation : on cherche le header UBX
      if (
        this.buffer[0] !== RACEBOX_PROTOCOL.UBX_SYNC_1 ||
        this.buffer[1] !== RACEBOX_PROTOCOL.UBX_SYNC_2
      ) {
        this.buffer.shift();
        continue;
      }

      const payloadLength = this.buffer[4] | (this.buffer[5] << 8);
      const totalSize = 6 + payloadLength + 2;

      if (totalSize > 512) {
        this.buffer.shift();
        continue;
      }

      if (this.buffer.length < totalSize) break;

      const frameBytes = new Uint8Array(this.buffer.slice(0, totalSize));
      frames.push(frameBytes);

      this.buffer = this.buffer.slice(totalSize);
    }

    return frames;
  }

  public clear(): void {
    this.buffer = [];
  }

  public get size(): number {
    return this.buffer.length;
  }
}
