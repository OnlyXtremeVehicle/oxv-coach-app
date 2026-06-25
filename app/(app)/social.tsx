/**
 * Écran Social — volet social OXV (§7), vue liste (fondation §7.1). Design V2.
 *
 * Réservé aux membres validés (RLS is_validated_member). Liste les points
 * groupés par type. Un CTA « Voir sur la carte » ouvre la vue carte (§7.2).
 *
 * Doctrine : aucune mécanique de classement / gamification. Liste sobre.
 * Reskin V2 : Screen + AppBar, Card/SectionLabel, logique inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  type SocialPing,
  PING_KIND_LABELS,
  groupPingsByKind,
  listSocialPings,
} from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

export default function SocialScreen() {
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listSocialPings()
      .then((rows) => {
        if (!cancelled) {
          setPings(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="SOCIAL" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator
            color={theme.palette.creamMute}
            accessibilityLabel="Chargement du territoire OXV"
          />
        </View>
      </Screen>
    );
  }

  const groups = groupPingsByKind(pings);

  return (
    <Screen>
      <AppBar title="SOCIAL" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          Le territoire OXV.
        </Text>

        {pings.length > 0 ? (
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Button
              label="Voir sur la carte"
              variant="ghost"
              onPress={() => router.push('/(app)/social-carte' as never)}
            />
          </View>
        ) : null}

        {failed ? (
          <EmptyState
            label="Indisponible"
            message="Le territoire n'a pas pu être chargé. Réessayez quand votre connexion sera de retour."
            source="social_pings"
          />
        ) : pings.length === 0 ? (
          <EmptyState
            label="À l'horizon"
            message="Les événements et lieux OXV apparaîtront ici."
            source="social_pings"
          />
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              <View style={s.headRow}>
                <View
                  style={s.headDot}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <SectionLabel>{PING_KIND_LABELS[group.kind]}</SectionLabel>
              </View>
              {group.items.map((ping) => (
                <PingCard key={ping.id} ping={ping} />
              ))}
            </View>
          ))
        )}
      </View>
    </Screen>
  );
}

function PingCard({ ping }: { ping: SocialPing }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };
  const openEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => undefined);
  };

  return (
    <Card style={s.dataPanel}>
      <Text style={s.pingTitle}>{ping.title}</Text>
      {ping.startsAt ? <Text style={s.pingMeta}>{formatDateLong(ping.startsAt)}</Text> : null}
      {ping.description ? <Text style={s.pingBody}>{ping.description}</Text> : null}
      {ping.address ? <Text style={s.pingAddr}>{ping.address}</Text> : null}

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        }}
      >
        {ping.liveUrl ? (
          <PingAction
            label="Direct"
            accessibilityLabel={`${ping.title} — suivre en direct`}
            onPress={() => openUrl(ping.liveUrl)}
            primary
          />
        ) : null}
        {ping.eventUrl ? (
          <PingAction
            label="Détails"
            accessibilityLabel={`${ping.title} — voir les détails`}
            onPress={() => openUrl(ping.eventUrl)}
          />
        ) : null}
        {ping.contactEmail ? (
          <PingAction
            label="Contacter"
            accessibilityLabel={`${ping.title} — écrire un message`}
            onPress={() => openEmail(ping.contactEmail)}
          />
        ) : null}
      </View>
    </Card>
  );
}

function PingAction({
  label,
  accessibilityLabel,
  onPress,
  primary,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.palette.edge,
        backgroundColor: primary ? theme.palette.gold : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.bodyMedium,
          fontSize: theme.fontSize.small,
          letterSpacing: 0.3,
          color: primary ? '#000' : theme.palette.cream,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
  dataPanel: {
    backgroundColor: theme.palette.card2,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  headDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.gold,
    shadowColor: theme.palette.gold,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  pingTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pingMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xs,
  },
  pingBody: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  pingAddr: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
};
