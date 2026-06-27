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
 *
 * Reskin V2 : Screen + AppBar, styles via @/theme/v2. Logique et textes
 * inchangés. Poids visuel identique aux deux options (doctrine miroir).
 */

import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { type FocusCornerSelection, selectFocusCorner } from '@/services/focusCorner';
import { getCornerMarginsZones } from '@/services/segmentAnalysesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';

export default function ProchaineFoisScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();

  // Doctrine : pas de fausse donnée. On ne propose un virage à observer QUE si
  // l'analyse réelle existe ; sinon NoFocusState (état vide honnête).
  const [focus, setFocus] = useState<FocusCornerSelection | null>(null);

  // On remplit le focus depuis les vraies marges issues de l'analyse trackviz.
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
    <Screen>
      <AppBar title="LA PROCHAINE FOIS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {focus ? (
          <View style={{ marginTop: theme.spacing.xxl }}>
            <Text style={s.phrase}>{focus.phrase}</Text>

            <Text style={s.observation}>{focus.observation}</Text>

            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              {/* Poids visuel identique aux deux options : l'app ne pousse pas
                  vers un choix (doctrine miroir). */}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [s.choice, pressed && { opacity: 0.85 }]}
              >
                <Text style={s.choiceTxt}>Compris</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.back()}
                style={({ pressed }) => [s.choice, pressed && { opacity: 0.85 }]}
              >
                <Text style={s.choiceTxt}>Plus tard</Text>
              </Pressable>
            </View>

            <Text style={s.footnote}>Une chose. Pas plus.</Text>
          </View>
        ) : (
          <NoFocusState />
        )}
      </View>
    </Screen>
  );
}

function NoFocusState() {
  return (
    <View style={{ marginTop: theme.spacing.xxl * 2, alignItems: 'center' }}>
      <Text style={s.calmTitle}>Confortable partout.</Text>
      <Text style={[s.observation, { textAlign: 'center', paddingHorizontal: theme.spacing.md }]}>
        Aucune zone ne ressort. Continuez comme ça.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.back()}>
        <Text style={s.back}>Retour au bilan</Text>
      </Pressable>
    </View>
  );
}

const s = {
  phrase: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    lineHeight: theme.fontSize.h2 * 1.3,
    color: theme.palette.cream,
    marginBottom: theme.spacing.xl,
  },
  observation: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginBottom: theme.spacing.xxl,
  },
  choice: {
    flex: 1,
    height: 52,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  choiceTxt: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  footnote: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
  calmTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.dataColors.accel,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
