/**
 * CarteOxv — le fond de plan OXV, une seule porte pour toute l'application.
 *
 * ===========================================================================
 * POURQUOI UN COMPOSANT PLUTÔT QUE `Map` DIRECTEMENT
 * ===========================================================================
 *
 * Deux écrans montrent une carte (`club/territoire`, `club/composer-route`), et
 * ils la montraient chacun à leur façon. En passant par ici, le style, le zoom
 * initial et la conversion des bornes sont écrits UNE fois : deux écrans ne
 * peuvent plus diverger sur le fond, ce qui est exactement ce qu'on reprochait
 * à `PROVIDER_DEFAULT`.
 *
 * ===========================================================================
 * LA RÉGION, ET POURQUOI ELLE EST TRADUITE ICI
 * ===========================================================================
 *
 * `react-native-maps` parlait en `{ latitude, longitude, latitudeDelta,
 * longitudeDelta }`. MapLibre parle en bornes `[ouest, sud, est, nord]`. Le
 * reste du dépôt — `regionToBBox`, `filterInView` — est écrit dans le premier
 * langage et fonctionne.
 *
 * On traduit donc à la frontière plutôt que de réécrire la logique de filtrage
 * en aval : ce sont des fonctions pures, testées, qui n'ont rien à voir avec le
 * moteur de rendu. Changer de carte ne doit pas leur coûter une ligne.
 */

import { useCallback, type ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Camera, Map, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';

import { styleOxv } from './styleOxv';

/** La région telle que le reste du dépôt la connaît (héritage react-native-maps). */
export interface RegionCarte {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface CarteOxvProps {
  /** Cadrage initial. Non piloté ensuite : la carte appartient au doigt. */
  readonly regionInitiale: RegionCarte;
  /** Appelé quand le déplacement s'achève — jamais pendant, pour ne pas hacher. */
  readonly onRegion?: (region: RegionCarte) => void;
  /**
   * Recadrage programmatique. `null` laisse la carte au doigt du pilote.
   *
   * Remplace l'ancien `mapRef.current?.animateToRegion(…)` : une prop plutôt
   * qu'une poignée sur le moteur de rendu, de sorte qu'un futur changement de
   * moteur ne se propage pas dans les écrans.
   *
   * La carte ne bouge QUE lorsque cette valeur change d'identité — repasser le
   * même objet ne relance pas d'animation, et le pilote garde la main.
   */
  readonly cible?: RegionCarte | null;
  readonly children?: ReactNode;
  readonly style?: ViewStyle;
}

/** Bornes MapLibre `[ouest, sud, est, nord]` → région à l'ancienne. */
export function bornesVersRegion(bornes: readonly number[]): RegionCarte | null {
  if (bornes.length < 4) return null;
  const [ouest, sud, est, nord] = bornes;
  if (![ouest, sud, est, nord].every((n) => Number.isFinite(n))) return null;
  return {
    latitude: (sud + nord) / 2,
    longitude: (ouest + est) / 2,
    // Toujours positifs : des bornes inversées (antiméridien, ou un moteur qui
    // les rendrait dans l'autre sens) produiraient un delta négatif, et tout
    // filtrage en aval renverrait alors une liste vide sans dire pourquoi.
    latitudeDelta: Math.abs(nord - sud),
    longitudeDelta: Math.abs(est - ouest),
  };
}

/**
 * Niveau de zoom approchant un delta de latitude donné.
 *
 * L'approximation est assumée : elle ne sert qu'au cadrage INITIAL, que le
 * pilote ajuste aussitôt du doigt. Chercher l'exactitude ici demanderait la
 * hauteur du composant, que le cadrage initial n'a pas encore.
 */
export function zoomPourDelta(latitudeDelta: number): number {
  if (!Number.isFinite(latitudeDelta) || latitudeDelta <= 0) return 10;
  const z = Math.log2(360 / latitudeDelta);
  return Math.max(1, Math.min(18, z));
}

export function CarteOxv({ regionInitiale, onRegion, cible, children, style }: CarteOxvProps) {
  const vue = cible ?? regionInitiale;
  const surRegion = useCallback(
    (e: { nativeEvent: ViewStateChangeEvent }) => {
      if (!onRegion) return;
      const region = bornesVersRegion(e.nativeEvent.bounds ?? []);
      if (region) onRegion(region);
    },
    [onRegion]
  );

  return (
    <Map
      style={style ?? StyleSheet.absoluteFill}
      mapStyle={styleOxv()}
      onRegionDidChange={surRegion}
      // Le bouton d'attribution reste affiché : la licence ODbL
      // d'OpenStreetMap l'exige, et s'héberger soi-même n'en affranchit pas.
      // La garde `attributionOsm` du dépôt dit la même chose.
      attribution
    >
      <Camera
        center={[vue.longitude, vue.latitude]}
        zoom={zoomPourDelta(vue.latitudeDelta)}
        duration={cible ? 350 : 0}
      />
      {children}
    </Map>
  );
}
