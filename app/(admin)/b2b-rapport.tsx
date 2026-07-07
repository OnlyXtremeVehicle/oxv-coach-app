/**
 * Admin — éditeur du B2B Event Report (PR-38).
 *
 * Génère/édite un rapport par (événement, partenaire). Les compteurs sont
 * snapshottés depuis les inscriptions ; l'éditorial (média, conclusion) est
 * libre ; le partenaire ne le voit qu'une fois « Partagé ». Admin-only.
 */

import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type B2BReport,
  type B2BReportStatus,
  generateReport,
  getReport,
  updateReport,
} from '@/services/b2bReportService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Fact } from '@/ui/Fact';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function AdminB2BReportScreen() {
  const { eventId, partnerId } = useLocalSearchParams<{ eventId: string; partnerId: string }>();
  const [report, setReport] = useState<B2BReport | null>(null);
  const [media, setMedia] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [status, setStatus] = useState<B2BReportStatus>('draft');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((r: B2BReport | null) => {
    setReport(r);
    setMedia(r?.mediaSummary ?? '');
    setConclusion(r?.conclusion ?? '');
    setStatus(r?.status ?? 'draft');
  }, []);

  const reload = useCallback(() => {
    if (!eventId || !partnerId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        let r = await getReport(eventId, partnerId);
        if (!r) {
          // Première ouverture : on génère le squelette (compteurs snapshottés).
          const res = await generateReport(eventId, partnerId);
          r = res.report ?? null;
        }
        if (!cancelled) {
          apply(r);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, partnerId, apply]);

  useFocusEffect(reload);

  async function onRefreshCounts() {
    if (!eventId || !partnerId || busy) return;
    setBusy(true);
    const res = await generateReport(eventId, partnerId);
    setBusy(false);
    if (res.ok && res.report) apply(res.report);
    else setError(res.error ?? 'Génération impossible.');
  }

  async function onSave(nextStatus?: B2BReportStatus) {
    if (!report || busy) return;
    setBusy(true);
    setError(null);
    const res = await updateReport(report.id, {
      mediaSummary: media,
      conclusion,
      status: nextStatus ?? status,
    });
    setBusy(false);
    if (res.ok) reload();
    else setError(res.error ?? 'Enregistrement impossible.');
  }

  const state: ScreenState = loading
    ? 'loading'
    : loadError
      ? 'error'
      : !report
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="RAPPORT B2B" onBack={() => router.back()} />
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.lg,
        }}
      >
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Rapport indisponible"
          emptyMessage="Ce rapport n'a pas encore pu être établi."
          errorCause="Le rapport n'a pas pu être chargé."
          onRetry={reload}
        >
          {report ? (
            <>
              <Text style={[s.eyebrow, { color: ADMIN }]}>PARTICIPATION (FIGÉE)</Text>
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Fact value={report.registeredCount.toString()} label="inscrits" />
                <Fact value={report.checkedInCount.toString()} label="présents" />
              </View>
              <Button
                label="Régénérer les compteurs"
                variant="ghost"
                onPress={onRefreshCounts}
                loading={busy}
              />

              <Card style={{ gap: theme.spacing.md }}>
                <SectionLabel>Éditorial</SectionLabel>
                <Field
                  label="Média / temps forts"
                  optional
                  value={media}
                  onChangeText={setMedia}
                  multiline
                  maxLength={2000}
                />
                <Field
                  label="Conclusion"
                  optional
                  value={conclusion}
                  onChangeText={setConclusion}
                  multiline
                  maxLength={2000}
                />
              </Card>

              <View style={{ gap: theme.spacing.sm }}>
                <SectionLabel>Statut</SectionLabel>
                <View style={s.pills}>
                  {(['draft', 'shared'] as B2BReportStatus[]).map((st) => {
                    const on = status === st;
                    return (
                      <Pressable
                        key={st}
                        onPress={() => setStatus(st)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={st === 'draft' ? 'Brouillon' : 'Partagé'}
                        hitSlop={6}
                        style={[s.pill, on ? s.pillOn : null]}
                      >
                        <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>
                          {st === 'draft' ? 'Brouillon' : 'Partagé'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={s.hint}>« Partagé » rend le rapport visible du partenaire.</Text>
              </View>

              {error ? (
                <Text style={s.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}

              <Button label="Enregistrer" onPress={() => onSave()} loading={busy} />
            </>
          ) : null}
        </StateWrapper>
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
    color: ADMIN,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 38,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: {
    borderColor: ADMIN,
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
  pillTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTxtOn: {
    color: theme.palette.cream,
  },
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.red,
  },
};
