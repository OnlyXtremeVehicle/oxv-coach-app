/**
 * Écran « Trace narrative » — reskin fidèle à la maquette refonte-v2 §7bis
 * (`#5a`, 14-trace-narrative.png) : UN SEUL FAIT dominant, écran quasi vide.
 *
 * Grand silence en haut ; le fait posé BAS, aligné à gauche. La phrase vient du
 * service réel (traceNarrativeService) ; le mot-clé « meilleur temps » et le
 * chrono sont en or (or = chrono/record, seule licence du canon couleur).
 * Zéro donnée secondaire : les blocs qualité de lecture / intention / ressenti /
 * moment de la séance / promesse / « Plus tard » de l'ancien écran sont DROP
 * (maquette : « zéro donnée secondaire ») — ils vivent déjà dans le Bilan et le
 * Carnet. Trois portes : Bilan (pleine, crème), Signature et Data Lab (bordées).
 *
 * Doctrine : miroir, jamais coach. Descriptif, jamais prescriptif. Vouvoiement.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { FadeInSection } from '@/components/motion';
import * as haptics from '@/lib/haptics';
import type { TraceOfDay } from '@/services/traceNarrativeLogic';
import { loadTraceOfDay, type TraceOfDayResult } from '@/services/traceNarrativeService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Screen } from '@/ui/Screen';
import { formatDateTime, formatLapTime } from '@/utils/format';

/**
 * N° du tour de référence, dérivé du moment-clé « reference » (fait généré par
 * keyMomentsLogic : « Tour 7 — 1:24.318. »). TraceOfDay n'expose pas (encore)
 * ce n° structurellement ; si le format ne correspond pas, la phrase se passe
 * simplement du n° de tour — jamais de valeur inventée.
 */
function bestLapNumberOf(trace: TraceOfDay): number | null {
  if (trace.highlight?.key !== 'reference') return null;
  const m = /^Tour (\d+)\b/.exec(trace.highlight.fact);
  const n = m ? Number(m[1]) : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Ordinal masculin sobre : 1 → « 1ᵉʳ », n → « nᵉ ». */
function ordinalTour(n: number): string {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

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

  // Le fait. « Meilleur temps » n'est affirmé qu'avec de la matière (≥ 2 tours
  // valides) — sur un tour unique, le superlatif serait creux.
  const hasBest = trace.bestSeconds != null;
  const claimBest = hasBest && trace.lapCount >= 2;
  const lapNo = claimBest ? bestLapNumberOf(trace) : null;
  const chronoLabel = trace.bestSeconds != null ? formatLapTime(trace.bestSeconds) : '—';
  const toursLabel =
    trace.lapCount > 0 ? `sur ${trace.lapCount} ${trace.lapCount > 1 ? 'tours' : 'tour'}` : null;

  return (
    <Screen scroll={false}>
      <AppBar
        title="Trace"
        subtitle={trace.circuitName ?? undefined}
        onBack={() => router.back()}
        trailing={
          session.started_at ? (
            <Text style={s.barMeta} numberOfLines={2}>
              {formatDateTime(session.started_at)}
            </Text>
          ) : undefined
        }
      />

      <View style={s.body}>
        {/* Grand vide supérieur — le silence fait partie de l'écran. */}
        <View style={{ flex: 1.2 }} />

        <FadeInSection delay={40}>
          <Text style={s.eyebrow}>Votre séance, en un fait</Text>

          <Text style={s.phrase} accessibilityRole="header">
            {claimBest ? (
              <>
                {lapNo != null
                  ? `Au ${ordinalTour(lapNo)} tour, vous avez signé votre `
                  : 'Vous avez signé votre '}
                <Text style={s.phraseGold}>meilleur temps</Text>
                {'. '}
              </>
            ) : null}
            {trace.narrative}
          </Text>

          <View
            style={s.chronoRow}
            accessible
            accessibilityLabel={
              hasBest
                ? `Meilleur temps ${chronoLabel}${toursLabel ? `, ${toursLabel}` : ''}`
                : 'Meilleur temps indisponible'
            }
          >
            <Text style={[s.chrono, !hasBest && s.chronoAbsent]}>{chronoLabel}</Text>
            {toursLabel ? <Text style={s.chronoCaption}>{toursLabel}</Text> : null}
          </View>
        </FadeInSection>

        {/* Respiration entre le fait et les portes. */}
        <View style={{ flex: 1 }} />

        {/* Les trois portes — Bilan (pleine), puis Signature | Data Lab. */}
        <FadeInSection delay={140}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lire le bilan complet"
            onPress={() => {
              haptics.tap();
              router.push(`/(app)/bilan?sessionId=${sessionId}` as never);
            }}
            style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={s.primaryLabel}>Lire le bilan complet</Text>
            <Text style={s.primaryArrow}>→</Text>
          </Pressable>

          <View style={s.ghostRow}>
            <GhostDoor
              label="Signature"
              a11y="Ouvrir la signature de la séance"
              onPress={() => {
                haptics.tap();
                router.push(`/(app)/signature?sessionId=${sessionId}` as never);
              }}
            />
            <GhostDoor
              label="Data Lab"
              a11y="Ouvrir le Data Lab"
              onPress={() => {
                haptics.tap();
                router.push(`/(app)/data-lab?sessionId=${sessionId}` as never);
              }}
            />
          </View>
        </FadeInSection>
      </View>
    </Screen>
  );
}

/** Porte secondaire bordée (rangée du bas — maquette : Signature | Data Lab). */
function GhostDoor({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => [s.ghost, s.ghostGrow, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Text style={s.ghostLabel}>{label}</Text>
    </Pressable>
  );
}

/** Aucune séance encore : même langage — grand vide, le fait posé bas. */
function TraceEmpty() {
  return (
    <Screen scroll={false}>
      <AppBar title="Trace" onBack={() => router.back()} />
      <View style={s.body}>
        <View style={{ flex: 1.2 }} />
        <Text style={s.eyebrow}>Encore aucune trace</Text>
        <Text style={s.phrase} accessibilityRole="header">
          Votre première séance écrira la première ligne.
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour à l'accueil"
          onPress={() => router.replace('/(app)')}
          style={({ pressed }) => [s.ghost, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={s.ghostLabel}>Retour à l’accueil</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = {
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  // Méta de séance (haut-droite, maquette) — trace vers session.started_at.
  barMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    textAlign: 'right' as const,
    maxWidth: 96,
  },
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.8,
    textTransform: 'uppercase' as const,
    color: theme.palette.eyebrow,
    marginBottom: theme.spacing.lg,
  },
  phrase: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: theme.palette.cream,
  },
  // Or = chrono/record uniquement — ici le mot-clé du fait, inline.
  phraseGold: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    lineHeight: 32,
    letterSpacing: 0.2,
    color: theme.palette.gold,
  },
  chronoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    marginTop: theme.spacing.xl,
  },
  // CHIFFRE ROI : mono bold, or (chrono/record). formatLapTime = arrondi sûr.
  chrono: {
    fontFamily: theme.fonts.king,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: theme.palette.gold,
  },
  // Absence honnête : « — » neutre, pas d'or sans record réel.
  chronoAbsent: {
    color: theme.palette.creamMute,
  },
  chronoCaption: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.4,
    color: theme.palette.legend,
    marginLeft: theme.spacing.md,
    marginBottom: 6,
    maxWidth: 88,
  },
  // Porte principale : bouton plein crème (maquette), texte nuit, flèche à droite.
  primary: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.palette.cream,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 18,
  },
  primaryLabel: {
    fontFamily: theme.fonts.bodySemi,
    fontSize: theme.fontSize.body,
    color: theme.palette.night,
  },
  primaryArrow: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.palette.night,
  },
  ghostRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  ghost: {
    minHeight: 48,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.cardBorderProminent,
    backgroundColor: theme.palette.card2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
  },
  ghostGrow: {
    flex: 1,
  },
  ghostLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 13,
    color: theme.palette.creamSoft,
  },
};
