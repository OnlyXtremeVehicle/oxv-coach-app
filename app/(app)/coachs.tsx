/**
 * Écran #— Coachs : découverte de la place de marché coaching (Phase 1).
 *
 * Liste les coachs PUBLIÉS (`is_published = true`). Carte sobre : photo ou
 * initiales, headline, circuits, spécialités, tarif indicatif. Tap → fiche.
 *
 * Doctrine : premium, « Ferrari minimaliste », vouvoiement, aucun emoji. PAS de
 * classement, PAS de note, PAS de mise en avant payante. Tri neutre
 * (alphabétique, fait dans le service). Accent coach = `palette.coach` (neutre),
 * jamais le rouge marque ni l'or donnée pour décorer. État vide honnête.
 *
 * Réutilise le kit (Screen, AppBar, Card) et le service coachMarketplaceService.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { router } from 'expo-router';

import { type CoachListing, listPublishedCoaches } from '@/services/coachMarketplaceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

export default function CoachsScreen() {
  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listPublishedCoaches()
      .then((list) => {
        if (!cancelled) {
          setCoaches(list);
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

  return (
    <Screen>
      <AppBar title="COACHS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ACCOMPAGNEMENT</Text>
        <Text style={s.title}>Un regard sur votre pilotage.</Text>
        <Text style={s.intro}>
          Des coachs OXV, leurs circuits, leurs spécialités. Le règlement et la séance se règlent de
          gré à gré, hors application.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl * 2, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} />
          </View>
        ) : coaches.length === 0 ? (
          <Card
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.xxl,
              marginTop: theme.spacing.lg,
            }}
          >
            <Text style={s.emptyTitle}>Aucun coach publié pour le moment.</Text>
            <Text style={s.emptyHint}>
              Les coachs apparaîtront ici dès qu&apos;ils ouvriront leur fiche.
            </Text>
          </Card>
        ) : (
          <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.coachId} coach={coach} />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

function initialsOf(headline: string | null): string {
  const base = (headline ?? '').trim();
  if (!base) return 'OXV';
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || 'OXV';
}

function CoachCard({ coach }: { coach: CoachListing }) {
  const tags = [...coach.circuits, ...coach.specialties].slice(0, 4);
  const tariff = coach.seasonPriceEur !== null ? `${Math.round(coach.seasonPriceEur)} €` : null;

  return (
    <Card
      onPress={() =>
        router.push({ pathname: '/(app)/coach/[id]', params: { id: coach.coachId } } as never)
      }
      accessibilityLabel={`Fiche du coach ${coach.headline ?? ''}`.trim()}
    >
      <View style={s.cardRow}>
        {coach.photoUrl ? (
          <Image
            source={{ uri: coach.photoUrl }}
            style={s.avatar}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[s.avatar, s.avatarFallback]}>
            <Text style={s.avatarInitials}>{initialsOf(coach.headline)}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>
            {coach.headline ?? 'Coach OXV'}
          </Text>
          {tags.length > 0 ? (
            <Text style={s.tags} numberOfLines={2}>
              {tags.join(' · ')}
            </Text>
          ) : null}
        </View>

        <Text style={s.chevron}>›</Text>
      </View>

      {tariff ? (
        <View style={s.tariffRow}>
          <Text style={s.tariffLabel}>Tarif indicatif</Text>
          <Text style={s.tariffValue}>{tariff}</Text>
        </View>
      ) : null}
    </Card>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  cardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.card2,
  },
  avatarFallback: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
  },
  avatarInitials: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  tags: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: 14,
  },
  chevron: { color: theme.palette.creamMute, fontSize: 18 },
  tariffRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  tariffLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  tariffValue: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.value,
    color: theme.palette.cream,
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
