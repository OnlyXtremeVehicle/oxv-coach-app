/**
 * Écran Lieux & partenaires — écosystème OXV (specs v4 §08 §5.1). Design V2.
 *
 * Liste les lieux PUBLIÉS autour des circuits. Vue liste-first.
 * Doctrine : factuel, vouvoiement, pas d'emoji. État vide explicite.
 * Reskin V2 : Screen + AppBar, pills de filtre, Card/SectionLabel/Chip.
 * Logique de données inchangée.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  PLACE_KIND_LABELS,
  fetchPublishedPlaces,
  groupPlacesByKind,
  type Place,
  type PlaceKind,
} from '@/services/placesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StatusLine, cockpitHalo } from '@/ui/Cockpit';

type Filter = 'all' | PlaceKind;

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
    <Screen>
      <AppBar title="LIEUX" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <StatusLine label="Hébergements · tables · partenaires" />
        <Text style={s.title}>Lieux & partenaires</Text>

        <View style={s.filters}>
          {FILTERS.map((f) => {
            const on = f.id === filter;
            return (
              <Pressable
                key={f.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(f.id)}
                style={[s.pill, on && s.pillOn]}
                hitSlop={theme.hitSlop}
              >
                <Text style={[s.pillT, on && s.pillTOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} />
          </View>
        ) : groups.length === 0 ? (
          <Card
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.xxl,
              marginTop: theme.spacing.lg,
            }}
          >
            <Text style={s.emptyTitle}>Aucun lieu publié pour le moment.</Text>
            <Text style={s.emptyHint}>
              Les partenaires, hébergements et restaurants apparaîtront ici.
            </Text>
          </Card>
        ) : (
          groups.map((g) => (
            <View key={g.kind} style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              <SectionLabel>{PLACE_KIND_LABELS[g.kind]}</SectionLabel>
              {g.items.map((place) => (
                <PlaceCard key={place.id} place={place} />
              ))}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

function PlaceCard({ place }: { place: Place }) {
  const meta = [place.category, place.city, place.priceRange].filter(Boolean).join(' · ');
  const openUrl = place.url
    ? () => {
        if (place.url) Linking.openURL(place.url).catch(() => undefined);
      }
    : undefined;
  return (
    <Card
      onPress={openUrl}
      accessibilityLabel={place.name}
      style={place.isPremium ? { borderColor: theme.palette.gold, ...cockpitHalo } : cockpitHalo}
    >
      <View style={s.row}>
        <Text style={s.name}>{place.name}</Text>
        {place.isOfficialPartner ? (
          <Chip label="Partenaire OXV" dotColor={theme.palette.gold} />
        ) : null}
        {place.url ? (
          <Text style={s.chevron} accessibilityElementsHidden>
            ›
          </Text>
        ) : null}
      </View>
      {meta ? <Text style={s.meta}>{meta}</Text> : null}
    </Card>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  filters: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm },
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
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
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
  },
};
