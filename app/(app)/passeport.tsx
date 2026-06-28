/**
 * Passeport — identité piste CUMULATIVE du pilote (PR-40). Zone Progression.
 *
 * Le portrait de qui vous êtes en piste, au fil des séances : votre empreinte
 * (silhouette signature, visuel dominant) + des faits d'identité neutres. Aucun
 * record, aucun rang, aucun score — l'identité, pas la performance. Le best-lap
 * et la marge vivent ailleurs (Progression/Bilan). Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState, Fact } from '@/components/instruments';
import { DriverAvatar } from '@/components/signature/DriverAvatar';
import { RadarEmpreinte } from '@/components/signature/RadarEmpreinte';
import { type Passport, loadPassport } from '@/services/passportService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

function prettyLevel(level: string | null | undefined): string {
  switch (level) {
    case 'debutant':
      return 'Débutant';
    case 'intermediaire':
      return 'Apprivoisé';
    case 'confirme':
      return 'Confirmé';
    case 'expert':
      return 'Expert';
    default:
      return 'Pilote OXV';
  }
}

function memberSinceLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function PasseportScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadPassport(profile.id).then((p) => {
      if (!cancelled) {
        setPassport(p);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useFocusEffect(reload);

  const since = memberSinceLabel(passport?.memberSince ?? null);
  const name = profile?.first_name?.trim() || 'Pilote';
  const hasData = (passport?.stats.totalSessions ?? 0) > 0;
  const circuits = passport
    ? Object.values(passport.stats.byCircuit).sort((a, b) => b.sessionCount - a.sessionCount)
    : [];

  return (
    <Screen>
      <AppBar title="PASSEPORT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={s.headRow}>
          {hasData && passport ? <DriverAvatar axes={passport.signature.axes} size={56} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>IDENTITÉ PISTE</Text>
            <Text style={s.title} accessibilityRole="header">
              {name}.
            </Text>
            <Text style={s.sub}>
              {prettyLevel(profile?.pilot_level)}
              {since ? ` · membre depuis ${since}` : ''}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} />
          </View>
        ) : !hasData ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Passeport à composer"
              message="Votre identité de pilote se dessine au fil de vos séances analysées."
            />
          </View>
        ) : (
          <>
            {/* Empreinte — le visuel DOMINANT (silhouette factuelle 5 axes). */}
            <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.xl }}>
              <RadarEmpreinte axes={passport!.signature.axes} />
            </View>

            {passport!.signature.manifest ? (
              <Text style={s.manifest}>{passport!.signature.manifest}</Text>
            ) : null}

            {/* Faits d'identité NEUTRES (cumul) — jamais un record ni un rang. */}
            <View style={s.factRow}>
              <Fact label="Séances" value={String(passport!.stats.totalSessions)} />
              <Fact label="Circuits" value={String(passport!.circuitCount)} />
            </View>
            <View style={[s.factRow, { marginTop: theme.spacing.sm }]}>
              <Fact label="Tours" value={String(passport!.stats.totalLaps)} />
              <Fact
                label="Distance"
                value={
                  passport!.stats.totalDistanceKm > 0
                    ? String(Math.round(passport!.stats.totalDistanceKm))
                    : '—'
                }
                unit="km"
              />
            </View>

            {/* Carnet de circuits (PR-63) : où vous avez roulé. Le plus familier
                en tête (séances), jamais un classement de performance. */}
            {circuits.length > 0 ? (
              <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
                <SectionLabel>Vos circuits</SectionLabel>
                {circuits.map((c) => (
                  <View key={c.circuitName} style={s.circuitRow}>
                    <Text style={s.circuitName}>{c.circuitName}</Text>
                    <Text style={s.circuitMeta}>
                      {c.sessionCount} séance{c.sessionCount > 1 ? 's' : ''} · {c.lapCount} tours
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Carte de licence partageable (PR-65) — insigne factuel vers l'extérieur. */}
            <View style={{ marginTop: theme.spacing.xxl }}>
              <Button
                label="Partager ma carte de licence"
                variant="ghost"
                onPress={() => router.push('/(app)/carte-licence' as never)}
              />
            </View>

            <Text style={s.doctrine}>Votre identité, telle que mesurée. Pas un rang.</Text>
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
  sub: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  headRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  circuitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.line,
  },
  circuitName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    flex: 1,
  },
  circuitMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    textAlign: 'center' as const,
    marginBottom: theme.spacing.xl,
  },
  factRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
};
