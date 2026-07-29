/**
 * Espace Pilote professionnel — Paddock Pro (hub contextuel, PR-70).
 *
 * Le pilote pro est un pilote (mêmes données, mêmes RLS own-row) avec un espace
 * distinct. Ce hub surface le contexte : sa dernière séance (régularité au tour,
 * fait factuel), ses circuits, et l'accès à ses outils data partagés avec
 * l'espace pilote. Aucun classement, aucun second chiffre rival, aucun conseil.
 * Doctrine : sobre, vouvoiement, pas d'emoji, or = donnée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import { Logo } from '@/brand/Logo';
import { GaugeInstrument } from '@/components/instruments';
import { supabase } from '@/lib/supabase';
import { computeRegularity } from '@/services/regularityService';
import { fetchSessionLaps } from '@/services/sessionsService';
import { type CircuitAggregate, loadPilotStats } from '@/services/statsService';
import { useAuthStore } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AccountButton } from '@/ui/AccountButton';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { timeAgoFr } from '@/utils/time';

/**
 * Les outils du pilote professionnel, RECÂBLÉS SUR L'ARBRE V2 (lot J5,
 * étape 9, décision fondateur du 29/07/2026).
 *
 * Le pilote pro EST un pilote : mêmes données, mêmes policies. Ces tuiles
 * visaient `app/(app)`, classé « meurt » — et c'était le dernier espace à
 * retenir l'arbre V1, par neuf liens et cinq boutons de compte. Elles pointent
 * désormais l'arbre V2. Cet espace part sur le web à terme ; ce recâblage ne
 * décide pas de sa date, il libère seulement l'arbre.
 *
 * Correspondances, telles qu'établies par le classement J5 :
 *   bilan       → la séance du jour a son propre lien plus bas ; la tuile mène
 *                 au hub Data, où les séances se listent.
 *   data-lab    → `/(app2)/data` (le hub Data est devenu la Saison)
 *   passeport   → `/(app2)/vous` (héros passeport : identité, palier, faits)
 *   signature   → `/(app2)/signature`
 *   garage      → `/(app2)/vous/garage`
 */
const TOOLS: { label: string; hint: string; href: string }[] = [
  { label: 'Vos séances', hint: 'Les relire une par une', href: '/(app2)/data' },
  { label: 'Votre saison', hint: 'Régularité, tour de référence, circuits', href: '/(app2)/data' },
  { label: 'Votre passeport', hint: 'Votre identité de pilote, cumulée', href: '/(app2)/vous' },
  { label: 'Votre signature', hint: 'Votre empreinte de pilotage', href: '/(app2)/signature' },
  { label: 'Votre garage', hint: 'Vos véhicules et leurs réglages', href: '/(app2)/vous/garage' },
  { label: 'Ambassadeur OXV', hint: 'Porter les couleurs OXV', href: '/(pro)/ambassadeur' },
];

interface LastSession {
  id: string;
  startedAt: Date;
  circuitName: string | null;
}

export default function ProPaddockScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const greeting = profile?.first_name ? `Bonjour ${profile.first_name}` : 'Bonjour';

  const [last, setLast] = useState<LastSession | null>(null);
  const [regularity, setRegularity] = useState<{ stdDevSeconds: number; lapCount: number } | null>(
    null
  );
  const [circuits, setCircuits] = useState<CircuitAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at, circuit_name')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setLast({
          id: data.id,
          startedAt: new Date(data.started_at),
          circuitName: data.circuit_name,
        });
        const laps = await fetchSessionLaps(data.id);
        if (!cancelled) {
          const reg = computeRegularity(
            laps
              .filter((l) => !l.is_outlap && !l.is_inlap)
              .map((l) => ({ lapNumber: l.lap_number, durationSeconds: l.duration_seconds }))
          );
          if (reg.stdDevSeconds !== null) {
            setRegularity({ stdDevSeconds: reg.stdDevSeconds, lapCount: reg.lapCount });
          }
        }
      }
      const stats = await loadPilotStats(profile.id);
      if (!cancelled) {
        setCircuits(
          Object.values(stats.byCircuit)
            .sort((a, b) => b.sessionCount - a.sessionCount)
            .slice(0, 3)
        );
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  return (
    <Screen>
      <AppBar title="PILOTE PRO OXV" leading={<Logo size={26} />} trailing={<AccountButton />} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ESPACE PROFESSIONNEL</Text>
        <Text style={s.title} accessibilityRole="header">
          {greeting}.
        </Text>

        {/* Contexte : dernière séance (régularité dominante, factuelle). */}
        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : last ? (
          <Link href={`/(app2)/bilan/${last.id}` as never} asChild>
            <Card
              onPress={() => {}}
              accessibilityLabel={`Votre dernière séance, ${last.circuitName ?? 'séance'}, ${timeAgoFr(
                last.startedAt
              )}`}
              style={{ marginTop: theme.spacing.xl }}
            >
              <Text style={s.eyebrowDim}>VOTRE DERNIÈRE SÉANCE</Text>
              <View style={s.lastRow}>
                {regularity ? (
                  <GaugeInstrument
                    value={regularity.stdDevSeconds}
                    min={0}
                    max={Math.max(3, regularity.stdDevSeconds * 1.25)}
                    unit="s"
                    formatValue={(v) => v.toFixed(1).replace('.', ',')}
                    size={96}
                    majorTicks={4}
                    minorPerMajor={1}
                  />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={s.lastCircuit}>{last.circuitName ?? 'Séance'}</Text>
                  <Text style={s.lastMeta}>{timeAgoFr(last.startedAt)}</Text>
                  {regularity ? (
                    <Text style={s.lastReg}>Régularité au tour · {regularity.lapCount} tours</Text>
                  ) : null}
                </View>
              </View>
            </Card>
          </Link>
        ) : (
          <Text style={s.manifest}>Votre première séance écrira la première ligne.</Text>
        )}

        {/* Vos circuits (factuel, trié par nombre de séances — pas un classement). */}
        {circuits.length > 0 ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Text style={s.eyebrow}>VOS CIRCUITS</Text>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {circuits.map((c) => (
                <View key={c.circuitName} style={s.circuitRow}>
                  <Text style={s.circuitName} numberOfLines={1}>
                    {c.circuitName}
                  </Text>
                  <Text style={s.circuitMeta}>
                    {c.sessionCount} séance{c.sessionCount > 1 ? 's' : ''} · {c.lapCount} tours
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Outils data partagés avec l'espace pilote. */}
        <View style={{ marginTop: theme.spacing.xl }}>
          <Text style={s.eyebrow}>VOS OUTILS</Text>
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            {TOOLS.map((t) => (
              <Card
                // Clé sur le LIBELLÉ : deux tuiles mènent au même hub Data
                // depuis le recâblage V2, et `href` ne les distingue plus.
                key={t.label}
                onPress={() => router.push(t.href as never)}
                accessibilityLabel={`${t.label}. ${t.hint}`}
              >
                <Text style={s.cardTitle}>{t.label}</Text>
                <Text style={s.cardHint}>{t.hint}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se déconnecter"
            onPress={() => signOut()}
            hitSlop={theme.hitSlop}
            style={({ pressed }) => ({
              paddingVertical: theme.spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={s.minorLink}>Se déconnecter</Text>
          </Pressable>
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
  eyebrowDim: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  lastRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  lastCircuit: {
    fontFamily: theme.fonts.display,
    fontSize: 18,
    letterSpacing: -0.2,
    color: theme.palette.cream,
  },
  lastMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
    marginTop: 5,
  },
  lastReg: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: 8,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.xl,
  },
  circuitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
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
    fontSize: 10.5,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
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
  minorLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
