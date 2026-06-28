/**
 * Admin — file de modération (signalements communautaires, M3).
 *
 * L'admin traite les signalements : prend en charge, résout ou rejette. La note
 * de résolution est admin-only (jamais exposée au signaleur). L'action sur le
 * contenu (retrait, suspension) se fait via les outils admin existants — cette
 * file ne masque rien automatiquement. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  type ModerationReport,
  type ModerationStatus,
  listReports,
  reasonLabel,
  resolveReport,
  takeReport,
} from '@/services/moderationService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const STATUS_LABEL: Record<ModerationStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  resolu: 'Résolu',
  rejete: 'Rejeté',
};
const TARGET_LABEL: Record<string, string> = {
  coach_review: 'Avis coach',
  partner_offer: 'Offre partenaire',
};

function statusColor(s: ModerationStatus): string {
  if (s === 'nouveau') return theme.palette.red; // P0 admin priority = rouge admin
  if (s === 'en_cours') return theme.palette.gold;
  return theme.palette.faint;
}

export default function AdminModerationScreen() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listReports().then((rows) => {
      if (!cancelled) {
        // Non-traités d'abord (nouveau, en_cours), puis le reste.
        const open = rows.filter((r) => r.status === 'nouveau' || r.status === 'en_cours');
        const closed = rows.filter((r) => r.status === 'resolu' || r.status === 'rejete');
        setReports([...open, ...closed]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  async function onTake(r: ModerationReport) {
    setBusy(true);
    const res = await takeReport(r.id);
    setBusy(false);
    if (res.ok) reload();
  }

  async function onResolve(r: ModerationReport, status: 'resolu' | 'rejete') {
    setBusy(true);
    const res = await resolveReport(r.id, status, resolution || undefined);
    setBusy(false);
    if (res.ok) {
      setSelectedId(null);
      setResolution('');
      reload();
    }
  }

  return (
    <Screen>
      <AppBar title="MODÉRATION" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>FILE DES SIGNALEMENTS</Text>
        <Text style={s.title} accessibilityRole="header">
          Signalements.
        </Text>

        <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.sm }}>
          {loading ? (
            <Text style={s.muted}>Chargement…</Text>
          ) : reports.length === 0 ? (
            <Text style={s.muted}>Aucun signalement.</Text>
          ) : (
            reports.map((r) => {
              const open = selectedId === r.id;
              return (
                <Card
                  key={r.id}
                  onPress={() => {
                    setSelectedId(open ? null : r.id);
                    setResolution('');
                  }}
                  accessibilityLabel={`${reasonLabel(r.reason)}, ${STATUS_LABEL[r.status]}`}
                >
                  <View style={s.head}>
                    <Text style={s.reason}>{reasonLabel(r.reason)}</Text>
                    <Text style={[s.status, { color: statusColor(r.status) }]}>
                      {STATUS_LABEL[r.status]}
                    </Text>
                  </View>
                  <Text style={s.meta}>
                    {TARGET_LABEL[r.targetType] ?? r.targetType} · {r.targetId.slice(0, 8)}…
                  </Text>
                  {r.details ? <Text style={s.details}>{r.details}</Text> : null}

                  {open ? (
                    <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.sm }}>
                      {r.status === 'nouveau' ? (
                        <Button
                          label="Prendre en charge"
                          onPress={() => onTake(r)}
                          loading={busy}
                        />
                      ) : null}
                      {r.status === 'nouveau' || r.status === 'en_cours' ? (
                        <>
                          <SectionLabel>Note de résolution (interne)</SectionLabel>
                          <Field
                            label="Résolution"
                            optional
                            value={resolution}
                            onChangeText={setResolution}
                            multiline
                            maxLength={2000}
                          />
                          <Button
                            label="Marquer résolu"
                            onPress={() => onResolve(r, 'resolu')}
                            loading={busy}
                          />
                          <Button
                            label="Rejeter le signalement"
                            variant="ghost"
                            onPress={() => onResolve(r, 'rejete')}
                          />
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
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
  head: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  reason: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  details: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.sm,
    lineHeight: theme.fontSize.small * 1.45,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
};
