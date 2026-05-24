/**
 * Écran #16 — La prochaine fois.
 *
 * UNE seule zone à creuser. Pas plus. Formulation interrogative ou
 * observationnelle, jamais directive. C'est l'écran le plus exigeant
 * doctrinalement : un seul mot mal choisi (freinez, accélérez) le
 * dénature complètement.
 *
 * V1 : on utilise `mockCornerMargins` + heuristique `selectFocusCorner`
 * pour identifier le virage à creuser. Sem 8+ : vraie data depuis
 * `margin_breakdown` par virage.
 *
 * Pas de persistance "Compris" en V1 — le bouton ferme l'écran et
 * ramène au bilan. Une colonne `acknowledged_at` viendra en V1.1
 * si vous voulez tracker le taux de lecture.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { mockCornerMargins } from '@/lib/circuitTopology';
import { type FocusCornerSelection, selectFocusCorner } from '@/services/focusCorner';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function ProchaineFoisScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = params.sessionId ?? 'demo';

  const [focus, setFocus] = useState<FocusCornerSelection | null>(() =>
    selectFocusCorner(mockCornerMargins(sessionId))
  );

  // Si on a un vrai sessionId, on essaie de remplacer la mock par les
  // vraies marges issues de l'analyse trackviz.
  useEffect(() => {
    if (!params.sessionId) return;
    let cancelled = false;
    getCornerMarginsZones(params.sessionId).then((res) => {
      if (cancelled || !res) return;
      setFocus(selectFocusCorner(res.zones, res.numeric));
    });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>LA PROCHAINE FOIS</Text>

        {focus ? (
          <View style={{ marginTop: spacing.xxxl }}>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.headline,
                fontWeight: fontWeight.light,
                lineHeight: fontSize.headline * 1.2,
                marginBottom: spacing.xl,
              }}
            >
              {focus.phrase}
            </Text>

            <Text
              style={[
                typography.manifest,
                {
                  marginBottom: spacing.giant,
                },
              ]}
            >
              {focus.observation}
            </Text>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 52,
                  borderRadius: borderRadius.lg,
                  backgroundColor: colors.accent.red,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  Compris
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 52,
                  borderRadius: borderRadius.lg,
                  borderWidth: 1,
                  borderColor: colors.border.medium,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.regular,
                  }}
                >
                  Plus tard
                </Text>
              </Pressable>
            </View>

            <Text
              style={[
                typography.caption,
                {
                  fontStyle: 'italic',
                  color: colors.text.tertiary,
                  textAlign: 'center',
                  marginTop: spacing.xxxl,
                },
              ]}
            >
              Une chose. Pas plus.
            </Text>
          </View>
        ) : (
          <NoFocusState />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoFocusState() {
  return (
    <View
      style={{
        marginTop: spacing.giant,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: colors.margin.green,
          fontSize: fontSize.headline,
          fontWeight: fontWeight.light,
          textAlign: 'center',
          marginBottom: spacing.xl,
        }}
      >
        Confortable partout.
      </Text>
      <Text
        style={[
          typography.manifest,
          { textAlign: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.giant },
        ]}
      >
        Aucune zone ne ressort. Continuez comme ça.
      </Text>
      <Pressable onPress={() => router.back()}>
        <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
          Retour au bilan
        </Text>
      </Pressable>
    </View>
  );
}
