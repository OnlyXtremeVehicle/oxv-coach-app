/**
 * Admin — Analyse session : diagnostic + relance de pipeline (PR-83).
 *
 * Vue détail d'une session pour l'admin : l'état réel du pipeline (frames, tours,
 * segments, marge, débrief, lectures) puis trois relances déléguées au serveur
 * (service_role) — l'app ne réécrit jamais l'analyse d'un autre pilote.
 *
 * Doctrine : surface admin, factuelle. Bronze = couleur de rôle admin. Le rouge
 * code ici la sévérité critique d'une anomalie technique, jamais le pilote.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type SessionDiagnostic,
  loadSessionDiagnostic,
  relaunchDebrief,
  relaunchInsights,
  relaunchPendingAnalysis,
} from '@/services/adminSessionDiagnosticService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';
import { formatDateShort } from '@/utils/format';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

type Tone = 'ok' | 'warn' | 'crit';
const TONE_COLOR: Record<Tone, string> = {
  ok: theme.palette.creamMute,
  warn: ADMIN,
  crit: theme.palette.red,
};

export default function AnalyseSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [diag, setDiag] = useState<SessionDiagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const d = await loadSessionDiagnostic(id);
      setDiag(d);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (key: string, fn: () => Promise<{ ok: boolean; message: string }>) => {
      setBusy(key);
      const res = await fn();
      setBusy(null);
      if (res.ok) haptics.success();
      Toast.show({ type: res.ok ? 'success' : 'error', text1: res.message });
      if (res.ok) await reload();
    },
    [reload]
  );

  const noFrames = diag != null && (diag.totalFrames == null || diag.totalFrames === 0);
  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : diag == null
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="ANALYSE SESSION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Session introuvable"
          emptyMessage="Cette session n'existe pas ou n'est pas accessible."
          emptySource="telemetry_sessions"
          errorCause="Le diagnostic de la session n'a pas pu être chargé."
          onRetry={reload}
        >
          {diag ? (
            <>
              <Text style={s.eyebrow}>DIAGNOSTIC</Text>
              <Text style={s.title} accessibilityRole="header">
                {diag.name || diag.circuitName || 'Session'}
              </Text>
              <Text style={s.meta}>
                {diag.circuitName ?? 'Circuit inconnu'} · {formatDateShort(diag.startedAt)} ·{' '}
                {diag.status}
              </Text>

              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>ÉTAT DU PIPELINE</SectionLabel>
                <Card style={{ marginTop: theme.spacing.sm }}>
                  <Row
                    label="Frames reçues"
                    value={diag.totalFrames != null ? String(diag.totalFrames) : '—'}
                    tone={noFrames ? 'crit' : 'ok'}
                  />
                  <Row label="Tours détectés" value={String(diag.lapCount)} tone="ok" />
                  <Row
                    label="Segments analysés"
                    value={String(diag.segmentCount)}
                    tone={diag.segmentCount === 0 ? 'warn' : 'ok'}
                  />
                  <Row
                    label="Marge globale"
                    value={
                      diag.hasAnalysis && diag.marginGlobal != null
                        ? `${Math.round(diag.marginGlobal)}% · ${diag.marginZone ?? '—'}`
                        : 'absente'
                    }
                    tone={diag.hasAnalysis ? 'ok' : 'warn'}
                    sub={
                      diag.hasAnalysis
                        ? `${diag.algoVersion ?? 'algo ?'} · ${
                            diag.computedAt ? formatDateShort(diag.computedAt) : '—'
                          }`
                        : undefined
                    }
                  />
                  <Row
                    label="Débrief"
                    value={diag.hasDebrief ? `${diag.debriefChars} car.` : 'non généré'}
                    tone={diag.hasDebrief ? 'ok' : 'warn'}
                  />
                  <Row
                    label="Lectures (insights)"
                    value={String(diag.insightCount)}
                    tone={diag.insightCount === 0 ? 'warn' : 'ok'}
                    last
                  />
                </Card>
              </View>

              <View style={{ marginTop: theme.spacing.xl }}>
                <SectionLabel>RELANCER LE PIPELINE</SectionLabel>
                <Text style={s.hint}>
                  Les relances sont exécutées côté serveur. Aucune donnée pilote n’est réécrite
                  depuis cet appareil.
                </Text>
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                  <Action
                    label="Recalculer les lectures"
                    hint="session_insights (serveur)"
                    busy={busy === 'insights'}
                    disabled={busy != null}
                    onPress={() => run('insights', () => relaunchInsights(diag.sessionId))}
                  />
                  <Action
                    label="Régénérer le débrief"
                    hint="generate-debrief-ai · garde-fou doctrinal"
                    busy={busy === 'debrief'}
                    disabled={busy != null}
                    onPress={() => run('debrief', () => relaunchDebrief(diag.sessionId))}
                  />
                  <Action
                    label="Relancer l’analyse en attente"
                    hint="balayage des marges (lot)"
                    busy={busy === 'pending'}
                    disabled={busy != null}
                    onPress={() => run('pending', () => relaunchPendingAnalysis())}
                  />
                </View>
              </View>
            </>
          ) : null}
        </StateWrapper>
      </View>
    </Screen>
  );
}

function Row({
  label,
  value,
  tone,
  sub,
  last,
}: {
  label: string;
  value: string;
  tone: Tone;
  sub?: string;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last ? null : s.rowBorder]}>
      <View style={s.rowLeft}>
        <View
          style={[s.dot, { backgroundColor: TONE_COLOR[tone] }]}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
        <View style={{ flex: 1 }}>
          <Text style={s.rowLabel}>{label}</Text>
          {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
        </View>
      </View>
      <Text
        style={[s.rowValue, { color: TONE_COLOR[tone] === ADMIN ? ADMIN : theme.palette.cream }]}
      >
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  hint,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  hint: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      hitSlop={theme.hitSlop}
      onPress={onPress}
      style={({ pressed }) => [s.action, disabled && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.actionLabel}>{label}</Text>
        <Text style={s.actionHint}>{hint}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="En cours" />
      ) : (
        <Text style={s.actionChevron}>›</Text>
      )}
    </Pressable>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ADMIN,
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
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.line,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    flex: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  rowLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamSoft,
  },
  rowSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
  },
  action: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  actionLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  actionHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: 2,
  },
  actionChevron: {
    color: theme.palette.creamMute,
    fontSize: 20,
  },
};
