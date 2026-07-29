/**
 * Pilote Pro — Performance (lecture comparée descriptive, PR-71).
 *
 * Des FAITS, jamais un verdict. L'écran agrège ce qui est déjà calculé (séances,
 * circuits, tours, distance, régularité par circuit) et oriente vers les outils
 * de comparaison descriptifs existants (comparateur A/B, progression soi-contre-
 * soi). AUCUNE tendance prédictive, aucun classement, aucun conseil de pilotage.
 * « Comment ces séances diffèrent-elles ? » — la conclusion appartient au pilote.
 * Doctrine : un seul chiffre dominant, or = donnée, pas d'emoji, vouvoiement.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { type CircuitAggregate, type PilotStats, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const TOOLS: { label: string; hint: string; href: string }[] = [
  {
    label: 'Bibliothèque de séances',
    hint: 'Retrouver une séance par circuit et période',
    href: '/(pro)/bibliotheque',
  },
  // Recâblés sur l'arbre V2 au lot J5, étape 9 : `comparateur` et
  // `progression` sont classés « meurt », leurs équivalents app2 existent —
  // `data/comparer` pour le côte à côte, les sections RÉGULARITÉ et TOUR DE
  // RÉFÉRENCE du hub Data pour l'évolution.
  {
    label: 'Comparer deux séances',
    hint: 'Côte à côte, fait par fait',
    href: '/(app2)/data/comparer',
  },
  {
    label: 'Votre progression',
    hint: 'Votre évolution, soi contre soi',
    href: '/(app2)/data',
  },
];

export default function ProPerformanceScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [stats, setStats] = useState<PilotStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    loadPilotStats(profile.id)
      .then((st) => {
        if (!cancelled) {
          setStats(st);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const circuits: CircuitAggregate[] = stats
    ? Object.values(stats.byCircuit).sort((a, b) => b.sessionCount - a.sessionCount)
    : [];
  const circuitCount = circuits.length;

  return (
    <Screen>
      <AppBar title="PERFORMANCE" trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>LECTURE COMPARÉE</Text>
        <Text style={s.title} accessibilityRole="header">
          Vos faits, côte à côte.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : (
          <>
            {/* Chiffre dominant UNIQUE : nombre de séances. Le reste reste en
                retrait (ligne sobre, sans encadré) pour ne pas rivaliser. */}
            <View style={s.heroRow}>
              <Text style={s.hero}>{stats?.totalSessions ?? 0}</Text>
              <Text style={s.heroLabel}>
                séance{(stats?.totalSessions ?? 0) > 1 ? 's' : ''} enregistrée
                {(stats?.totalSessions ?? 0) > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={s.subline}>
              {circuitCount} circuit{circuitCount > 1 ? 's' : ''} · {stats?.totalLaps ?? 0} tours ·{' '}
              {Math.round(stats?.totalDistanceKm ?? 0)} km
            </Text>

            {/* Par circuit — descriptif, trié par nombre de séances (pas un rang). */}
            {circuits.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>PAR CIRCUIT</SectionLabel>
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                  {circuits.map((c) => (
                    <Card key={c.circuitName}>
                      <Text style={s.circuitName} numberOfLines={1}>
                        {c.circuitName}
                      </Text>
                      <Text style={s.circuitMeta}>
                        {c.sessionCount} séance{c.sessionCount > 1 ? 's' : ''} · {c.lapCount} tours
                        · {Math.round(c.distanceKm)} km
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Outils de comparaison descriptifs. */}
            <View style={{ marginTop: theme.spacing.xl }}>
              <SectionLabel>EXPLORER</SectionLabel>
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {TOOLS.map((t) => (
                  <Card
                    key={t.href}
                    onPress={() => router.push(t.href as never)}
                    accessibilityLabel={`${t.label}. ${t.hint}`}
                  >
                    <Text style={s.cardTitle}>{t.label}</Text>
                    <Text style={s.cardHint}>{t.hint}</Text>
                  </Card>
                ))}
              </View>
            </View>

            <Card style={{ marginTop: theme.spacing.xl }}>
              <Text style={s.note}>
                Des faits, pas un verdict. L&apos;app montre, elle ne dirige pas. Les conclusions
                sont les vôtres.
              </Text>
            </Card>
          </>
        )}
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
    color: theme.palette.faint,
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
  heroRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  hero: {
    fontFamily: theme.fonts.display,
    fontSize: 56,
    letterSpacing: -1,
    color: theme.palette.cream,
  },
  heroLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    flex: 1,
  },
  subline: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.md,
  },
  circuitName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  circuitMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
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
  note: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
  },
};
