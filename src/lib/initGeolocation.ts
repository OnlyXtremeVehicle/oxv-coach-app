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

  const circuit = await getDefaultCircuit();
  if (!circuit) {
    // `started` N'EST PAS POSÉ ICI, ET C'EST DÉLIBÉRÉ.
    //
    // Il l'était, juste avant la lecture. Or cette fonction est appelée au
    // montage de la racine, donc AVANT la connexion, et la policy `SELECT` de
    // `circuits` est `TO authenticated` : la lecture rend zéro ligne, on
    // ressortait ici — et le verrou restait fermé pour toute la session.
    // Conséquence : la permission de localisation n'était jamais demandée, et
    // le suivi jamais démarré, de tout l'usage.
    //
    // Un échec ne doit pas consommer l'unique tentative. L'effet racine ne se
    // rejoue pas, mais l'appel redevient au moins possible une fois le pilote
    // connecté.
    console.warn('[OXV Geo] Aucun circuit officiel trouvé, géoloc non démarrée');
    return;
  }

  started = true;
  setReferenceCircuit({ lat: circuit.finishLineLat, lon: circuit.finishLineLon });

  const perm = await requestLocationPermissions();
  if (!perm.granted) return;

  await startGeolocationTracking();
}

export function teardownGeolocation(): void {
  stopGeolocationTracking();
  started = false;
}
