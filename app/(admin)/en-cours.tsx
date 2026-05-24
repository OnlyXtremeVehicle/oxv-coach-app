/**
 * Admin vue 2 — En cours.
 *
 * Suivi temps réel de la session : état BLE des équipements en piste,
 * pilotes en roulage vs paddock. V1 : structure visuelle ; le live state
 * vient des subscriptions Supabase Realtime sur `telemetry_sessions`
 * (à câbler quand on aura plusieurs équipements simultanés).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

interface LiveSession {
  id: string;
  userId: string;
  startedAt: string;
  lapCount: number;
  status: string;
}

export default function EnCoursScreen() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, started_at, lap_count, status')
        .eq('status', 'recording')
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      setSessions(
        (data ?? []).map((row) => ({
          id: row.id,
          userId: row.user_id ?? '',
          startedAt: row.started_at ?? '',
          lapCount: row.lap_count ?? 0,
          status: row.status ?? 'unknown',
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>ADMIN · EN COURS</Text>
        <Text
          style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.xxl }]}
        >
          {sessions.length} session{sessions.length > 1 ? 's' : ''} active
          {sessions.length > 1 ? 's' : ''}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accent.bronze} />
        ) : sessions.length === 0 ? (
          <View
            style={{
              padding: spacing.xl,
              borderRadius: borderRadius.lg,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              backgroundColor: colors.background.secondary,
              alignItems: 'center',
            }}
          >
            <Text
              style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}
            >
              Aucun pilote en piste.
            </Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {sessions.map((s) => (
              <View
                key={s.id}
                style={{
                  padding: spacing.lg,
                  borderRadius: borderRadius.md,
                  borderWidth: 0.5,
                  borderColor: colors.accent.bronze,
                  backgroundColor: colors.background.secondary,
                }}
              >
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.medium,
                    marginBottom: spacing.xs,
                  }}
                >
                  User {s.userId.slice(0, 8)}…
                </Text>
                <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                  Démarrée à {timeOnly(s.startedAt)} · {s.lapCount} tour{s.lapCount > 1 ? 's' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={[
            typography.caption,
            { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.xl },
          ]}
        >
          Données rafraîchies à l'ouverture. Live realtime en V1.1.
        </Text>

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function timeOnly(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
