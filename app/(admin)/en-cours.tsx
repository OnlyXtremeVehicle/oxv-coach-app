/**
 * Admin vue 2 — En cours.
 *
 * Suivi temps réel de la session : état BLE des équipements en piste,
 * pilotes en roulage vs paddock. V1 : structure visuelle ; le live state
 * vient des subscriptions Supabase Realtime sur `telemetry_sessions`
 * (à câbler quand on aura plusieurs équipements simultanés).
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin). Logique de données inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';

interface LiveSession {
  id: string;
  userId: string;
  pilotName: string;
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
        .select('id, user_id, started_at, lap_count, status, users(first_name, last_name)')
        .eq('status', 'recording')
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      setSessions(
        (data ?? []).map((row) => {
          const u = row.users as { first_name: string | null; last_name: string | null } | null;
          const name = u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : '';
          return {
            id: row.id,
            userId: row.user_id ?? '',
            pilotName: name || `Pilote ${(row.user_id ?? '').slice(0, 8)}`,
            startedAt: row.started_at ?? '',
            lapCount: row.lap_count ?? 0,
            status: row.status ?? 'unknown',
          };
        })
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Screen>
      <AppBar title="EN COURS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN · EN COURS</Text>
        <Text style={s.title}>
          {sessions.length} session{sessions.length > 1 ? 's' : ''} active
          {sessions.length > 1 ? 's' : ''}
        </Text>

        {loading ? (
          <ActivityIndicator color={BRONZE} />
        ) : sessions.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>Aucun pilote en piste.</Text>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {sessions.map((session) => (
              <Card key={session.id} style={{ borderColor: BRONZE }}>
                <Text style={s.pilotName}>{session.pilotName}</Text>
                <Text style={s.meta}>
                  Démarrée à {timeOnly(session.startedAt)} · {session.lapCount} tour
                  {session.lapCount > 1 ? 's' : ''}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <Text style={s.footnote}>
          Données rafraîchies à l&apos;ouverture. Live realtime en V1.1.
        </Text>
      </View>
    </Screen>
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

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: BRONZE,
    marginTop: theme.spacing.sm,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  pilotName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
  },
};
