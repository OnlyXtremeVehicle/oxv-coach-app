/**
 * Écran Circuits — carte écosystème nationale (§8 étape A OXV Mirror).
 * Design V2 (charte oxv-mirror-app).
 *
 * Annuaire des circuits de France (couche gratuite, « aimant »). Carte
 * interactive react-native-maps centrée sur la France, un marqueur par
 * circuit ; tap → détail du circuit et de ses services. Fallback liste en
 * Expo Go (module natif indisponible).
 *
 * Étape A : référencement / mise en relation uniquement, aucun encaissement.
 * Le référencement national est progressif (démarrage Nouvelle-Aquitaine +
 * circuits majeurs) — la carte affiche les circuits présents en base.
 *
 * Doctrine : visualisation factuelle, aucun classement.
 * Reskin V2 : Screen + AppBar, Card, logique inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { isExpoGo } from '@/lib/runtime';
import { type DirectoryCircuit, circuitCenter, circuitSubtitle } from '@/services/ecosystemLogic';
import { fetchDirectoryCircuits } from '@/services/ecosystemService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Centre par défaut : France métropolitaine.
const FRANCE_REGION = {
  latitude: 46.6,
  longitude: 2.5,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

export default function CircuitsScreen() {
  const [circuits, setCircuits] = useState<DirectoryCircuit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchDirectoryCircuits().then((rows) => {
      if (!cancelled) {
        setCircuits(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const expoGo = isExpoGo();

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="CIRCUITS" subtitle="Le track day en France" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (expoGo) {
    return (
      <Screen scroll={false}>
        <AppBar title="CIRCUITS" subtitle="Le track day en France" onBack={() => router.back()} />
        <CircuitList circuits={circuits} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppBar title="CIRCUITS" subtitle="Le track day en France" onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={FRANCE_REGION}
          showsPointsOfInterest={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {circuits.map((c) => {
            const center = circuitCenter(c);
            if (!center) return null;
            return (
              <Marker
                key={c.id}
                coordinate={{ latitude: center.lat, longitude: center.lon }}
                title={c.officialName ?? c.name}
                description={circuitSubtitle(c)}
                pinColor={theme.palette.red}
                onCalloutPress={() =>
                  router.push({
                    pathname: '/(app)/circuit/[id]',
                    params: { id: c.id },
                  } as never)
                }
              />
            );
          })}
        </MapView>

        <View style={s.footer}>
          <Text style={s.footerCount}>
            {circuits.length} {circuits.length > 1 ? 'circuits référencés' : 'circuit référencé'}
          </Text>
        </View>
      </View>
    </Screen>
  );
}

/** Fallback liste (Expo Go, ou si la carte n'est pas disponible). */
function CircuitList({ circuits }: { circuits: DirectoryCircuit[] }) {
  if (circuits.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <Text style={s.empty}>Aucun circuit référencé pour l&apos;instant.</Text>
      </View>
    );
  }
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
      }}
    >
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
        {circuits.map((c) => {
          const name = c.officialName ?? c.name;
          return (
            <Card
              key={c.id}
              accessibilityLabel={name}
              onPress={() =>
                router.push({ pathname: '/(app)/circuit/[id]', params: { id: c.id } } as never)
              }
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.circuitName}>{name}</Text>
                {circuitSubtitle(c) ? <Text style={s.meta}>{circuitSubtitle(c)}</Text> : null}
              </View>
              <Text style={s.chevron} accessibilityElementsHidden>
                ›
              </Text>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = {
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  footerCount: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  circuitName: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  chevron: {
    color: theme.palette.creamMute,
    fontSize: 18,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  empty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
};
