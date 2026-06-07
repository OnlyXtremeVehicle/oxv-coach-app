/**
 * Écran Carte sociale — volet social OXV (§7.2).
 *
 * Carte interactive (react-native-maps) centrée sur la France /
 * Nouvelle-Aquitaine, avec les pings de localisation par type. Tap sur
 * un marqueur → callout avec titre + type, tap callout → retour liste.
 *
 * Réservé aux membres validés (RLS is_validated_member côté DB).
 *
 * react-native-maps nécessite un build natif : indisponible en Expo Go,
 * où l'on affiche un fallback renvoyant vers la liste.
 *
 * Doctrine : visualisation pure, aucune gamification.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { isExpoGo } from '@/lib/runtime';
import { type SocialPing, PING_KIND_LABELS, listSocialPings } from '@/services/socialPingsService';
import { colors, fontSize, spacing, typography } from '@/theme/tokens';

// Centre par défaut : Nouvelle-Aquitaine (cahier §7).
const DEFAULT_REGION = {
  latitude: 45.6,
  longitude: -0.4,
  latitudeDelta: 3.2,
  longitudeDelta: 3.2,
};

export default function SocialCarteScreen() {
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listSocialPings().then((rows) => {
      if (!cancelled) {
        setPings(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Expo Go : pas de module natif carte → fallback liste.
  if (isExpoGo()) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        <Text style={[typography.manifest, { color: colors.text.tertiary, textAlign: 'center' }]}>
          La carte n&apos;est disponible que dans l&apos;application installée.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)/social' as never)}
          style={{ marginTop: spacing.xl }}
        >
          <Text style={{ color: colors.accent.red, fontSize: fontSize.body }}>Voir la liste</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }} edges={['top']}>
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>OXV SOCIAL</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.xs }]}>Le territoire OXV.</Text>
      </View>

      <View style={{ flex: 1 }}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={DEFAULT_REGION}
          showsPointsOfInterest={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {pings.map((ping) => (
            <Marker
              key={ping.id}
              coordinate={{ latitude: ping.lat, longitude: ping.lon }}
              title={ping.title}
              description={PING_KIND_LABELS[ping.kind]}
              pinColor={colors.accent.red}
            />
          ))}
        </MapView>

        {loading ? (
          <View
            style={{
              position: 'absolute',
              top: spacing.md,
              alignSelf: 'center',
              backgroundColor: colors.background.secondary,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
            }}
          >
            <ActivityIndicator color={colors.text.secondary} size="small" />
            <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
              Chargement…
            </Text>
          </View>
        ) : null}
      </View>

      {/* Barre d'actions */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/(app)/social' as never)}
        >
          <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>
            Voir en liste
          </Text>
        </Pressable>
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
          {pings.length} {pings.length > 1 ? 'points' : 'point'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
