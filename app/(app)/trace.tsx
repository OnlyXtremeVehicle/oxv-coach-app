/**
 * Écran « Trace du jour » (V9 §6, livrable signature OXV Trace).
 *
 * Entrée NARRATIVE post-séance, en amont de l'analyse détaillée. Une lecture
 * posée : ce que la séance a laissé. Un chiffre dominant (le meilleur tour), une
 * confiance de lecture honnête, le moment que la trace retient, puis les portes
 * vers le Bilan, le Data Lab et le ressenti.
 *
 * Doctrine : miroir, jamais coach. Aucun rouge sur cet écran de donnée (le rouge
 * reste la marque / l'acte). Le ressenti appartient au pilote : on invite, on ne
 * rédige pas. Un seul chiffre dominant. Vouvoiement, pas d'emoji.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection } from '@/components/motion';
import { OXVPromiseBlock } from '@/components/OXVPromiseBlock';
import * as haptics from '@/lib/haptics';
import { loadTraceOfDay, type TraceOfDayResult } from '@/services/traceNarrativeService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort, formatLapTime } from '@/utils/format';

export default function TraceScreen() {
  const profile = useAuthStore((s) => s.profile);
  const params = useLocalSearchParams<{ sessionId?: string }>();

  const [data, setData] = useState<TraceOfDayResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await loadTraceOfDay(profile.id, params.sessionId);
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, params.sessionId]);

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  if (!data) {
    return <TraceEmpty />;
  }

  const { session, trace } = data;
  const sessionId = session.id;
  const dateLabel = session.started_at ? formatDateShort(session.started_at) : null;
  const meta = [trace.circuitName, dateLabel].filter(Boolean).join(' · ');

  return (
    <Screen>
      <AppBar title="TRACE" onBack={() => router.back()} trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <SectionLabel>Trace du jour</SectionLabel>

        <Text style={s.title} accessibilityRole="header">
          Votre trace du jour.
        </Text>
        {meta ? <Text style={s.meta}>{meta}</Text> : null}

        {/* Confiance de lecture — honnête, neutre (ni or ni rouge). Le détail des
            raisons reste dans le Bilan ; ici, le niveau qualitatif suffit. */}
        {trace.qualityLabel ? (
          <View style={s.qualityRow}>
            <Text style={s.qualityEyebrow}>QUALITÉ DE LECTURE</Text>
            <Text style={s.qualityValue}>{trace.qualityLabel}</Text>
          </View>
        ) : null}

        {/* Chiffre dominant — le meilleur tour. Mono, large, couleur = donnée. */}
        <FadeInSection delay={60} style={{ alignItems: 'center', marginTop: theme.spacing.xxl }}>
          <Text style={s.heroEyebrow}>VOTRE MEILLEUR TOUR</Text>
          <Text style={s.heroNumber}>
            {trace.bestSeconds != null ? formatLapTime(trace.bestSeconds) : '—'}
          </Text>
          <Text style={s.heroCaption}>
            {trace.lapCount > 0 ? `${trace.lapCount} tours` : 'Séance enregistrée'}
          </Text>
        </FadeInSection>

        {/* Narration sobre — situe la séance (soi contre soi), jamais un verdict. */}
        <FadeInSection delay={120} style={{ marginTop: theme.spacing.xxl }}>
          <Text style={s.narrative}>{trace.narrative}</Text>
        </FadeInSection>

        {/* Le moment que la trace retient — un fait saillant, pas une consigne. */}
        {trace.highlight ? (
          <FadeInSection delay={180} style={{ marginTop: theme.spacing.xxl }}>
            <Text style={s.sectionEyebrow}>LE MOMENT DE LA SÉANCE</Text>
            <Card>
              <Text style={s.kmTitle}>{trace.highlight.title}</Text>
              <Text style={s.kmFact}>{trace.highlight.fact}</Text>
            </Card>
          </FadeInSection>
        ) : null}

        {/* Les portes — Bilan (analyse), Data Lab (lecture détaillée), ressenti. */}
        <FadeInSection delay={240} style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.md }}>
          <TraceCta
            label="Ouvrir le bilan"
            emphasis
            onPress={() => {
              haptics.tap();
              router.push(`/(app)/bilan?sessionId=${sessionId}` as never);
            }}
          />
          <TraceCta
            label="Lecture détaillée — Data Lab"
            onPress={() => {
              haptics.tap();
              router.push(`/(app)/data-lab?sessionId=${sessionId}` as never);
            }}
          />
          <TraceCta
            label={trace.ressentiPrompt}
            onPress={() => {
              haptics.tap();
              router.push(`/(app)/carnet?sessionId=${sessionId}` as never);
            }}
          />
        </FadeInSection>

        {/* La promesse — rappelée à l'endroit même où l'on lit sa donnée. */}
        <FadeInSection delay={300} style={{ marginTop: theme.spacing.xxl * 1.5 }}>
          <OXVPromiseBlock />
        </FadeInSection>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            hitSlop={theme.hitSlop}
            onPress={() => router.replace('/(app)')}
            style={s.backHit}
          >
            <Text style={s.back}>Plus tard</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

function TraceCta({
  label,
  emphasis,
  onPress,
}: {
  label: string;
  emphasis?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        s.cta,
        emphasis ? s.ctaEmphasis : null,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[s.ctaLabel, emphasis ? s.ctaLabelEmphasis : null]}>{label}</Text>
    </Pressable>
  );
}

function TraceEmpty() {
  return (
    <Screen scroll={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[s.qualityEyebrow, { marginBottom: theme.spacing.lg }]}>TRACE</Text>
        <Text style={[s.emptyTitle, { marginBottom: theme.spacing.xl }]}>Aucune trace encore.</Text>
        <Text style={s.emptyManifest}>Votre première séance écrira la première ligne.</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={theme.hitSlop}
          onPress={() => router.replace('/(app)')}
          style={[s.backHit, { marginTop: theme.spacing.xxl * 1.5 }]}
        >
          <Text style={s.back}>Retour à l'accueil</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.display,
    letterSpacing: 0.5,
    lineHeight: theme.fontSize.display * 1.15,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  qualityRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  qualityEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  qualityValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  heroEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  heroNumber: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.hud,
    letterSpacing: -1,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  heroCaption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  narrative: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
  },
  sectionEyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginBottom: theme.spacing.md,
  },
  kmTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  kmFact: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  cta: {
    minHeight: 52,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.palette.line,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  ctaEmphasis: {
    borderColor: theme.palette.edge,
    backgroundColor: theme.palette.card2,
  },
  ctaLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  ctaLabelEmphasis: {
    color: theme.palette.cream,
  },
  emptyTitle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  emptyManifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    paddingHorizontal: theme.spacing.md,
  },
  back: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
  backHit: {
    minHeight: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
};
