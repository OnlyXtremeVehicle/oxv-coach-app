/**
 * Vue Coach — mes repères de référence par virage (§10.3c-A).
 *
 * Liste les virages du circuit ; pour chacun, indique si un repère est posé.
 * Tap → éditeur du repère (point de freinage, vitesse repère, trajectoire).
 *
 * Ces repères sont superposés à la donnée de vos élèves, étiquetés « Repère
 * de votre coach ». Descriptif, attribué — jamais une consigne.
 *
 * Reskin V2 : Screen + AppBar, Card, typo/couleurs @/theme/v2. Logique
 * (chargement des repères, navigation vers l'éditeur) inchangée.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { BELTOISE_CORNERS } from '@/lib/circuitTopology';
import { type CoachCornerReference, referenceHasContent } from '@/services/coachReferenceLogic';
import { listMyCornerReferences } from '@/services/coachReferenceService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

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
    <Screen>
      <AppBar title="REPÈRES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={[s.eyebrow, { color: theme.palette.coach }]}>MES REPÈRES</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos repères.
        </Text>
        <Text style={s.manifest}>
          Vos repères par virage, superposés à la donnée de vos élèves. Des repères, jamais des
          consignes.
        </Text>

        {loading ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}>
            {BELTOISE_CORNERS.map((corner) => {
              const ref = byIndex.get(corner.index);
              const filled = ref ? referenceHasContent(ref) : false;
              return (
                <Pressable
                  key={corner.index}
                  accessibilityRole="button"
                  accessibilityLabel={`${corner.name}, repère ${filled ? 'à modifier' : 'à ajouter'}`}
                  onPress={() =>
                    router.push({
                      pathname: '/(coach)/repere/[index]',
                      params: { index: String(corner.index) },
                    } as never)
                  }
                  style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
                >
                  <Card
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderColor: filled ? theme.palette.coach : theme.palette.line,
                    }}
                  >
                    <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                      <Text style={s.cornerName}>
                        <Text style={s.cornerIndex}>{String(corner.index).padStart(2, '0')}</Text>
                        {'  '}
                        {corner.name}
                      </Text>
                      {filled && ref ? (
                        <Text style={s.cornerSummary}>{summarizeReference(ref)}</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        s.action,
                        { color: filled ? theme.palette.coach : theme.palette.creamMute },
                      ]}
                    >
                      {filled ? 'Modifier' : 'Ajouter'}
                    </Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => router.back()}
            hitSlop={theme.hitSlop}
          >
            <Text style={s.backLink}>Retour</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function summarizeReference(ref: CoachCornerReference): string {
  const parts: string[] = [];
  if (ref.brakingPointM != null) parts.push(`freinage ${Math.round(ref.brakingPointM)} m`);
  if (ref.targetSpeedKmh != null) parts.push(`${Math.round(ref.targetSpeedKmh)} km/h`);
  if (ref.trajectoryNote) parts.push(ref.trajectoryNote);
  return parts.join(' · ');
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.coach,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.md,
  },
  cornerName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  // Numéro de virage = registre référence (heritageGold), en mono (chiffre).
  cornerIndex: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.body,
    color: theme.palette.heritageGold,
  },
  cornerSummary: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  // Action = libellé (mot), donc pas en mono. Affordance sobre et trackée.
  action: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
