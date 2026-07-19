/**
 * Wrapper HealthKit (BE-1, MISSION A) — iOS uniquement, no-op Android.
 *
 * ÉTAT : « prêt pour BIO-1, no-op aujourd'hui ». AUCUN module natif santé n'est
 * installé dans le projet à ce jour (vérifié). Ce fichier pose la surface stable
 * (signatures, gate de consentement, détection de plateforme) que BIO-1 n'aura
 * qu'à câbler : installer le module santé et remplir les deux TODO ci-dessous.
 * Tant que le module est absent, tout retourne 'unavailable' / [].
 *
 * GATE DE CONSENTEMENT — fail-closed : `readHeartRate` n'accède JAMAIS aux
 * données de santé sans consentement de CAPTURE. L'appelant passe le flag
 * `hasConsent` (= `loadBiometryConsents(userId).capture` de consentService).
 * Sans consentement, la lecture retourne [] sans même tenter d'accès natif.
 */

import { Platform } from 'react-native';

/** Résultat d'une demande d'autorisation santé. */
export type HealthAuthStatus = 'granted' | 'denied' | 'unavailable';

/** Échantillon cardiaque lu depuis la plateforme santé. */
export interface HeartRateSample {
  /** Epoch millisecondes. */
  ts: number;
  /** Fréquence cardiaque (bpm). */
  hr: number;
}

/**
 * Nom du futur module natif, en VARIABLE (pas en littéral) : le bundler ne tente
 * pas de résoudre statiquement un paquet encore absent, ce qui éviterait un
 * échec de build. BIO-1 installera le module et `loadHealthModule` le trouvera
 * sans autre changement ici.
 */
const HEALTH_MODULE_NAME = 'react-native-health';

/** Forme minimale attendue du futur module natif (affinée par BIO-1). */
interface HealthModuleLike {
  [key: string]: unknown;
}

function loadHealthModule(): HealthModuleLike | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(HEALTH_MODULE_NAME) as HealthModuleLike;
    return mod ?? null;
  } catch {
    // Module absent (cas actuel) → indisponible, sans bruit.
    return null;
  }
}

/** true seulement sur iOS AVEC le module natif santé présent (faux aujourd'hui). */
export function isHealthAvailable(): boolean {
  return Platform.OS === 'ios' && loadHealthModule() !== null;
}

/**
 * Demande l'autorisation d'accès au cardio.
 * iOS sans module → 'unavailable' ; Android → 'unavailable' (no-op).
 * BIO-1 : appeler l'autorisation réelle du module et mapper vers 'granted'
 * / 'denied'.
 */
export async function requestAuthorization(): Promise<HealthAuthStatus> {
  if (Platform.OS !== 'ios') return 'unavailable';
  const mod = loadHealthModule();
  if (!mod) return 'unavailable';
  // TODO BIO-1 : brancher l'autorisation native via `mod` et renvoyer
  // 'granted' | 'denied'. Fail-safe tant que non branché.
  return 'unavailable';
}

/**
 * Lit les échantillons cardiaques sur [from, to].
 *
 * Fail-closed : sans `hasConsent` (consentement de CAPTURE), retourne [] sans
 * aucun accès natif. Sur Android, ou si le module natif est absent, retourne []
 * également.
 *
 * @param hasConsent Consentement de capture du pilote — `loadBiometryConsents(userId).capture`.
 */
export async function readHeartRate(
  from: Date,
  to: Date,
  hasConsent: boolean
): Promise<HeartRateSample[]> {
  if (!hasConsent) return []; // GATE consentement — priorité absolue.
  if (Platform.OS !== 'ios') return [];
  const mod = loadHealthModule();
  if (!mod) return [];
  // TODO BIO-1 : lire l'HealthKit via `mod`, borné [from, to], projeter vers
  // { ts, hr }. No-op aujourd'hui (module absent).
  void from;
  void to;
  return [];
}
