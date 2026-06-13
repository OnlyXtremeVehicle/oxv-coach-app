/**
 * Écran Lieux & partenaires — écosystème OXV (specs v4 §08 §5.1).
 *
 * Liste les lieux PUBLIÉS autour des circuits : partenaires, hébergements,
 * restaurants. Donnée publique de lieu (pas de donnée personnelle pilote).
 * Vue liste-first (robuste partout) ; la carte native viendra en surcouche.
 *
 * Doctrine : factuel, vouvoiement, pas d'emoji. État vide explicite tant
 * qu'aucun lieu n'est publié (les tables existent mais sont vides).
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  PLACE_KIND_LABELS,
  fetchPublishedPlaces,
  groupPlacesByKind,
  type Place,
  type PlaceKind,
} from '@/services/placesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

type Filter = 'all' | PlaceKind;
const PREMIUM = '#FFB703'; // Or Doré UI (PAS l'Or Heritage --oxv-gold, réservé Heritage).

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'partner', label: PLACE_KIND_LABELS.partner },
  { id: 'lodging', label: PLACE_KIND_LABELS.lodging },
  { id: 'restaurant', label: PLACE_KIND_LABELS.restaurant },
];

export default function LieuxScreen() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;
    fetchPublishedPlaces()
      .then((p) => {
        if (!cancelled) {
          setPlaces(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (filter === 'all' ? places : places.filter((p) => p.kind === filter)),
    [places, filter]
  );
  const groups = useMemo(() => groupPlacesByKind(visible), [visible]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>ÉCOSYSTÈME</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Lieux & partenaires
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  borderColor: on ? colors.text.secondary : colors.border.subtle,
                  backgroundColor: on ? colors.background.secondary : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: on ? colors.text.primary : colors.text.secondary,
                    fontSize: fontSize.caption,
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: spacing.huge, alignItems: 'center' }}>
            <ActivityIndicator color={colors.text.secondary} />
          </View>
        ) : groups.length === 0 ? (
          <View
            style={{
              marginTop: spacing.xxl,
              padding: spacing.xxl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
            }}
          >
            <Text
              style={[
                typography.manifest,
                { color: colors.text.tertiary, textAlign: 'center', fontStyle: 'italic' },
              ]}
            >
              Aucun lieu publié pour le moment.
            </Text>
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                textAlign: 'center',
              }}
            >
              Les partenaires, hébergements et restaurants apparaîtront ici.
            </Text>
          </View>
        ) : (
          groups.map((g) => (
            <View key={g.kind} style={{ marginTop: spacing.xl }}>
              <Text
                style={[
                  typography.eyebrow,
                  { color: colors.text.tertiary, marginBottom: spacing.sm },
                ]}
              >
                {PLACE_KIND_LABELS[g.kind].toUpperCase()}
              </Text>
              <View style={{ gap: spacing.md }}>
                {g.items.map((place) => (
                  <PlaceCard key={place.id} place={place} />
                ))}
              </View>
            </View>
          ))
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const meta = [place.category, place.city, place.priceRange].filter(Boolean).join(' · ');
  const openUrl = () => {
    if (place.url) Linking.openURL(place.url).catch(() => undefined);
  };
  return (
    <Pressable
      accessibilityRole={place.url ? 'link' : 'text'}
      accessibilityLabel={place.name}
      disabled={!place.url}
      onPress={openUrl}
      style={({ pressed }) => ({
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: place.isPremium ? 1 : 0.5,
        borderColor: place.isPremium ? PREMIUM : colors.border.subtle,
        backgroundColor: colors.background.secondary,
        opacity: pressed && place.url ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.medium,
          }}
        >
          {place.name}
        </Text>
        {place.isOfficialPartner ? (
          <Text
            style={{
              color: PREMIUM,
              fontSize: 10,
              letterSpacing: 1.5,
              fontWeight: fontWeight.medium,
            }}
          >
            PARTENAIRE OXV
          </Text>
        ) : null}
      </View>
      {meta ? (
        <Text
          style={{ color: colors.text.tertiary, fontSize: fontSize.caption, marginTop: spacing.xs }}
        >
          {meta}
        </Text>
      ) : null}
    </Pressable>
  );
}
