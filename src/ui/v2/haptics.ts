/**
 * Haptics map V2 — sémantique figée (programme V2, lot L0).
 *
 * UN SEUL point d'entrée : `haptic('tap')`. Jamais d'appel expo-haptics
 * dispersé dans les écrans (app2) — le vocabulaire tactile est fermé :
 *
 *   tap      → selection            (tout Pressable, via PressScale)
 *   arm      → impact heavy         (armer la capture)
 *   record   → notificationSuccess  (RecordFlash — record personnel)
 *   doorSnap → impact light         (fin de NeedleSweep, section franchie)
 *   warn     → notificationWarning  (erreurs)
 *
 * Coupe-circuit commun avec la v1 (`src/lib/haptics.ts`) : en piste
 * (S6_roulage), AUCUNE vibration — silence en piste, Principe 3. No-op
 * également sous Expo Go et si l'API n'est pas disponible (best-effort,
 * jamais de crash). Le réglage système reste souverain : expo-haptics
 * respecte nativement la désactivation des vibrations par l'utilisateur.
 */

import * as Haptics from 'expo-haptics';

import { isExpoGo } from '@/lib/runtime';
import { isSilenced } from '@/lib/silence';

export type HapticKind = 'tap' | 'arm' | 'record' | 'doorSnap' | 'warn';

function muted(): boolean {
  return isSilenced() || isExpoGo();
}

export function haptic(kind: HapticKind): void {
  if (muted()) return;
  switch (kind) {
    case 'tap':
      Haptics.selectionAsync().catch(() => undefined);
      break;
    case 'arm':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
      break;
    case 'record':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      break;
    case 'doorSnap':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      break;
    case 'warn':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      break;
  }
}
