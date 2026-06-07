/**
 * Écran #20 — Accueil / Hub central, 3 modes.
 *
 *   mode "enroute"   (S5)  — "Bon trajet vers Beltoise. Coupez l'app. Je conduis."
 *   mode "countdown" (S4)  — placeholder ; le wire-up upcomingSessions
 *                            viendra en sem 8 (onboarding + paddock)
 *   mode "passive"   (autres) — greeting + card "Votre dernier bilan" si dispo
 *
 * Pour V1, le mode est calculé localement à partir de useAppStateStore.state.
 * En sem 7+, la centralisation passera par useUIStore.hubMode alimenté par
 * un wire-up dédié (position + sessions à venir).
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { timeAgoFr, timeBasedGreeting } from '@/utils/time';

interface RecentSession {
  id: string;
  startedAt: Date;
  circuitName: string | null;
}

export default function HomeHubScreen() {
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const state = useAppStateStore((s) => s.state);

  const [recentSession, setRecentSession] = useState<RecentSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('telemetry_sessions')
        .select('id, started_at, circuit_name')
        .eq('user_id', profile.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (!error && data) {
        setRecentSession({
          id: data.id,
          startedAt: new Date(data.started_at),
          circuitName: data.circuit_name,
        });
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const firstName = profile?.first_name ?? '';
  const greeting = timeBasedGreeting();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.huge,
          flexGrow: 1,
        }}
      >
        {state === 'S5_approche' ? (
          <ModeEnroute />
        ) : state === 'S4_anticipation' ? (
          <ModeCountdown firstName={firstName} />
        ) : (
          <ModePassive
            greeting={greeting}
            firstName={firstName}
            recentSession={recentSession}
            loading={loading}
          />
        )}

        <View style={{ flex: 1, minHeight: spacing.xxxl }} />

        {__DEV__ ? (
          <Link href="/(app)/debug-capture" asChild>
            <Pressable style={{ marginBottom: spacing.lg, alignItems: 'center' }}>
              <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                Mode debug — capture UBX
              </Text>
            </Pressable>
          </Link>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={signOut}
          style={({ pressed }) => ({
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
            Se déconnecter
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeEnroute() {
  return (
    <View style={{ marginTop: spacing.giant }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>EN ROUTE</Text>
      <Text style={[typography.screenTitle, { marginBottom: spacing.xl }]}>
        Bon trajet vers Beltoise.
      </Text>
      <Text style={typography.manifest}>Coupez l'app. Je conduis.</Text>
    </View>
  );
}

function ModeCountdown({ firstName }: { firstName: string }) {
  return (
    <View style={{ marginTop: spacing.giant }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>PROCHAINE SESSION</Text>
      <Text style={[typography.screenTitle, { marginBottom: spacing.xl }]}>
        {firstName ? `À bientôt, ${firstName}.` : 'À bientôt.'}
      </Text>
      <Text style={typography.manifest}>L'app vous tiendra au courant.</Text>
    </View>
  );
}

function ModePassive({
  greeting,
  firstName,
  recentSession,
  loading,
}: {
  greeting: string;
  firstName: string;
  recentSession: RecentSession | null;
  loading: boolean;
}) {
  const greetingText = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;

  return (
    <View style={{ marginTop: spacing.huge }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>OXV MIRROR</Text>
      <Text style={[typography.screenTitle, { marginBottom: spacing.xxl }]}>{greetingText}</Text>

      {loading ? null : recentSession ? (
        <Link
          href={{
            pathname: '/(app)/bilan',
            params: { sessionId: recentSession.id },
          }}
          asChild
        >
          <Pressable
            style={({ pressed }) => ({
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={[typography.eyebrow, { marginBottom: spacing.sm }]}>
              VOTRE DERNIER BILAN
            </Text>
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.regular,
                marginBottom: spacing.xs,
              }}
            >
              {recentSession.circuitName ?? 'Session'}
            </Text>
            <Text style={typography.caption}>{timeAgoFr(recentSession.startedAt)}</Text>
          </Pressable>
        </Link>
      ) : (
        <Text style={typography.manifest}>Votre première session écrira la première ligne.</Text>
      )}

      {/* Accès à la carte écosystème (§8) — préparer ses sorties. */}
      <Link href={'/(app)/circuits' as never} asChild>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: spacing.xl,
            padding: spacing.lg,
            borderRadius: borderRadius.md,
            borderWidth: 0.5,
            borderColor: colors.border.subtle,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: colors.text.secondary, fontSize: fontSize.body }}>
            Carte des circuits
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
