/**
 * Data Lab — lecture détaillée d'une session (assemblage, PR 3 · ticket D1).
 *
 * Index de navigation PUR : regroupe les écrans d'analyse rangés sous le Bilan
 * (cf. `appMap.dataLabScreens()`), chacun ouvert avec le `sessionId` courant.
 * AUCUNE logique d'analyse propre — chaque écran cible garde ses services.
 * Doctrine : sobre, index neutre (texte crème/muted, pas d'or décoratif) ;
 * vouvoiement, pas d'emoji.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { dataLabScreens } from '@/lib/appMap';
import { OxvEvent } from '@/services/analyticsEvents';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Libellés humains des écrans Data Lab (sobres, factuels, jamais prescriptifs).
const LABELS: Record<string, { label: string; hint: string }> = {
  carte: { label: 'Carte du circuit', hint: 'Votre tracé sur le circuit' },
  virage: { label: 'Détails par virage', hint: 'Entrée, apex, sortie' },
  'virage-comparer': { label: 'Comparer un virage', hint: 'Deux tours côte à côte' },
  tours: { label: 'Tour par tour', hint: 'Vos tours détectés' },
  heatmap: { label: 'Carte de chaleur', hint: 'Vitesse, charge, régularité' },
  replay: { label: 'Rejouer un tour', hint: 'La session en mouvement' },
  telemetry: { label: 'Télémétrie', hint: 'Vitesse, distance, G — données brutes' },
  insights: { label: 'Lectures approfondies', hint: 'Les analyses qualitatives' },
};

export default function DataLabScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sid = params.sessionId ?? '';

  return (
    <Screen>
      <AppBar title="DATA LAB" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>LECTURE DÉTAILLÉE</Text>
        <Text style={s.title} accessibilityRole="header">
          Votre session, couche par couche.
        </Text>
        <Text style={s.intro}>
          Chaque lecture s'ouvre sur la session courante. Prenez ce qui vous parle, laissez le
          reste.
        </Text>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          {dataLabScreens().map((screen) => {
            const meta = LABELS[screen] ?? { label: screen, hint: '' };
            return (
              <Card
                key={screen}
                onPress={() => {
                  OxvEvent.datalabCoucheOuverte(screen);
                  router.push(
                    (sid ? `/(app)/${screen}?sessionId=${sid}` : `/(app)/${screen}`) as never
                  );
                }}
                accessibilityLabel={`${meta.label}. ${meta.hint}`}
              >
                <Text style={s.cardTitle}>{meta.label}</Text>
                {meta.hint ? <Text style={s.cardHint}>{meta.hint}</Text> : null}
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  cardTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  cardHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
};
