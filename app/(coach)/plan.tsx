/**
 * Coach — Plan (objectifs assignés à un pilote). Réintégration coach__plan.
 *
 * Le coach pose des objectifs MESURABLES pour SON pilote (métrique + direction +
 * cible) et suit leur statut. Câble la table existante coach_objectives via
 * coachObjectivesService (aucun schéma nouveau). Émetteur = le coach (humain) ;
 * côté pilote, ces objectifs apparaissent attribués. Pas d'échéance (absente du
 * schéma — on n'invente rien).
 */

import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type CoachObjective,
  type ObjectiveDirection,
  type ObjectiveMetric,
  METRICS,
  METRIC_LABEL,
  createObjective,
  listObjectivesForPilot,
  objectiveTargetLabel,
  setObjectiveStatus,
} from '@/services/coachObjectivesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

const { palette, spacing } = theme;

const DIRECTIONS: { key: ObjectiveDirection; label: string }[] = [
  { key: 'below', label: 'Sous' },
  { key: 'above', label: 'Au-dessus' },
  { key: 'reach', label: 'Atteindre' },
];

const STATUS_LABEL: Record<CoachObjective['status'], string> = {
  active: 'En cours',
  achieved: 'Atteint',
  archived: 'Archivé',
};

export default function CoachPlanScreen() {
  const params = useLocalSearchParams<{ pilotId?: string }>();
  const pilotId = params.pilotId;

  const [objectives, setObjectives] = useState<CoachObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulaire de création.
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ObjectiveMetric>('regularity');
  const [direction, setDirection] = useState<ObjectiveDirection>('below');
  const [targetText, setTargetText] = useState('');

  const reload = useCallback(() => {
    if (!pilotId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    listObjectivesForPilot(pilotId)
      .then((rows) => {
        if (!cancelled) {
          setObjectives(rows);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pilotId]);

  useFocusEffect(reload);

  async function onCreate() {
    if (!pilotId || saving || !title.trim()) return;
    setSaving(true);
    const parsed = targetText.trim().replace(',', '.');
    const targetValue =
      parsed.length > 0 && Number.isFinite(Number(parsed)) ? Number(parsed) : null;
    const res = await createObjective({
      pilotId,
      title,
      metric,
      targetDirection: direction,
      targetValue,
    });
    setSaving(false);
    if (res.ok) {
      setTitle('');
      setTargetText('');
      reload();
    }
  }

  async function onStatus(o: CoachObjective, status: CoachObjective['status']) {
    // Optimiste, recharge en cas d'échec.
    setObjectives((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    const res = await setObjectiveStatus(o.id, status, status === 'achieved' ? isoNow() : null);
    if (!res.ok) reload();
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : objectives.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen scroll={false}>
      <AppBar title="PLAN" onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        >
          <View style={{ marginBottom: spacing.md }}>
            <RoleBadge role="coach" />
          </View>
          <Text style={s.title}>Objectifs du pilote.</Text>
          <Text style={s.manifest}>
            Des cibles mesurables que vous posez. Le pilote les voit, attribuées à vous.
          </Text>

          {/* Liste des objectifs */}
          <View style={{ marginTop: spacing.xl }}>
            <StateWrapper
              state={pilotId ? state : 'empty'}
              skeletonLines={4}
              emptyLabel={pilotId ? 'Aucun objectif' : 'Pilote non précisé'}
              emptyMessage={
                pilotId
                  ? 'Posez un premier objectif ci-dessous.'
                  : 'Ouvrez le plan depuis la fiche d’un pilote.'
              }
              errorCause="Les objectifs n'ont pas pu être chargés."
              onRetry={reload}
            >
              <View style={{ gap: spacing.sm }}>
                {objectives.map((o) => (
                  <Card
                    key={o.id}
                    style={{
                      borderColor: o.status === 'active' ? theme.roleColors.coach : palette.line,
                      opacity: o.status === 'archived' ? 0.6 : 1,
                    }}
                  >
                    <View style={s.objHead}>
                      <Text style={s.objTitle}>{o.title}</Text>
                      <Text style={s.objStatus}>{STATUS_LABEL[o.status]}</Text>
                    </View>
                    <Text style={s.objTarget}>{objectiveTargetLabel(o)}</Text>
                    {o.detail ? <Text style={s.objDetail}>{o.detail}</Text> : null}
                    {o.status === 'active' ? (
                      <View style={s.objActions}>
                        <RowAction
                          label="Marquer atteint"
                          onPress={() => onStatus(o, 'achieved')}
                        />
                        <RowAction label="Archiver" onPress={() => onStatus(o, 'archived')} />
                      </View>
                    ) : null}
                  </Card>
                ))}
              </View>
            </StateWrapper>
          </View>

          {/* Création d'un objectif */}
          {pilotId ? (
            <View style={{ marginTop: spacing.xxl }}>
              <View style={{ marginBottom: spacing.md }}>
                <SectionLabel>NOUVEL OBJECTIF</SectionLabel>
              </View>
              <Field
                label="Intitulé"
                value={title}
                onChangeText={setTitle}
                placeholder="Ce que vous visez avec ce pilote."
                maxLength={120}
              />

              <Text style={[s.fieldLabel, { marginTop: spacing.lg }]}>Métrique</Text>
              <View style={s.pillWrap}>
                {METRICS.map((m) => (
                  <Selectable
                    key={m}
                    label={METRIC_LABEL[m]}
                    active={metric === m}
                    onPress={() => setMetric(m)}
                  />
                ))}
              </View>

              <Text style={[s.fieldLabel, { marginTop: spacing.lg }]}>Direction de la cible</Text>
              <View style={s.pillWrap}>
                {DIRECTIONS.map((d) => (
                  <Selectable
                    key={d.key}
                    label={d.label}
                    active={direction === d.key}
                    onPress={() => setDirection(d.key)}
                  />
                ))}
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Field
                  label="Valeur cible (optionnel)"
                  value={targetText}
                  onChangeText={setTargetText}
                  placeholder="Un chiffre, ou laissez vide."
                  keyboardType="numeric"
                  optional
                />
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Button
                  label={saving ? 'Enregistrement…' : 'Assigner l’objectif'}
                  onPress={onCreate}
                  disabled={saving || !title.trim()}
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function isoNow(): string {
  return new Date().toISOString();
}

function RowAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [s.action, pressed && { opacity: 0.6 }]}
    >
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}

function Selectable({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.pill, active ? s.pillOn : null, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={[s.pillText, active ? s.pillTextOn : null]}>{label}</Text>
    </Pressable>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: palette.creamSoft,
    marginTop: spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  pillWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card2,
  },
  pillOn: { borderColor: theme.roleColors.coach, backgroundColor: 'rgba(255,255,255,0.06)' },
  pillText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  pillTextOn: { color: palette.cream },
  objHead: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing.md,
  },
  objTitle: {
    flex: 1,
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: palette.cream,
  },
  objStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
  objTarget: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: palette.gold,
    marginTop: spacing.xs,
  },
  objDetail: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  objActions: {
    flexDirection: 'row' as const,
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  action: { minHeight: 32, justifyContent: 'center' as const },
  actionText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: palette.creamMute,
  },
};
