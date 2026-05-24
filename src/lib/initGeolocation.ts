/**
 * Wire géolocalisation ↔ store, démarré après authentification.
 *
 * Au démarrage de l'app (ou après login) :
 *   1. Charge le circuit officiel via circuitsService
 *   2. Définit la référence dans le service géoloc
 *   3. Demande la permission foreground (silencieux si déjà accordée)
 *   4. Démarre le watchPosition si permission OK
 *
 * Pas de pull blocking — si la permission est refusée, on bascule en
 * condition 'denied' et l'utilisateur peut toujours déclencher le flow
 * paddock manuellement depuis le hub.
 */

import { getDefaultCircuit } from '@/services/circuitsService';

import {
  requestLocationPermissions,
  setReferenceCircuit,
  startGeolocationTracking,
  stopGeolocationTracking,
} from './geolocation';

let started = false;

export async function initGeolocation(): Promise<void> {
  if (started) return;
  started = true;

  const circuit = await getDefaultCircuit();
  if (!circuit) {
    console.warn('[OXV Geo] Aucun circuit officiel trouvé, géoloc non démarrée');
    return;
  }
  setReferenceCircuit({ lat: circuit.finishLineLat, lon: circuit.finishLineLon });

  const perm = await requestLocationPermissions();
  if (!perm.granted) return;

  await startGeolocationTracking();
}

export function teardownGeolocation(): void {
  stopGeolocationTracking();
  started = false;
}
