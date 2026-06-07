/**
 * Vue Coach — mes repères de référence par virage (§10.3c-A).
 *
 * Liste les virages du circuit ; pour chacun, indique si un repère est posé.
 * Tap → éditeur du repère (point de freinage, vitesse repère, trajectoire).
 *
 * Ces repères sont superposés à la donnée de vos élèves, étiquetés « Repère
 * de votre coach ». Descriptif, attribué — jamais une consigne.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type CoachCornerReference, referenceHasContent } from '@/services/coachReferenceLogic';
import { listMyCornerReferences } from '@/services/coachReferenceService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function CoachReperesScreen() {
  const [byIndex, setByIndex] = useState<Map<number, CoachCornerReference>>(new Map());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      listMyCornerReferences().then((rows) => {
        if (!cancelled) {
          setByIndex(new Map(rows.map((r) => [r.cornerIndex, r])));
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>MES REPÈRES</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md }]}>Vos repères.</Text>
        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
        >
          Vos repères par virage, superposés à la donnée de vos élèves. Des repères, jamais des
          consignes.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.text.secondary} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {BELTOISE_CORNERS.map((corner) => {
              const ref = byIndex.get(corner.index);
              const filled = ref ? referenceHasContent(ref) : false;
              return (
                <Pressable
                  key={corner.index}
                  accessibilityRole="button"
                  accessibilityLabel={`Repère du ${corner.name}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(coach)/repere/[index]',
                      params: { index: String(corner.index) },
                    } as never)
                  }
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.lg,
                    borderRadius: borderRadius.md,
                    borderWidth: 0.5,
                    borderColor: filled ? colors.accent.coach : colors.border.subtle,
                    backgroundColor: colors.background.secondary,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: fontSize.body,
                        fontWeight: fontWeight.medium,
                      }}
                    >
                      {String(corner.index).padStart(2, '0')} · {corner.name}
                    </Text>
                    {filled && ref ? (
                      <Text
                        style={[
                          typography.caption,
                          { color: colors.text.tertiary, marginTop: spacing.xs },
                        ]}
                      >
                        {summarizeReference(ref)}
                      </Text>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      color: filled ? colors.accent.coach : colors.text.tertiary,
                      fontSize: fontSize.caption,
                      fontWeight: fontWeight.medium,
                    }}
                  >
                    {filled ? 'Modifier' : 'Ajouter'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
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

function summarizeReference(ref: CoachCornerReference): string {
  const parts: string[] = [];
  if (ref.brakingPointM != null) parts.push(`freinage ${Math.round(ref.brakingPointM)} m`);
  if (ref.targetSpeedKmh != null) parts.push(`${Math.round(ref.targetSpeedKmh)} km/h`);
  if (ref.trajectoryNote) parts.push(ref.trajectoryNote);
  return parts.join(' · ');
}
