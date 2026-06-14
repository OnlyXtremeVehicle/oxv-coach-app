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
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import {
  SHAREABLE_METRICS,
  type SharedProgression,
  fetchSharedProgression,
} from '@/services/sharesService';
import { borderRadius, colors, fontSize, spacing, typography } from '@/theme/tokens';

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>
          PROGRESSION PARTAGÉE
        </Text>

        {loading ? (
          <View style={{ paddingVertical: spacing.huge, alignItems: 'center' }}>
            <ActivityIndicator color={colors.text.secondary} />
          </View>
        ) : !share ? (
          <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
            <Text
              style={[typography.screenTitle, { textAlign: 'center', marginBottom: spacing.md }]}
            >
              Partage terminé.
            </Text>
            <Text
              style={[
                typography.manifest,
                { color: colors.text.tertiary, textAlign: 'center', paddingHorizontal: spacing.md },
              ]}
            >
              Ce lien n'est plus accessible — révoqué, expiré, ou inconnu.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>
              {SCOPE_LABELS[share.scope] ?? 'Progression'}
            </Text>
            <Text
              style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.sm }]}
            >
              {share.expiresAt
                ? `Accessible jusqu'au ${new Date(share.expiresAt).toLocaleDateString('fr-FR')}`
                : 'Sans date de fin'}
            </Text>

            <Text
              style={[
                typography.eyebrow,
                { color: colors.text.tertiary, marginTop: spacing.xxl, marginBottom: spacing.md },
              ]}
            >
              CE QUI EST PARTAGÉ
            </Text>
            {share.includedMetrics.length === 0 ? (
              <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                Aucune métrique n'a été incluse dans ce partage.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {share.includedMetrics.map((key) => (
                  <View
                    key={key}
                    style={{
                      padding: spacing.lg,
                      borderRadius: borderRadius.lg,
                      borderWidth: 0.5,
                      borderColor: colors.border.subtle,
                      backgroundColor: colors.background.secondary,
                    }}
                  >
                    <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                      {METRIC_LABEL[key] ?? key}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text
              style={[
                typography.caption,
                {
                  color: colors.text.tertiary,
                  fontStyle: 'italic',
                  marginTop: spacing.xxl,
                  paddingHorizontal: spacing.md,
                  textAlign: 'center',
                },
              ]}
            >
              Vous ne voyez que ce que ce pilote a choisi d'exposer.
            </Text>
          </>
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
