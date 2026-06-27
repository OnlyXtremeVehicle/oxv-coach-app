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

import { EmptyState } from '@/components/instruments/EmptyState';
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('telemetry_sessions')
        .select('id, user_id, started_at, lap_count, status, users(first_name, last_name)')
        .eq('status', 'recording')
        .order('started_at', { ascending: false })
        .limit(20);
      if (cancelled) return;
      if (error) {
        setFailed(true);
        setLoading(false);
        return;
      }
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
        <Text style={s.title} accessibilityRole="header">
          {sessions.length} session{sessions.length > 1 ? 's' : ''} active
          {sessions.length > 1 ? 's' : ''}
        </Text>

        {loading ? (
          <ActivityIndicator color={BRONZE} accessibilityLabel="Chargement des sessions en cours" />
        ) : failed ? (
          <Card style={{ borderColor: theme.palette.line, paddingVertical: theme.spacing.xl }}>
            <Text style={s.errorTitle}>Suivi indisponible</Text>
            <Text style={s.errorHint}>
              La lecture des sessions a échoué. Vérifiez la connexion, puis rouvrez cet écran.
            </Text>
          </Card>
        ) : sessions.length === 0 ? (
          <EmptyState
            label="En piste"
            message="Aucun pilote en roulage pour le moment."
            source="telemetry_sessions"
          />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {sessions.map((session) => (
              <Card key={session.id} style={{ borderColor: BRONZE }}>
                <Text style={s.pilotName}>{session.pilotName}</Text>
                <Text style={s.meta}>
                  Départ <Text style={s.metaNum}>{timeOnly(session.startedAt)}</Text> ·{' '}
                  <Text style={s.metaNum}>{session.lapCount}</Text> tour
                  {session.lapCount > 1 ? 's' : ''}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <Text style={s.footnote}>
          Données rafraîchies à l&apos;ouverture. Suivi temps réel en V1.1.
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
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
  },
  errorTitle: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    textAlign: 'center' as const,
  },
  errorHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.5,
  },
  pilotName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  // Chiffres de la méta (heure de départ, nombre de tours) — voix de l'instrument.
  metaNum: {
    fontFamily: theme.fonts.mono,
    color: theme.palette.creamSoft,
  },
  footnote: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xl,
  },
};
