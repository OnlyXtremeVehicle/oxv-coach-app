/**
 * Écran Social — volet social OXV (§7), vue liste (fondation §7.1).
 *
 * Réservé aux membres validés (RLS is_validated_member). Liste les points
 * groupés par type : événements OXV / partenaires, soirées, partenaires,
 * tournages, expériences chez l'hôte. Chaque point porte ses infos
 * dédiées (adresse, e-mail, lien direct, détail événement).
 *
 * La carte interactive (react-native-maps) arrive dans la PR §7.2 — un
 * CTA « Voir sur la carte » sera branché ici.
 *
 * Doctrine : aucune mécanique de classement / gamification. Liste sobre.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  type SocialPing,
  PING_KIND_LABELS,
  groupPingsByKind,
  listSocialPings,
} from '@/services/socialPingsService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateLong } from '@/utils/format';

export default function SocialScreen() {
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

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.text.secondary} />
      </SafeAreaView>
    );
  }

  const groups = groupPingsByKind(pings);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>OXV SOCIAL</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xl }]}>
          Le territoire OXV.
        </Text>

        {pings.length === 0 ? (
          <View
            style={{
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
              Rien à l&apos;horizon pour l&apos;instant.
            </Text>
            <Text
              style={{
                marginTop: spacing.md,
                color: colors.text.tertiary,
                fontSize: fontSize.caption,
                textAlign: 'center',
              }}
            >
              Les événements et lieux OXV apparaîtront ici.
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.kind} style={{ marginBottom: spacing.xxl }}>
              <Text
                style={[
                  typography.eyebrow,
                  { color: colors.text.tertiary, marginBottom: spacing.md },
                ]}
              >
                {PING_KIND_LABELS[group.kind].toUpperCase()}
              </Text>
              <View style={{ gap: spacing.md }}>
                {group.items.map((ping) => (
                  <PingCard key={ping.id} ping={ping} />
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

function PingCard({ ping }: { ping: SocialPing }) {
  const openUrl = (url: string | null) => {
    if (url) Linking.openURL(url).catch(() => undefined);
  };
  const openEmail = (email: string | null) => {
    if (email) Linking.openURL(`mailto:${email}`).catch(() => undefined);
  };

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
        }}
      >
        {ping.title}
      </Text>

      {ping.startsAt ? (
        <Text
          style={{ color: colors.text.tertiary, fontSize: fontSize.caption, marginTop: spacing.xs }}
        >
          {formatDateLong(ping.startsAt)}
        </Text>
      ) : null}

      {ping.description ? (
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: fontSize.caption,
            marginTop: spacing.sm,
            lineHeight: fontSize.caption * 1.5,
          }}
        >
          {ping.description}
        </Text>
      ) : null}

      {ping.address ? (
        <Text
          style={{ color: colors.text.tertiary, fontSize: fontSize.caption, marginTop: spacing.sm }}
        >
          {ping.address}
        </Text>
      ) : null}

      {/* Actions dédiées selon les infos disponibles */}
      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}
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
    </View>
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
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: primary ? 0 : 0.5,
        borderColor: colors.border.medium,
        backgroundColor: primary ? colors.accent.red : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: primary ? colors.background.primary : colors.text.secondary,
          fontSize: fontSize.caption,
          fontWeight: primary ? fontWeight.medium : fontWeight.regular,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
