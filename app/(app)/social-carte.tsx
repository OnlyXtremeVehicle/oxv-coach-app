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
 * Reskin V2 : Screen + AppBar autour de la carte. MapView inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import { isExpoGo } from '@/lib/runtime';
import { type SocialPing, PING_KIND_LABELS, listSocialPings } from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';

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
      <Screen scroll={false}>
        <AppBar title="CARTE" onBack={() => router.back()} />
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: theme.spacing.xl,
          }}
        >
          <Text style={s.fallback}>
            La carte n&apos;est disponible que dans l&apos;application installée.
          </Text>
          <View style={{ marginTop: theme.spacing.xl, alignSelf: 'stretch' }}>
            <Button
              label="Voir la liste"
              onPress={() => router.replace('/(app)/social' as never)}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <AppBar title="CARTE" subtitle="Le territoire OXV" onBack={() => router.back()} />

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
              pinColor={theme.palette.gold}
            />
          ))}
        </MapView>

        {loading ? (
          <View style={s.loadingPill}>
            <ActivityIndicator
              color={theme.palette.creamSoft}
              size="small"
              accessibilityLabel="Chargement du territoire"
            />
            <Text style={s.loadingTxt}>Chargement…</Text>
          </View>
        ) : null}
      </View>

      {/* Barre d'actions */}
      <View style={s.actionBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voir le territoire en liste"
          hitSlop={theme.hitSlop}
          onPress={() => router.replace('/(app)/social' as never)}
          style={({ pressed }) => [s.actionHit, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.action}>Voir en liste</Text>
        </Pressable>
        <Text
          style={s.count}
          accessibilityLabel={`${pings.length} ${pings.length > 1 ? 'lieux' : 'lieu'}`}
        >
          <Text style={s.countNum}>{pings.length}</Text> {pings.length > 1 ? 'lieux' : 'lieu'}
        </Text>
      </View>
    </Screen>
  );
}

const s = {
  fallback: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
  },
  loadingPill: {
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
  loadingTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  actionBar: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  actionHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
  },
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.cream,
  },
  count: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  countNum: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
};
