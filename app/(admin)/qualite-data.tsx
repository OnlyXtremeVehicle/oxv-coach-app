/**
 * Admin — Qualité data (§7.1).
 *
 * Détecte les sessions à surveiller (frames manquantes, `recording` non clôturé,
 * analyse absente, débrief non généré) à partir des données existantes, et permet
 * de SUIVRE (créer un rapport) puis RÉSOUDRE. Admin-only (RLS `is_admin`).
 *
 * Doctrine : sobre, factuel. Bronze = couleur de rôle admin. Le rouge ici code la
 * sévérité critique d'une anomalie technique (surface admin), jamais le pilote.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import * as haptics from '@/lib/haptics';
import {
  type QualityReport,
  type SessionAnomaly,
  type Severity,
  createQualityReport,
  detectSessionAnomalies,
  listQualityReports,
  setReportStatus,
} from '@/services/adminQualityService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

const BRONZE = '#B87333';
const SEVERITY_COLOR: Record<Severity, string> = {
  critical: theme.palette.red,
  warning: BRONZE,
  info: theme.palette.creamMute,
};
const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

function worst(anomalies: { severity: Severity }[]): Severity {
  return anomalies.reduce<Severity>(
    (acc, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[acc] ? a.severity : acc),
    'info'
  );
}

export default function QualiteDataScreen() {
  const [anomalies, setAnomalies] = useState<SessionAnomaly[]>([]);
  const [reports, setReports] = useState<QualityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    const [a, r] = await Promise.all([detectSessionAnomalies(), listQualityReports()]).catch(
      () => [null, null] as const
    );
    if (a === null) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setAnomalies(a);
    setReports(r ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const trackedSessionIds = new Set(
    reports.filter((r) => r.status !== 'resolved').map((r) => r.sessionId)
  );
  const openReports = reports.filter((r) => r.status !== 'resolved');

  async function onTrack(s: SessionAnomaly) {
    const sev = worst(s.anomalies);
    const ok = await createQualityReport({
      sessionId: s.sessionId,
      type: s.anomalies[0]?.type ?? 'no_frames',
      severity: sev,
      message: s.anomalies.map((a) => a.label).join(' · '),
    });
    if (ok) {
      haptics.success();
      await reload();
    }
  }

  async function onResolve(id: string) {
    const res = await setReportStatus(id, 'resolved');
    if (res.ok) {
      haptics.tap();
      await reload();
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="QUALITÉ DATA" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="QUALITÉ DATA" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>FIABILITÉ</Text>
        <Text style={s.title} accessibilityRole="header">
          À surveiller
        </Text>
        <Text style={s.intro}>
          <Text style={s.count}>{anomalies.length}</Text> session
          {anomalies.length > 1 ? 's' : ''} avec une anomalie détectée.
        </Text>

        {failed ? (
          <EmptyState
            label="Indisponible"
            message="Les anomalies n'ont pas pu être chargées."
            source="telemetry_sessions"
          />
        ) : anomalies.length === 0 ? (
          <EmptyState
            label="Tout est propre"
            message="Aucune anomalie détectée sur les sessions récentes."
            source="telemetry_sessions"
          />
        ) : (
          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
            {anomalies.map((a) => {
              const tracked = trackedSessionIds.has(a.sessionId);
              return (
                <Card key={a.sessionId} style={{ borderColor: SEVERITY_COLOR[worst(a.anomalies)] }}>
                  <Text style={s.sessionName}>
                    {a.sessionName || a.circuitName || 'Session'} · {formatDateShort(a.startedAt)}
                  </Text>
                  <View style={{ gap: 4, marginTop: theme.spacing.sm }}>
                    {a.anomalies.map((an) => (
                      <View key={an.type} style={s.anomalyRow}>
                        <View
                          style={[s.dot, { backgroundColor: SEVERITY_COLOR[an.severity] }]}
                          accessibilityElementsHidden
                          importantForAccessibility="no"
                        />
                        <Text style={s.anomalyLabel}>{an.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tracked ? 'Déjà suivi' : 'Suivre cette session'}
                    disabled={tracked}
                    hitSlop={theme.hitSlop}
                    onPress={() => onTrack(a)}
                    style={({ pressed }) => [s.trackBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={[s.trackT, tracked && { color: theme.palette.faint }]}>
                      {tracked ? 'Suivi en cours' : 'Suivre'}
                    </Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}

        {openReports.length > 0 ? (
          <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
            <SectionLabel>SUIVIS EN COURS</SectionLabel>
            {openReports.map((r) => (
              <Card key={r.id} style={{ borderColor: SEVERITY_COLOR[r.severity] }}>
                <View style={s.reportHead}>
                  <Text style={s.reportType}>{r.type}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Marquer résolu"
                    hitSlop={theme.hitSlop}
                    onPress={() => onResolve(r.id)}
                    style={({ pressed }) => [s.resolveBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={s.resolveT}>Résolu</Text>
                  </Pressable>
                </View>
                {r.message ? <Text style={s.reportMsg}>{r.message}</Text> : null}
              </Card>
            ))}
          </View>
        ) : null}
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
  },
  intro: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  count: { fontFamily: theme.fonts.mono, color: theme.palette.cream },
  sessionName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  anomalyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  anomalyLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  trackBtn: {
    marginTop: theme.spacing.md,
    minHeight: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  trackT: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
  reportHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  reportType: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamSoft,
  },
  reportMsg: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  resolveBtn: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.md,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  resolveT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
