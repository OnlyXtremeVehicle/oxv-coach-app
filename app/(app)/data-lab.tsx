/**
 * Data Lab — lecture détaillée d'une session (assemblage, PR 3 · ticket D1).
 *
 * Index de navigation PUR : regroupe les écrans d'analyse rangés sous le Bilan
 * (cf. `appMap.dataLabScreens()`), chacun ouvert avec le `sessionId` courant.
 * AUCUNE logique d'analyse propre — chaque écran cible garde ses services.
 * Doctrine : sobre, index neutre (texte crème/muted, pas d'or décoratif) ;
 * vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { dataLabScreens } from '@/lib/appMap';
import { OxvEvent } from '@/services/analyticsEvents';
import { type DataLabSessionView, getDataLabSessionView } from '@/services/dataLabService';
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
  const [view, setView] = useState<DataLabSessionView | null>(null);

  useEffect(() => {
    if (!sid) return;
    let cancelled = false;
    getDataLabSessionView(sid)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sid]);

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

        {view?.emptyReason ? (
          <View style={s.banner}>
            <Text style={s.bannerText}>{view.emptyReason}</Text>
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          {dataLabScreens().map((screen) => {
            const meta = LABELS[screen] ?? { label: screen, hint: '' };
            const available = !view || screenHasData(screen, view);
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
                {view && !available ? (
                  <Text style={s.noData}>Pas de données pour cette session</Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

/** Une couche a-t-elle de la matière pour cette session ? (annotation honnête, non bloquante). */
function screenHasData(screen: string, v: DataLabSessionView): boolean {
  switch (screen) {
    case 'carte':
      return v.frameCount > 0 || v.cornerCount > 0;
    case 'virage':
    case 'virage-comparer':
      return v.cornerCount > 0;
    case 'tours':
      return v.validLapCount > 0;
    case 'heatmap':
    case 'replay':
    case 'telemetry':
      return v.frameCount > 0;
    default:
      return true;
  }
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
  banner: {
    marginTop: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card,
  },
  bannerText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
  },
  noData: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
};
