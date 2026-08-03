/**
 * Permissions BLE iOS + Android.
 *
 * Android 12+ (API 31+) : BLUETOOTH_SCAN + BLUETOOTH_CONNECT runtime.
 * Android < 12 : ACCESS_FINE_LOCATION runtime (BLE scan = location).
 * iOS 13.1+ : NSBluetoothAlwaysUsageDescription dans Info.plist,
 * prompt automatique de CoreBluetooth au premier scan.
 *
 * Toujours appelée avant le premier startScan(), de manière idempotente
 * (request retourne `granted` immédiat si déjà accordé).
 *
 * ---------------------------------------------------------------------------
 * iOS — LE GREFFON DOIT RESTER DÉCLARÉ DANS app.json
 * ---------------------------------------------------------------------------
 *
 * `react-native-permissions` ne compile ses poignées iOS que si le Podfile
 * contient `setup_permissions([...])`, et seul son greffon de configuration
 * écrit cette ligne. Sans lui, `request(PERMISSIONS.IOS.BLUETOOTH)` rend
 * `unavailable` sans jamais afficher de dialogue — c'est ce qui a rendu
 * l'appairage RaceBox impossible sur iOS jusqu'au 03/08/2026.
 *
 * La déclaration est donc nécessaire, et `src/__tests__/declarationsPermissions.test.ts`
 * la surveille. La décision de traduction vit dans `permissionsLogic.ts`, qui
 * laisse désormais passer `unavailable` plutôt que d'inventer un refus : voir
 * son en-tête pour le raisonnement, et docs/DETTE.md D-36.
 */

import { Platform } from 'react-native';
import { PERMISSIONS, request, requestMultiple } from 'react-native-permissions';

import { verdictAndroid, verdictBluetoothIos } from './permissionsLogic';

export interface BlePermissionResult {
  granted: boolean;
  missing: string[];
  /** Vrai quand l'état n'a pas pu être établi et qu'on laisse l'OS trancher. */
  indetermine?: boolean;
}

export async function requestBlePermissions(): Promise<BlePermissionResult> {
  if (Platform.OS === 'ios') {
    return verdictBluetoothIos(await request(PERMISSIONS.IOS.BLUETOOTH));
  }

  if (Platform.OS === 'android') {
    const apiLevel = Number(Platform.Version);
    if (apiLevel >= 31) {
      const results = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
      ]);
      return verdictAndroid({
        BLUETOOTH_SCAN: results[PERMISSIONS.ANDROID.BLUETOOTH_SCAN],
        BLUETOOTH_CONNECT: results[PERMISSIONS.ANDROID.BLUETOOTH_CONNECT],
      });
    }
    return verdictAndroid({
      ACCESS_FINE_LOCATION: await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION),
    });
  }

  return { granted: false, missing: ['platform'], indetermine: false };
}
