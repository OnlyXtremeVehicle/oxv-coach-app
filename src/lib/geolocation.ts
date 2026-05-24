/**
 * Service de géolocalisation OXV Coach.
 *
 * Foreground only en V1 — le background location iOS demande la permission
 * `Always` + `UIBackgroundModes: location` qui sont des décisions de
 * privacy lourdes. La détection auto S5 (en route) et S7 (arrivée) ne
 * marche donc que quand l'app est ouverte. L'utilisateur peut toujours
 * ouvrir manuellement le flow paddock depuis le hub si l'auto-trigger
 * ne s'est pas déclenché.
 *
 * V1.1 : ajouter background location avec accord explicite du pilote
 * lors de l'onboarding (case opt-in #04 ou #05).
 */

import * as Location from 'expo-location';

import { haversineDistance } from '@/utils/geo';
import { useAppStateStore } from '@/store/useAppStateStore';

let watchSub: Location.LocationSubscription | null = null;
let currentCircuit: { lat: number; lon: number } | null = null;
let lastPushAt = 0;
const PUSH_THROTTLE_MS = 5_000;

export interface LocationPermissionResult {
  granted: boolean;
  status: Location.PermissionStatus;
}

export async function requestLocationPermissions(): Promise<LocationPermissionResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  const granted = status === Location.PermissionStatus.GRANTED;
  useAppStateStore.getState().setCondition('geolocation', granted ? 'granted' : 'denied');
  return { granted, status };
}

export function setReferenceCircuit(opts: { lat: number; lon: number }): void {
  currentCircuit = { lat: opts.lat, lon: opts.lon };
}

/**
 * Démarre le suivi de position en foreground.
 * À chaque update : calcule la distance au circuit et alimente le store.
 * Throttle 5 s pour éviter de spammer recompute() de la state machine.
 */
export async function startGeolocationTracking(): Promise<void> {
  if (watchSub) return;
  if (!currentCircuit) {
    console.warn('[OXV Geo] setReferenceCircuit() doit être appelé avant start');
    return;
  }

  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== Location.PermissionStatus.GRANTED) {
    useAppStateStore.getState().setCondition('geolocation', 'denied');
    return;
  }

  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5_000,
      distanceInterval: 50,
    },
    (loc) => {
      const now = Date.now();
      if (now - lastPushAt < PUSH_THROTTLE_MS) return;
      lastPushAt = now;
      pushLocation(loc);
    }
  );
}

export function stopGeolocationTracking(): void {
  if (watchSub) {
    watchSub.remove();
    watchSub = null;
  }
}

function pushLocation(loc: Location.LocationObject): void {
  if (!currentCircuit) return;
  const { latitude, longitude, speed, heading } = loc.coords;
  const distanceMeters = haversineDistance(
    latitude,
    longitude,
    currentCircuit.lat,
    currentCircuit.lon
  );
  const distanceKm = distanceMeters / 1000;
  const moving = (speed ?? 0) > 1.5; // > 5 km/h
  const headingToCircuit = isHeadingTowardsCircuit(
    { lat: latitude, lon: longitude },
    currentCircuit,
    heading
  );

  useAppStateStore.getState().setPosition({
    lat: latitude,
    lon: longitude,
    distanceToCircuitKm: distanceKm,
    moving,
    headingToCircuit,
    measuredAt: new Date(loc.timestamp),
  });
}

/**
 * Estime si le pilote roule vers le circuit en comparant son heading
 * mesuré au bearing théorique vers le circuit. Tolérance ±45°.
 */
function isHeadingTowardsCircuit(
  from: { lat: number; lon: number },
  circuit: { lat: number; lon: number },
  measuredHeading: number | null | undefined
): boolean {
  if (measuredHeading === null || measuredHeading === undefined || measuredHeading < 0) {
    return false;
  }
  const bearing = computeBearing(from, circuit);
  const diff = Math.abs(((measuredHeading - bearing + 540) % 360) - 180);
  return diff <= 45;
}

function computeBearing(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
