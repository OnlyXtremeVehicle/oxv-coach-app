/**
 * Écran « Belle route » — itinéraire balade/découverte (doc architecture/09).
 *
 * Cadre OXV : TOURISME / DÉCOUVERTE, pas performance. Propose de belles routes
 * sinueuses + points de vue autour du pilote, sur notre carte.
 *
 * V1 : les points de vue (Overpass/OSM) s'affichent SANS clé. Le calcul de
 * tracé (Kurviger via GraphHopper Directions, package moto) s'active dès que la
 * clé EXPO_PUBLIC_KURVIGER_KEY est posée. react-native-maps : build natif requis
 * (fallback en Expo Go).
 *
 * Attribution obligatoire (contrat Kurviger) affichée sur l'écran de la carte :
 * « Powered by Kurviger » + © OpenStreetMap.
 */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';

import { isExpoGo } from '@/lib/runtime';
import { findScenicPois } from '@/services/routing/scenicPoiService';
import { planScenicRoute } from '@/services/routing/scenicRouteService';
import { saveRoute } from '@/services/routing/scenicRoutesService';
import type { Curviness, GeoPoint, ScenicPoi, ScenicRoute } from '@/services/routing/types';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

// Repli si la géoloc est refusée : Circuit de Haute Saintonge (Beltoise).
const BELTOISE: GeoPoint = { lat: 45.2415, lon: -0.0915 };

const CURVINESS_OPTIONS: { label: string; value: Curviness }[] = [
  { label: 'Douce', value: 'douce' },
  { label: 'Sinueuse', value: 'sinueuse' },
  { label: 'Très sinueuse', value: 'tres_sinueuse' },
];
const DISTANCES = [50, 100, 150];

const POI_COLOR: Record<ScenicPoi['kind'], string> = {
  viewpoint: theme.palette.gold,
  water: theme.dataColors.brake,
  pass: theme.palette.red,
  peak: theme.palette.creamSoft,
};
const POI_LABEL: Record<ScenicPoi['kind'], string> = {
  viewpoint: 'Point de vue',
  water: 'Eau',
  pass: 'Col',
  peak: 'Sommet',
};

export default function BelleRouteScreen() {
  const [start, setStart] = useState<GeoPoint>(BELTOISE);
  const [pois, setPois] = useState<ScenicPoi[]>([]);
  const [route, setRoute] = useState<ScenicRoute | null>(null);
  const [curviness, setCurviness] = useState<Curviness>('sinueuse');
  const [distanceKm, setDistanceKm] = useState(100);
  const [loadingPois, setLoadingPois] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Position de départ (géoloc, sinon Beltoise) + points de vue autour (keyless).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let center = BELTOISE;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        }
      } catch {
        // géoloc indisponible → on garde Beltoise
      }
      if (cancelled) return;
      setStart(center);
      const found = await findScenicPois(center, 40000);
      if (!cancelled) {
        setPois(found);
        setLoadingPois(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Recadre la carte sur le départ + les points de vue (+ le tracé si présent).
  useEffect(() => {
    const coords = [
      { latitude: start.lat, longitude: start.lon },
      ...pois.map((p) => ({ latitude: p.point.lat, longitude: p.point.lon })),
      ...(route ? route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lon })) : []),
    ];
    if (coords.length > 1) {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 120, left: 60 },
        animated: true,
      });
    }
  }, [pois, route, start]);

  async function onPlan() {
    setPlanning(true);
    setRouteUnavailable(false);
    try {
      const r = await planScenicRoute({
        start,
        distanceKm,
        curviness,
        avoidMotorways: true,
        // Étapes « belles » : on glisse quelques points de vue proches comme waypoints.
        waypoints: pois.slice(0, 3).map((p) => p.point),
      });
      if (r) setRoute(r);
      else setRouteUnavailable(true);
    } finally {
      setPlanning(false);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const saved = await saveRoute({
        name: `Belle route · ${distanceKm} km`,
        start,
        curviness,
        route,
        pois,
      });
      Toast.show({
        type: saved ? 'success' : 'error',
        text1: saved ? 'Route enregistrée' : 'Connexion requise',
        text2: saved ? 'Retrouvez-la dans « Mes belles routes ».' : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (isExpoGo()) {
    return (
      <Screen scroll={false}>
        <AppBar title="BELLE ROUTE" onBack={() => router.back()} />
        <View style={s.centered}>
          <Text style={s.fallback}>
            La carte n&apos;est disponible que dans l&apos;application installée.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppBar title="BELLE ROUTE" subtitle="Balade & points de vue" onBack={() => router.back()} />

      {/* Contrôles */}
      <View style={s.controls}>
        <View style={s.pillRow}>
          {CURVINESS_OPTIONS.map((o) => {
            const on = o.value === curviness;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setCurviness(o.value)}
                style={[s.pill, on && s.pillOn]}
                hitSlop={6}
              >
                <Text style={[s.pillT, on && s.pillTOn]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[s.pillRow, { marginTop: theme.spacing.sm }]}>
          {DISTANCES.map((d) => {
            const on = d === distanceKm;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setDistanceKm(d)}
                style={[s.pill, on && s.pillOn]}
                hitSlop={6}
              >
                <Text style={[s.pillT, on && s.pillTOn]}>{d} km</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Carte */}
      <View style={{ flex: 1 }}>
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
          showsPointsOfInterest={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          <Marker
            coordinate={{ latitude: start.lat, longitude: start.lon }}
            title="Départ"
            pinColor={theme.palette.cream}
          />
          {pois.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.point.lat, longitude: p.point.lon }}
              title={p.name ?? POI_LABEL[p.kind]}
              description={POI_LABEL[p.kind]}
              pinColor={POI_COLOR[p.kind]}
            />
          ))}
          {route ? (
            <Polyline
              coordinates={route.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lon }))}
              strokeColor={theme.palette.gold}
              strokeWidth={4}
            />
          ) : null}
        </MapView>

        {loadingPois ? (
          <View style={s.pill2}>
            <ActivityIndicator color={theme.palette.creamSoft} size="small" />
            <Text style={s.pill2T}>Points de vue…</Text>
          </View>
        ) : null}

        {/* Attribution obligatoire (Kurviger + OpenStreetMap) */}
        <Pressable
          style={s.attr}
          accessibilityRole="link"
          onPress={() => Linking.openURL('https://kurviger.de').catch(() => undefined)}
        >
          <Text style={s.attrT}>Powered by Kurviger · © OpenStreetMap</Text>
        </Pressable>

        <View style={s.legend}>
          {(['viewpoint', 'water', 'pass', 'peak'] as ScenicPoi['kind'][]).map((k) => (
            <View key={k} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: POI_COLOR[k] }]} />
              <Text style={s.legendT}>{POI_LABEL[k]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Résumé + action */}
      <View style={s.footer}>
        {route ? (
          <Text style={s.summary}>
            {Math.round(route.distanceKm)} km · {Math.round(route.durationMin)} min
            {route.ascentM ? ` · ${Math.round(route.ascentM)} m D+` : ''} · sinuosité{' '}
            {route.sinuosity.toFixed(2)}
          </Text>
        ) : routeUnavailable ? (
          <Text style={s.summaryMute}>
            Le calcul d&apos;itinéraire s&apos;activera une fois la clé Kurviger configurée. Les
            points de vue, eux, sont déjà sur la carte.
          </Text>
        ) : (
          <Text style={s.summaryMute}>{pois.length} points remarquables autour de vous.</Text>
        )}
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button
            label={planning ? 'Calcul…' : 'Calculer une belle route'}
            onPress={onPlan}
            disabled={planning}
          />
        </View>
        <View style={{ marginTop: theme.spacing.sm }}>
          <Button
            label={saving ? 'Enregistrement…' : 'Enregistrer cette route'}
            variant="ghost"
            onPress={onSave}
            disabled={saving}
          />
        </View>
      </View>
    </Screen>
  );
}

const s = {
  centered: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.xl,
  },
  fallback: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
  },
  controls: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  pillRow: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm },
  pill: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  pillOn: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: theme.palette.edge },
  pillT: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  pillTOn: { color: theme.palette.cream },
  pill2: {
    position: 'absolute' as const,
    top: theme.spacing.md,
    alignSelf: 'center' as const,
    backgroundColor: theme.palette.card,
    borderColor: theme.palette.line,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  pill2T: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.creamSoft,
  },
  attr: {
    position: 'absolute' as const,
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: 'rgba(5,5,5,0.6)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  attrT: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  legend: {
    position: 'absolute' as const,
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    backgroundColor: 'rgba(5,5,5,0.6)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    gap: 4,
  },
  legendItem: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendT: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  summary: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.6,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  summaryMute: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
