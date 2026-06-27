/**
 * Écran « Progression d'un ami » (specs v4 §07 §4.3).
 *
 * Lit un partage par TOKEN via la RPC sécurisée get_shared_progression. On ne
 * montre QUE ce que l'émetteur a choisi d'exposer (liste blanche included_metrics)
 * et son périmètre — ni plus, ni moins. Token inconnu / révoqué / expiré →
 * « partage terminé », plus aucune donnée. La RPC trace la vue côté émetteur.
 *
 * Doctrine : factuel, vouvoiement, pas d'emoji. Aucune donnée d'autrui au-delà
 * de la liste blanche n'existe pour le spectateur.
 * Reskin V2 : Screen + AppBar (écran partagé public, lecture seule, sans
 * flèche de retour). La RPC et la logique d'accès sont inchangées.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  SHAREABLE_METRICS,
  type SharedProgression,
  fetchSharedProgression,
} from '@/services/sharesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const SCOPE_LABELS: Record<string, string> = {
  last_session: 'Dernière session',
  last_5_sessions: '5 dernières sessions',
  progression_only: 'Progression seule',
  full_history: 'Historique complet',
};
const METRIC_LABEL: Record<string, string> = Object.fromEntries(
  SHAREABLE_METRICS.map((m) => [m.key, m.label])
);

export default function SharedProgressionScreen() {
  const params = useLocalSearchParams<{ token: string }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [share, setShare] = useState<SharedProgression | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchSharedProgression(token)
      .then((s) => {
        if (!cancelled) {
          setShare(s);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="PROGRESSION PARTAGÉE" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator
            color={theme.palette.creamMute}
            accessibilityLabel="Chargement du partage"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="PROGRESSION PARTAGÉE" />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {!share ? (
          <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
            <Text
              accessibilityRole="header"
              style={[s.screenTitle, { textAlign: 'center', marginBottom: theme.spacing.md }]}
            >
              Partage terminé.
            </Text>
            <Text style={s.manifest}>
              Ce lien n&apos;est plus accessible — révoqué, expiré, ou inconnu.
            </Text>
          </View>
        ) : (
          <>
            <Text style={s.screenTitle} accessibilityRole="header">
              {SCOPE_LABELS[share.scope] ?? 'Progression'}
            </Text>
            <Text style={s.subtitle}>
              {share.expiresAt
                ? `Accessible jusqu'au ${new Date(share.expiresAt).toLocaleDateString('fr-FR')}`
                : 'Sans date de fin'}
            </Text>

            <View style={{ marginTop: theme.spacing.xxl }}>
              <SectionLabel>Ce qui est partagé</SectionLabel>
            </View>
            {share.includedMetrics.length === 0 ? (
              <Text style={[s.subtitle, { marginTop: theme.spacing.md }]}>
                Aucune métrique n&apos;a été incluse dans ce partage.
              </Text>
            ) : (
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                {share.includedMetrics.map((key) => (
                  <Card key={key}>
                    <Text style={s.metric}>{METRIC_LABEL[key] ?? key}</Text>
                  </Card>
                ))}
              </View>
            )}

            <Text style={s.note}>Vous ne voyez que ce que ce pilote a choisi d&apos;exposer.</Text>
          </>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={theme.hitSlop}
            onPress={() => router.back()}
            style={({ pressed }) => [s.backHit, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

const s = {
  screenTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.2,
    marginTop: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
  },
  metric: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
    textAlign: 'center' as const,
  },
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
  },
  backLink: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
};
