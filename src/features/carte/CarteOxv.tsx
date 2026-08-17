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
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';

import { palette } from '@/theme/v2';
import { TAILLE_PASTILLE } from './paletteCarte';
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
  /**
   * Cadrage sur des bornes `[ouest, sud, est, nord]` — remplace
   * `fitToCoordinates`. Prioritaire sur `cible` : demander les deux serait
   * contradictoire, et l'englobement est le geste le plus explicite des deux.
   */
  readonly bornes?: readonly [number, number, number, number] | null;
  /** Appui simple sur le fond. Les appuis sur un marqueur ne passent pas ici. */
  readonly onAppui?: (point: { lat: number; lon: number }) => void;
  readonly onAppuiLong?: (point: { lat: number; lon: number }) => void;
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

export function CarteOxv({
  regionInitiale,
  onRegion,
  cible,
  bornes,
  onAppui,
  onAppuiLong,
  children,
  style,
}: CarteOxvProps) {
  const vue = cible ?? regionInitiale;

  /**
   * `lngLat` arrive en `[longitude, latitude]` — l'ordre GeoJSON, l'inverse de
   * celui qu'emploie le reste du dépôt. L'inversion se fait ICI, une fois : la
   * confondre plus loin poserait un point au milieu de l'océan sans lever
   * d'erreur.
   */
  const point = (lngLat: readonly number[]) =>
    lngLat.length >= 2 && Number.isFinite(lngLat[0]) && Number.isFinite(lngLat[1])
      ? { lat: lngLat[1], lon: lngLat[0] }
      : null;

  const surAppui = useCallback(
    (e: { nativeEvent: { lngLat?: readonly number[] } }) => {
      if (!onAppui) return;
      const p = point(e.nativeEvent.lngLat ?? []);
      if (p) onAppui(p);
    },
    [onAppui]
  );

  const surAppuiLong = useCallback(
    (e: { nativeEvent: { lngLat?: readonly number[] } }) => {
      if (!onAppuiLong) return;
      const p = point(e.nativeEvent.lngLat ?? []);
      if (p) onAppuiLong(p);
    },
    [onAppuiLong]
  );
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
      onPress={onAppui ? surAppui : undefined}
      onLongPress={onAppuiLong ? surAppuiLong : undefined}
    >
      {bornes ? (
        <Camera
          bounds={[bornes[0], bornes[1], bornes[2], bornes[3]]}
          padding={{ top: 60, right: 60, bottom: 80, left: 60 }}
          duration={350}
        />
      ) : (
        <Camera
          center={[vue.longitude, vue.latitude]}
          zoom={zoomPourDelta(vue.latitudeDelta)}
          duration={cible ? 350 : 0}
        />
      )}
      {children}
    </Map>
  );
}

/**
 * Bornes englobant une liste de points, ou `null` si la liste est vide.
 *
 * Remplace `fitToCoordinates`. Une liste d'un seul point rend des bornes
 * dégénérées (largeur nulle) : c'est volontaire — la caméra centre alors
 * dessus, et fabriquer une marge arbitraire donnerait un zoom qui ne veut rien
 * dire.
 */
export function bornesDe(
  points: readonly { lat: number; lon: number }[]
): [number, number, number, number] | null {
  const valides = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (valides.length === 0) return null;
  const lats = valides.map((p) => p.lat);
  const lons = valides.map((p) => p.lon);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

/**
 * Un repère ponctuel coloré.
 *
 * `pinColor` de `react-native-maps` n'existe plus : MapLibre pose une vraie vue,
 * et c'est un gain — la pastille suit la charte au lieu d'être un dessin natif
 * différent sur chaque plateforme.
 */
export function PastilleCarte({
  point,
  couleur,
  label,
  taille = TAILLE_PASTILLE.normale,
  onPress,
}: {
  readonly point: { lat: number; lon: number };
  /** Une teinte de `paletteCarte`. JAMAIS une couleur de donnée — cf. la garde. */
  readonly couleur: string;
  readonly label: string;
  /** Second canal de lecture, pour ne pas faire reposer un état sur la seule teinte. */
  readonly taille?: number;
  readonly onPress?: () => void;
}) {
  return (
    <Marker lngLat={[point.lon, point.lat]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          stylesCarte.pastille,
          { width: taille, height: taille, borderRadius: taille / 2, backgroundColor: couleur },
        ]}
      />
    </Marker>
  );
}

/**
 * Le tracé d'une route sur la carte.
 *
 * `Polyline` n'existe plus : MapLibre passe par une source GeoJSON et une
 * couche. C'est plus verbeux et nettement plus capable — la même source
 * accepterait un dégradé le long du tracé, ce que `Polyline` ne savait pas
 * faire.
 *
 * Sous deux points, rien n'est rendu : une « ligne » d'un point est un artefact,
 * et le moteur la dessinerait comme un pâté.
 */
export function TraceCarte({
  points,
  couleur,
  epaisseur = 4,
}: {
  readonly points: readonly { lat: number; lon: number }[];
  readonly couleur: string;
  readonly epaisseur?: number;
}) {
  const coords = points
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
    .map((p) => [p.lon, p.lat]);
  if (coords.length < 2) return null;

  return (
    <GeoJSONSource
      id="trace-oxv"
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      }}
    >
      <Layer
        id="trace-oxv-ligne"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': couleur, 'line-width': epaisseur }}
      />
    </GeoJSONSource>
  );
}

const stylesCarte = StyleSheet.create({
  pastille: {
    borderWidth: 2,
    // Le liseré sombre détache la pastille du fond de carte quelle que soit la
    // teinte dessous — sans lui, une pastille claire disparaît sur une route.
    borderColor: palette.night,
  },
});
