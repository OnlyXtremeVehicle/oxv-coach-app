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

import {
  type SocialPing,
  PING_KIND_LABELS,
  groupPingsByKind,
  listSocialPings,
} from '@/services/socialPingsService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateLong } from '@/utils/format';

export default function SocialScreen() {
  const [pings, setPings] = useState<SocialPing[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) setLoading(false);
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
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  const groups = groupPingsByKind(pings);

  return (
    <Screen>
      <AppBar title="SOCIAL" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>Le territoire OXV.</Text>

        {pings.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(app)/social-carte' as never)}
            style={({ pressed }) => [s.cta, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={s.ctaTxt}>Voir sur la carte</Text>
          </Pressable>
        ) : null}

        {pings.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>Rien à l&apos;horizon pour l&apos;instant.</Text>
            <Text style={s.emptyHint}>Les événements et lieux OXV apparaîtront ici.</Text>
          </Card>
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
              <SectionLabel>{PING_KIND_LABELS[group.kind]}</SectionLabel>
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
    <Card>
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
          <PingAction label="Direct" onPress={() => openUrl(ping.liveUrl)} primary />
        ) : null}
        {ping.eventUrl ? (
          <PingAction label="Détails" onPress={() => openUrl(ping.eventUrl)} />
        ) : null}
        {ping.contactEmail ? (
          <PingAction label="Contacter" onPress={() => openEmail(ping.contactEmail)} />
        ) : null}
      </View>
    </Card>
  );
}

function PingAction({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.sm,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.palette.edge,
        backgroundColor: primary ? theme.palette.gold : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: primary ? '#000' : theme.palette.creamMute,
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
  cta: {
    marginBottom: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.red,
    alignItems: 'center' as const,
  },
  ctaTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
    color: theme.palette.red,
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
  pingTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  pingMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
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
