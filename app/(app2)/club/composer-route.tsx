/**
 * Écran « Créer votre route » — planificateur d'itinéraire balade (GraphHopper).
 *
 * Retour fondateur build 23 : le planificateur retiré au reskin (f81df1f) revient,
 * RETRAVAILLÉ au langage v2 (surfaces sombres, hairlines, eyebrows mono, cadre de
 * carte) — pas collé tel quel. Le moteur n'a pas bougé : scenicRouteService
 * (GraphHopper POST + custom model de sinuosité), scenicPoiService (Overpass/OSM)
 * et scenicRoutesService (sauvegarde réelle, table `scenic_routes`).
 *
 * Cadre OXV : TOURISME / DÉCOUVERTE, jamais performance. La « sinuosité » est une
 * préférence de balade (géométrie de la route), pas une métrique de conduite.
 * Hors piste, hors chrono : l'or ne s'applique pas — le tracé est crème (identité).
 *
 * Composition :
 *   - départ  → géoloc du pilote (repli : Circuit de Haute Saintonge), déplaçable
 *     par appui long sur la carte (les points remarquables se rechargent autour) ;
 *   - étapes  → points remarquables (Overpass) ajoutés/retirés au toucher — 3 max,
 *     limite de points par requête GraphHopper (départ + 3 étapes + arrivée = 5) ;
 *   - arrivée → un toucher sur la carte ; sans arrivée, la route boucle au départ.
 *
 * Données réelles uniquement : distance / durée / D+ / sinuosité viennent de la
 * réponse GraphHopper — aucune valeur inventée (durée absente → non affichée) ;
 * sans clé configurée, l'écran le DIT et n'appelle rien.
 *
 * Animation : le tracé se révèle progressivement au rendu (Animated, ease-out) —
 * désactivée si « réduire les animations » est actif. Écran hors flux capture.
 *
 * Attribution : « Powered by GraphHopper · © OpenStreetMap » (exigence licence).
 *
 * ---
 *
 * PORTÉ EN app2 LE 29/07/2026 — LOT 19
 *
 * Depuis `app/(app)/creer-route.tsx`. **Le moteur n'a pas bougé d'une ligne** :
 * seules la coquille d'écran et les jetons changent, du kit V1 (#0B0B0D) vers
 * le kit V2 « DA Instrument » (#14151A).
 *
 * Le fichier destructurait cinq familles de jetons V1 et cinq cent soixante-dix
 * lignes de styles s'en servaient. Plutôt que de les retoucher une à une — avec
 * le risque de transcription que cela porte — la correspondance est posée EN
 * TÊTE, explicite et justifiée, ci-dessous.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_DEFAULT,
  type LongPressEvent,
  type MapPressEvent,
} from 'react-native-maps';
import Toast from 'react-native-toast-message';

import { FadeInSection, useReduceMotion } from '@/components/motion';
import { isExpoGo } from '@/lib/runtime';
import { findScenicPois } from '@/services/routing/scenicPoiService';
import { planScenicRoute } from '@/services/routing/scenicRouteService';
import { saveRoute } from '@/services/routing/scenicRoutesService';
import type { Curviness, GeoPoint, ScenicPoi, ScenicRoute } from '@/services/routing/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PressScale, colors, motionTokens, radius as radiusV2, space, typo } from '@/ui/v2';
import { haversineDistance } from '@/utils/geo';

/**
 * CORRESPONDANCE V1 → V2, POSÉE UNE FOIS
 *
 * Les styles de cet écran nomment les jetons V1. Les traduire ici, plutôt que
 * de réécrire cinq cent soixante-dix lignes, garde le portage lisible et
 * vérifiable : chaque ligne dit quel jeton V2 remplace lequel, et pourquoi.
 *
 * Deux collapsus assumés, faute d'équivalent :
 *   · `creamSoft` (secondaire fort) rejoint `text.hi` — V2 n'a pas de palier
 *     entre le texte principal et `text.mid`, nettement plus sombre ;
 *   · `bodyLight` rejoint `body` — le kit V2 n'a pas de graisse légère.
 *
 * Deux paliers de trait sont en revanche PRÉSERVÉS : `line` (bordure de carte)
 * et `separator` (filet fin) tombent sur `border.card` et `border.hairline`,
 * qui gardent le même ordre de force.
 */
const palette = {
  card: colors.bg.card,
  card2: colors.bg.card2,
  cardBorderProminent: colors.border.strong,
  cream: colors.text.hi,
  creamSoft: colors.text.hi,
  creamMute: colors.text.low,
  eyebrow: colors.text.dim,
  // Vert d'ÉTAT (« validé »), pas de donnée de conduite — l'étape retenue.
  green: colors.qdi.acceleration,
  line: colors.border.card,
  separator: colors.border.hairline,
} as const;

const fonts = { body: typo.body, bodyLight: typo.body, mono: typo.mono } as const;
const fontSize = { small: 12, bodyLg: 15 } as const;
const spacing = { sm: space.sm, md: space.md, lg: space.lg, xl: space.xl } as const;
const radius = { sm: radiusV2.cell, lg: radiusV2.card, pill: radiusV2.pill } as const;

/** Cible tactile regagnée sur les petits glyphes — le kit V1 la portait en jeton. */
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/** Durée de révélation du tracé. `reveal` (640 ms) n'existe pas en V2 ; `radar` en est le voisin. */
const DUREE_REVELATION = motionTokens.radar + 360;

// Repli si la géoloc est refusée : Circuit de Haute Saintonge (Beltoise).
const BELTOISE: GeoPoint = { lat: 45.2415, lon: -0.0915 };
// Rayon de recherche des points remarquables autour du départ (m).
const POI_RADIUS_M = 40000;
// GraphHopper (offre standard) limite les points par requête : départ + 3 + arrivée.
const MAX_ETAPES = 3;
// Un toucher à moins de 250 m d'un point remarquable → l'arrivée porte son nom.
const ARRIVAL_NAME_RADIUS_M = 250;

// Sans clé, le moteur renvoie null d'office : on le DIT au lieu d'appeler dans le vide.
const HAS_ROUTING_KEY = Boolean(
  process.env.EXPO_PUBLIC_GRAPHHOPPER_KEY || process.env.EXPO_PUBLIC_KURVIGER_KEY
);

const CURVINESS_OPTIONS: { label: string; value: Curviness }[] = [
  { label: 'Douce', value: 'douce' },
  { label: 'Sinueuse', value: 'sinueuse' },
  { label: 'Très sinueuse', value: 'tres_sinueuse' },
];

// Couleurs de CATÉGORIE POI (identité de lieu, jamais de la donnée de conduite) :
// l'or reste au chrono/record ; le vert (palette.green = « validé ») marque
// l'étape sélectionnée, conformément au rôle d'état de cette couleur.
const POI_COLOR: Record<ScenicPoi['kind'], string> = {
  viewpoint: palette.cream,
  water: '#60A5FA', // bleu « eau » (catégorie POI, distinct du bleu trajectoire QDI)
  pass: colors.qdi.regularite, // violet non-or (choix V1 conservé, catégorie POI)
  peak: palette.creamSoft,
};
const POI_LABEL: Record<ScenicPoi['kind'], string> = {
  viewpoint: 'Point de vue',
  water: 'Eau',
  pass: 'Col',
  peak: 'Sommet',
};

type StartSource = 'position' | 'circuit' | 'carte';
const START_LABEL: Record<StartSource, string> = {
  position: 'votre position',
  circuit: 'Circuit de Haute Saintonge',
  carte: 'point choisi',
};

type Arrival = { point: GeoPoint; name: string | null };

/** Nom du point remarquable le plus proche du toucher (≤ 250 m), sinon null. */
function nearestPoiName(point: GeoPoint, pois: ScenicPoi[]): string | null {
  let best: ScenicPoi | null = null;
  let bestD = ARRIVAL_NAME_RADIUS_M;
  for (const p of pois) {
    const d = haversineDistance(point.lat, point.lon, p.point.lat, p.point.lon);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best?.name ?? null;
}

/** Nom d'enregistrement — bâti sur les seules valeurs réelles du tracé. */
function routeName(route: ScenicRoute, arrival: Arrival | null): string {
  const km = Math.round(route.distanceKm);
  if (arrival) return arrival.name ? `Vers ${arrival.name} · ${km} km` : `Route · ${km} km`;
  return `Boucle · ${km} km`;
}

/**
 * L'en-tête de l'écran.
 *
 * Le kit V2 n'a pas d'`AppBar` : les écrans de `app/(app2)` composent le leur.
 * Celui-ci reprend le patron des autres — chevron de retour à gauche, titre en
 * mono capitales, largeur symétrique à droite pour que le titre reste centré.
 */
function EnTete({ insetsTop, sous }: { insetsTop: number; sous?: string }) {
  return (
    <View style={[s.entete, { paddingTop: insetsTop + spacing.sm }]}>
      <PressScale
        onPress={() => router.back()}
        accessibilityLabel="Retour"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={s.chevron}>‹</Text>
      </PressScale>
      <View style={s.enteteCentre}>
        <Text style={s.enteteTitre} accessibilityRole="header">
          CRÉER VOTRE ROUTE
        </Text>
        {sous ? <Text style={s.enteteSous}>{sous}</Text> : null}
      </View>
      <View style={s.enteteEspaceur} />
    </View>
  );
}

export default function CreerRouteScreen() {
  const insets = useSafeAreaInsets();
  const [start, setStart] = useState<GeoPoint>(BELTOISE);
  const [startSource, setStartSource] = useState<StartSource>('circuit');
  const [pois, setPois] = useState<ScenicPoi[]>([]);
  const [loadingPois, setLoadingPois] = useState(true);
  const [etapes, setEtapes] = useState<ScenicPoi[]>([]);
  const [arrival, setArrival] = useState<Arrival | null>(null);
  const [curviness, setCurviness] = useState<Curviness>('sinueuse');
  const [planning, setPlanning] = useState(false);
  const [planFailed, setPlanFailed] = useState(false);
  const [route, setRoute] = useState<ScenicRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const mapRef = useRef<MapView>(null);
  // Compteur de requêtes POI : seule la réponse de la DERNIÈRE requête compte
  // (un appui long pendant un chargement ne doit pas être écrasé par l'ancien).
  const poiRequest = useRef(0);

  const loadPois = useCallback(async (center: GeoPoint) => {
    const req = ++poiRequest.current;
    setLoadingPois(true);
    const found = await findScenicPois(center, POI_RADIUS_M);
    if (req === poiRequest.current) {
      setPois(found);
      setLoadingPois(false);
    }
  }, []);

  // Toute modification de la composition invalide le tracé affiché : la carte ne
  // montre jamais une courbe qui ne correspond plus aux choix du pilote.
  const resetResult = useCallback(() => {
    setRoute(null);
    setPlanFailed(false);
    setSaved(false);
  }, []);

  // Départ initial : géoloc du pilote, sinon Beltoise. Puis points remarquables.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let center = BELTOISE;
      let source: StartSource = 'circuit';
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          source = 'position';
        }
      } catch {
        // géoloc indisponible → on garde Beltoise
      }
      if (cancelled) return;
      setStart(center);
      setStartSource(source);
      void loadPois(center);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPois]);

  // Recadre la carte sur le départ + les points (+ le tracé quand il existe).
  useEffect(() => {
    const coords = [
      { latitude: start.lat, longitude: start.lon },
      ...pois.map((p) => ({ latitude: p.point.lat, longitude: p.point.lon })),
      ...(route ? route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lon })) : []),
    ];
    if (coords.length > 1) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 80, left: 60 },
        animated: true,
      });
    }
  }, [pois, route, start]);

  function toggleEtape(poi: ScenicPoi) {
    setEtapes((prev) => {
      if (prev.some((e) => e.id === poi.id)) return prev.filter((e) => e.id !== poi.id);
      if (prev.length >= MAX_ETAPES) {
        Toast.show({
          type: 'info',
          text1: `${MAX_ETAPES} étapes maximum`,
          text2: 'Retirez une étape pour en ajouter une autre.',
        });
        return prev;
      }
      return [...prev, poi];
    });
    resetResult();
  }

  function onMapPress(e: MapPressEvent) {
    // Android relaie aussi les taps de marqueurs ici — on ne pose pas d'arrivée dessus.
    if (e.nativeEvent.action === 'marker-press') return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const point: GeoPoint = { lat: latitude, lon: longitude };
    setArrival({ point, name: nearestPoiName(point, pois) });
    resetResult();
  }

  function onMapLongPress(e: LongPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const point: GeoPoint = { lat: latitude, lon: longitude };
    setStart(point);
    setStartSource('carte');
    resetResult();
    void loadPois(point);
  }

  async function onTrace() {
    setPlanning(true);
    setPlanFailed(false);
    try {
      const r = await planScenicRoute({
        start,
        // Sans arrivée posée, la route boucle au départ (via les étapes).
        end: arrival?.point ?? start,
        curviness,
        avoidMotorways: true,
        waypoints: etapes.map((p) => p.point),
      });
      if (r) {
        setRoute(r);
        setSaved(false);
      } else {
        setPlanFailed(true);
      }
    } finally {
      setPlanning(false);
    }
  }

  async function onSave() {
    if (!route) return;
    setSaving(true);
    try {
      const savedRoute = await saveRoute({
        name: routeName(route, arrival),
        start,
        curviness,
        route,
        pois: etapes,
      });
      if (savedRoute) {
        setSaved(true);
        Toast.show({
          type: 'success',
          text1: 'Route enregistrée',
          text2: 'Retrouvez-la dans « Mes belles routes ».',
        });
      } else {
        Toast.show({ type: 'error', text1: 'Connexion requise' });
      }
    } finally {
      setSaving(false);
    }
  }

  if (isExpoGo()) {
    return (
      <View style={s.root}>
        <EnTete insetsTop={insets.top} />
        <View style={s.centered}>
          <Text style={s.fallback}>
            La carte n&apos;est disponible que dans l&apos;application installée.
          </Text>
        </View>
      </View>
    );
  }

  // Une boucle sans étape = deux points identiques : rien à calculer.
  const canTrace = HAS_ROUTING_KEY && (arrival !== null || etapes.length > 0);
  const etapeIds = new Set(etapes.map((e) => e.id));
  const durationMin = route ? Math.round(route.durationMin) : 0;

  return (
    <View style={s.root}>
      <EnTete insetsTop={insets.top} sous="Balade · hors chrono" />

      {/* Composeur : préférence de sinuosité (eyebrow + hairline, pills mono v2). */}
      <View style={s.composer}>
        <View style={s.headRow}>
          <View style={s.headDot} accessibilityElementsHidden importantForAccessibility="no" />
          <Text style={s.eyebrow}>Sinuosité de balade</Text>
          <View style={s.headLine} accessibilityElementsHidden importantForAccessibility="no" />
        </View>
        <View style={s.pillRow}>
          {CURVINESS_OPTIONS.map((o) => {
            const on = o.value === curviness;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                hitSlop={HIT_SLOP}
                onPress={() => {
                  setCurviness(o.value);
                  resetResult();
                }}
                style={[s.pill, on && s.pillOn]}
              >
                <Text style={[s.pillT, on && s.pillTOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={s.hint}>
          Touchez un point remarquable pour l&apos;ajouter en étape, la carte pour poser
          l&apos;arrivée. Sans arrivée, la route boucle au départ. Appui long : déplacer le départ.
        </Text>
      </View>

      {/* Carte (cadre sombre v2). */}
      <View style={s.mapFrame}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: start.lat,
            longitude: start.lon,
            latitudeDelta: 0.6,
            longitudeDelta: 0.6,
          }}
          showsPointsOfInterests={false}
          showsCompass={false}
          toolbarEnabled={false}
          onPress={onMapPress}
          onLongPress={onMapLongPress}
        >
          <Marker
            coordinate={{ latitude: start.lat, longitude: start.lon }}
            title="Départ"
            description={START_LABEL[startSource]}
            pinColor={palette.cream}
          />
          {pois
            .filter((p) => !etapeIds.has(p.id))
            .map((p) => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.point.lat, longitude: p.point.lon }}
                title={p.name ?? POI_LABEL[p.kind]}
                description={POI_LABEL[p.kind]}
                pinColor={POI_COLOR[p.kind]}
                onPress={() => toggleEtape(p)}
              />
            ))}
          {etapes.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.point.lat, longitude: p.point.lon }}
              title={p.name ?? POI_LABEL[p.kind]}
              description="Étape de votre route"
              pinColor={palette.green}
              onPress={() => toggleEtape(p)}
            />
          ))}
          {arrival ? (
            <Marker
              coordinate={{ latitude: arrival.point.lat, longitude: arrival.point.lon }}
              title="Arrivée"
              description={arrival.name ?? undefined}
              pinColor={palette.creamSoft}
            />
          ) : null}
          {route ? <AnimatedRouteLine coordinates={route.coordinates} /> : null}
        </MapView>

        {loadingPois ? (
          <View style={s.loadingPill}>
            <ActivityIndicator
              color={palette.creamSoft}
              size="small"
              accessibilityLabel="Recherche des points remarquables"
            />
            <Text style={s.loadingTxt}>Points remarquables</Text>
          </View>
        ) : null}

        {/* Légende sobre (catégories POI + étape sélectionnée). */}
        <View style={s.legend}>
          {(['viewpoint', 'water', 'pass', 'peak'] as ScenicPoi['kind'][]).map((k) => (
            <LegendItem key={k} color={POI_COLOR[k]} label={POI_LABEL[k]} />
          ))}
          <LegendItem color={palette.green} label="Étape" />
        </View>

        {/* Attribution (exigence de licence GraphHopper + OpenStreetMap). */}
        <Pressable
          style={s.attr}
          accessibilityRole="link"
          accessibilityLabel="Powered by GraphHopper, données OpenStreetMap"
          onPress={() => Linking.openURL('https://www.graphhopper.com').catch(() => undefined)}
        >
          <Text style={s.attrT}>Powered by GraphHopper · © OpenStreetMap</Text>
        </Pressable>
      </View>

      {/* Composition + résultat + actions. */}
      <View style={s.footer}>
        <View style={s.chipsRow}>
          <CompositionChip
            label={`Départ · ${START_LABEL[startSource]}`}
            dotColor={palette.cream}
          />
          {etapes.map((p) => (
            <CompositionChip
              key={p.id}
              label={p.name ?? POI_LABEL[p.kind]}
              dotColor={palette.green}
              onRemove={() => toggleEtape(p)}
              removeLabel={`Retirer l'étape ${p.name ?? POI_LABEL[p.kind]}`}
            />
          ))}
          {arrival ? (
            <CompositionChip
              label={arrival.name ? `Arrivée · ${arrival.name}` : 'Arrivée'}
              dotColor={palette.creamSoft}
              onRemove={() => {
                setArrival(null);
                resetResult();
              }}
              removeLabel="Retirer l'arrivée"
            />
          ) : null}
        </View>

        {route ? (
          // Résultat : valeurs RÉELLES de la réponse GraphHopper, rien d'autre.
          // Durée absente de la réponse → non affichée (jamais un 0 fabriqué).
          <FadeInSection>
            <Text style={s.summary}>
              {Math.round(route.distanceKm)} km
              {durationMin > 0 ? ` · ${durationMin} min` : ''}
              {route.ascentM != null ? ` · ${Math.round(route.ascentM)} m D+` : ''}
              {` · sinuosité ${route.sinuosity.toFixed(2).replace('.', ',')}`}
            </Text>
          </FadeInSection>
        ) : planFailed ? (
          <Text style={s.note}>
            Le tracé n&apos;a pas pu être calculé — service de routage ou connexion indisponible
            pour le moment.
          </Text>
        ) : !HAS_ROUTING_KEY ? (
          <Text style={s.note}>
            Le calcul d&apos;itinéraire s&apos;activera une fois la clé GraphHopper configurée. Les
            points remarquables, eux, sont déjà sur la carte.
          </Text>
        ) : (
          <Text style={s.note}>
            {loadingPois
              ? 'Recherche des points remarquables autour du départ.'
              : `${pois.length} points remarquables autour du départ.`}
          </Text>
        )}

        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button
              label="Tracer la route"
              onPress={onTrace}
              loading={planning}
              disabled={!canTrace}
            />
          </View>
          {route ? (
            <View style={{ flex: 1 }}>
              <Button
                label={saved ? 'Enregistrée' : 'Enregistrer'}
                variant="ghost"
                onPress={onSave}
                loading={saving}
                disabled={saved}
              />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Tracé révélé progressivement : une valeur Animated (ease-out cubic, ~1 s)
 * déroule la polyligne par paliers — l'équivalent carte du « stroke progressif »
 * SVG, sans surcouche à recaler sur la projection. Les re-rendus restent locaux
 * à ce composant (≤ 48 paliers). « Réduire les animations » → rendu direct.
 */
function AnimatedRouteLine({ coordinates }: { coordinates: GeoPoint[] }) {
  const reduceMotion = useReduceMotion();
  const [count, setCount] = useState(2);

  useEffect(() => {
    if (reduceMotion) {
      setCount(coordinates.length);
      return;
    }
    setCount(2);
    const progress = new Animated.Value(0);
    const steps = 48;
    let lastStep = 0;
    const sub = progress.addListener(({ value }) => {
      const step = Math.min(steps, Math.ceil(value * steps));
      if (step !== lastStep) {
        lastStep = step;
        setCount(Math.max(2, Math.round((step / steps) * coordinates.length)));
      }
    });
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DUREE_REVELATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // la valeur pilote un découpage JS, pas un style natif
    });
    anim.start();
    return () => {
      anim.stop();
      progress.removeListener(sub);
    };
  }, [coordinates, reduceMotion]);

  return (
    <Polyline
      coordinates={coordinates.slice(0, count).map((c) => ({ latitude: c.lat, longitude: c.lon }))}
      strokeColor={palette.cream}
      strokeWidth={4}
    />
  );
}

/** Puce de composition (départ / étape / arrivée) — retirable quand `onRemove`. */
function CompositionChip({
  label,
  dotColor,
  onRemove,
  removeLabel,
}: {
  label: string;
  dotColor: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const body = (
    <>
      <View
        style={[s.chipDot, { backgroundColor: dotColor }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={s.chipT} numberOfLines={1}>
        {label}
      </Text>
      {onRemove ? <Text style={s.chipX}>×</Text> : null}
    </>
  );
  if (!onRemove) {
    return (
      <View style={s.chip} accessibilityRole="text" accessibilityLabel={label}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={removeLabel ?? label}
      hitSlop={HIT_SLOP}
      onPress={onRemove}
      style={({ pressed }) => [s.chip, pressed && { opacity: 0.7 }]}
    >
      {body}
    </Pressable>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={s.legendItem}>
      <View
        style={[s.legendDot, { backgroundColor: color }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={s.legendT}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles — langage refonte-v2 : surfaces sombres, hairlines, eyebrows */
/* mono, cadre de carte. Jamais d'or (hors piste, hors chrono).        */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  // — Coquille (portée depuis Screen + AppbBar du kit V1) —
  root: { flex: 1, backgroundColor: colors.bg.base },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chevron: {
    fontFamily: fonts.body,
    fontSize: 28,
    lineHeight: 30,
    color: palette.cream,
    width: 24,
  },
  enteteCentre: { flex: 1, alignItems: 'center' },
  enteteTitre: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: palette.creamMute,
  },
  enteteSous: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: palette.eyebrow,
    marginTop: 2,
  },
  enteteEspaceur: { width: 24 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  fallback: {
    fontFamily: fonts.bodyLight,
    fontSize: fontSize.bodyLg,
    fontStyle: 'italic',
    color: palette.creamMute,
    textAlign: 'center',
    lineHeight: fontSize.bodyLg * 1.6,
  },

  // — Composeur —
  composer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.creamMute },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: palette.eyebrow,
  },
  headLine: { flex: 1, height: 1, backgroundColor: palette.separator },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
  },
  // Actif = fond gris (card2) + bordure prominente, jamais d'or.
  pillOn: { backgroundColor: palette.card2, borderColor: palette.cardBorderProminent },
  pillT: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamMute,
  },
  pillTOn: { color: palette.cream },
  hint: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    lineHeight: fontSize.small * 1.45,
    marginTop: spacing.sm,
  },

  // — Carte (cadre sombre v2) —
  mapFrame: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    overflow: 'hidden',
  },
  loadingPill: {
    position: 'absolute',
    top: spacing.md,
    alignSelf: 'center',
    backgroundColor: palette.card,
    borderColor: palette.line,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.creamSoft,
  },
  legend: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: 'rgba(11,11,13,0.72)',
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendT: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamSoft,
  },
  attr: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(11,11,13,0.72)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  attrT: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },

  // — Pied : composition, résultat, actions —
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 220,
    backgroundColor: palette.card2,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipT: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: palette.creamSoft,
  },
  chipX: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: palette.creamMute,
    marginLeft: 2,
  },
  summary: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.6,
    color: palette.cream,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    textAlign: 'center',
    lineHeight: fontSize.small * 1.5,
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
