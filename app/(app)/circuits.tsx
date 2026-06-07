/**
 * Écran Circuits — carte écosystème nationale (§8 étape A OXV Mirror).
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
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { isExpoGo } from '@/lib/runtime';
import { type DirectoryCircuit, circuitCenter, circuitSubtitle } from '@/services/ecosystemLogic';
import { fetchDirectoryCircuits } from '@/services/ecosystemService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>OXV CIRCUITS</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.xs }]}>
          Le track day en France.
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.text.secondary} />
        </View>
      ) : expoGo ? (
        <CircuitList circuits={circuits} />
      ) : (
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
                  pinColor={colors.accent.red}
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

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.md,
            }}
          >
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              {circuits.length} {circuits.length > 1 ? 'circuits référencés' : 'circuit référencé'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
                Retour
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/** Fallback liste (Expo Go, ou si la carte n'est pas disponible). */
function CircuitList({ circuits }: { circuits: DirectoryCircuit[] }) {
  if (circuits.length === 0) {
    return (
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
      >
        <Text style={[typography.manifest, { color: colors.text.tertiary, textAlign: 'center' }]}>
          Aucun circuit référencé pour l&apos;instant.
        </Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
      <View style={{ gap: spacing.md }}>
        {circuits.map((c) => (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({ pathname: '/(app)/circuit/[id]', params: { id: c.id } } as never)
            }
            style={({ pressed }) => ({
              padding: spacing.lg,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.title,
                fontWeight: fontWeight.light,
              }}
            >
              {c.officialName ?? c.name}
            </Text>
            {circuitSubtitle(c) ? (
              <Text
                style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
              >
                {circuitSubtitle(c)}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
      <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
