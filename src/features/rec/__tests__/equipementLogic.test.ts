/**
 * Tests — equipementLogic (V2-L2, écran Équipement).
 * Couvre : états de scan, ordre/identité des boîtiers, nom & série, batterie,
 * et la garde du rappel Watch phase A (4 conditions, fail-closed).
 */

import type { RaceBoxDevice } from '@/types/telemetry';
import {
  clampBatteryLevel,
  deviceBadge,
  deviceRank,
  deriveScanPhase,
  displayDeviceName,
  formatBatteryValue,
  isMyDevice,
  orderDevices,
  serialFromDeviceName,
  shouldOfferWatchReminder,
} from '@/features/rec/equipementLogic';

function dev(id: string, name: string, rssi: number | null = -60): RaceBoxDevice {
  return { id, name, rssi };
}

describe('deriveScanPhase', () => {
  it('connected prime sur tout', () => {
    expect(
      deriveScanPhase({ status: 'connected', deviceCount: 3, error: 'x', connecting: true })
    ).toBe('connected');
  });

  it('connecting (statut ou flag) prime sur une erreur périmée', () => {
    expect(
      deriveScanPhase({ status: 'connecting', deviceCount: 1, error: 'stale', connecting: false })
    ).toBe('connecting');
    expect(
      deriveScanPhase({ status: 'scanning', deviceCount: 1, error: null, connecting: true })
    ).toBe('connecting');
  });

  it('erreur (statut ou message)', () => {
    expect(
      deriveScanPhase({ status: 'error', deviceCount: 0, error: null, connecting: false })
    ).toBe('error');
    expect(
      deriveScanPhase({ status: 'idle', deviceCount: 0, error: 'aucun boîtier', connecting: false })
    ).toBe('error');
  });

  it('scan : found si des boîtiers, scanning sinon', () => {
    expect(
      deriveScanPhase({ status: 'scanning', deviceCount: 2, error: null, connecting: false })
    ).toBe('found');
    expect(
      deriveScanPhase({ status: 'scanning', deviceCount: 0, error: null, connecting: false })
    ).toBe('scanning');
  });

  it('hors scan et sans erreur : found si connus, empty sinon', () => {
    expect(
      deriveScanPhase({ status: 'idle', deviceCount: 1, error: null, connecting: false })
    ).toBe('found');
    expect(
      deriveScanPhase({ status: 'idle', deviceCount: 0, error: null, connecting: false })
    ).toBe('empty');
  });
});

describe('identité & ordre des boîtiers', () => {
  const mine = dev('a', 'RaceBox Mini S 1234567890');
  const last = dev('b', 'RaceBox Mini S 5555500000');
  const other = dev('c', 'RaceBox Mini S 9999900000');

  it('reconnaît le boîtier du pilote par son serial dans le nom (insensible casse)', () => {
    expect(isMyDevice(mine, '1234567890')).toBe(true);
    expect(isMyDevice(mine, '0000000000')).toBe(false);
    expect(isMyDevice(mine, null)).toBe(false);
  });

  it('rang : le mien (0) < dernier appairé (1) < autres (2)', () => {
    const input = { mySerial: '1234567890', lastPairedId: 'b' };
    expect(deviceRank(mine, input)).toBe(0);
    expect(deviceRank(last, input)).toBe(1);
    expect(deviceRank(other, input)).toBe(2);
  });

  it('ordonne le mien d’abord, puis le dernier appairé, puis les autres', () => {
    const ordered = orderDevices([other, last, mine], {
      mySerial: '1234567890',
      lastPairedId: 'b',
    });
    expect(ordered.map((d) => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('badge : mon boîtier / dernier utilisé / rien', () => {
    const input = { mySerial: '1234567890', lastPairedId: 'b' };
    expect(deviceBadge(mine, input)).toBe('Votre boîtier');
    expect(deviceBadge(last, input)).toBe('Dernier utilisé');
    expect(deviceBadge(other, input)).toBeNull();
  });
});

describe('nom & série', () => {
  it('neutralise la marque d’usine', () => {
    expect(displayDeviceName('RaceBox Mini S 1234567890')).toBe('OXV Mirror Mini S 1234567890');
    expect(displayDeviceName('Autre appareil')).toBe('Autre appareil');
  });

  it('extrait le serial en fin de nom, null sinon', () => {
    expect(serialFromDeviceName('RaceBox Mini S 1234567890')).toBe('1234567890');
    expect(serialFromDeviceName('RaceBox Mini S ')).toBeNull();
    expect(serialFromDeviceName('OXV boîtier')).toBeNull();
  });
});

describe('batterie', () => {
  it('borne 0..100 et arrondit', () => {
    expect(clampBatteryLevel(87.4)).toBe(87);
    expect(clampBatteryLevel(-5)).toBe(0);
    expect(clampBatteryLevel(140)).toBe(100);
  });

  it('null si absent ou non fini', () => {
    expect(clampBatteryLevel(null)).toBeNull();
    expect(clampBatteryLevel(undefined)).toBeNull();
    expect(clampBatteryLevel(Number.NaN)).toBeNull();
  });

  it('valeur affichée : chiffre ou tiret', () => {
    expect(formatBatteryValue(87)).toBe('87');
    expect(formatBatteryValue(null)).toBe('—');
  });
});

describe('shouldOfferWatchReminder (4 conditions, fail-closed)', () => {
  const on = {
    biometryFlagOn: true,
    captureConsent: true,
    hasPolarBelt: false,
    isIOS: true,
  };

  it('vrai quand les quatre conditions sont réunies', () => {
    expect(shouldOfferWatchReminder(on)).toBe(true);
  });

  it('faux si le drapeau biometry est OFF (cas d’aujourd’hui)', () => {
    expect(shouldOfferWatchReminder({ ...on, biometryFlagOn: false })).toBe(false);
  });

  it('faux sans consentement de capture', () => {
    expect(shouldOfferWatchReminder({ ...on, captureConsent: false })).toBe(false);
  });

  it('faux si le pilote a une ceinture Polar (FC via ceinture)', () => {
    expect(shouldOfferWatchReminder({ ...on, hasPolarBelt: true })).toBe(false);
  });

  it('faux hors iOS', () => {
    expect(shouldOfferWatchReminder({ ...on, isIOS: false })).toBe(false);
  });
});
