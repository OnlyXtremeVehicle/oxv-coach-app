/**
 * Permissions BLE iOS + Android.
 *
 * Android 12+ (API 31+) : BLUETOOTH_SCAN + BLUETOOTH_CONNECT runtime.
 * Android < 12 : ACCESS_FINE_LOCATION runtime (BLE scan = location).
 * iOS 13.1+ : NSBluetoothAlwaysUsageDescription dans Info.plist
 * (déjà déclaré dans app.json), prompt automatique au premier scan.
 *
 * Toujours appelée avant le premier startScan(), de manière idempotente
 * (request retourne `granted` immédiat si déjà accordé).
 */

import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, request, requestMultiple } from 'react-native-permissions';

export interface BlePermissionResult {
  granted: boolean;
  missing: string[];
}

export async function requestBlePermissions(): Promise<BlePermissionResult> {
  if (Platform.OS === 'ios') {
    const r = await request(PERMISSIONS.IOS.BLUETOOTH);
    return {
      granted: r === RESULTS.GRANTED || r === RESULTS.LIMITED,
      missing: r === RESULTS.GRANTED || r === RESULTS.LIMITED ? [] : ['Bluetooth'],
    };
  }

  if (Platform.OS === 'android') {
    const apiLevel = Number(Platform.Version);
    if (apiLevel >= 31) {
      const results = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      ]);
      const missing: string[] = [];
      if (results[PERMISSIONS.ANDROID.BLUETOOTH_SCAN] !== RESULTS.GRANTED) {
        missing.push('BLUETOOTH_SCAN');
      }
      if (results[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] !== RESULTS.GRANTED) {
        missing.push('BLUETOOTH_CONNECT');
      }
      return { granted: missing.length === 0, missing };
    }
    const r = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    return {
      granted: r === RESULTS.GRANTED,
      missing: r === RESULTS.GRANTED ? [] : ['ACCESS_FINE_LOCATION'],
    };
  }

  return { granted: false, missing: ['platform'] };
}
