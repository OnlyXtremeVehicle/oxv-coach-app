/**
 * Espace Coach — détail d'un programme (C-2). Édition en-tête + axes + partage.
 *
 * Le coach façonne le programme : intention, axes (focus/note), statut observé
 * (en_cours/atteint), partage au pilote. Le statut « atteint » est l'observation
 * du coach, jamais un score. Partager un contenu prescriptif est refusé (trigger
 * DB + garde app). Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  type CycleStep,
  type DevelopmentCycle,
  addStep,
  deleteCycle,
  deleteStep,
  getCycle,
  listSteps,
  updateCycle,
  updateStep,
} from '@/services/developmentCycleService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

export default function CoachCycleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cycle, setCycle] = useState<DevelopmentCycle | null>(null);
  const [steps, setSteps] = useState<CycleStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getCycle(id), listSteps(id)]).then(([c, st]) => {
      if (!cancelled) {
        setCycle(c);
        setSteps(st);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(reload);

  async function onToggleShare(next: boolean) {
    if (!cycle) return;
    setError(null);
    const res = await updateCycle(cycle.id, { isShared: next });
    if (res.ok) {
      setCycle({ ...cycle, isShared: next });
    } else {
      setError(
        next
          ? 'Partage refusé : un axe ou l’intention contient une formulation prescriptive.'
          : (res.error ?? 'Action impossible.')
      );
    }
  }

  async function onToggleStatus() {
    if (!cycle) return;
    const next = cycle.status === 'active' ? 'closed' : 'active';
    const res = await updateCycle(cycle.id, { status: next });
    if (res.ok) setCycle({ ...cycle, status: next });
  }

  async function onAddStep() {
    if (!id || saving || !focus.trim()) return;
    setSaving(true);
    setError(null);
    const res = await addStep(id, { focus, note: note || undefined, position: steps.length });
    setSaving(false);
    if (res.ok) {
      setFocus('');
      setNote('');
      reload();
    } else {
      setError(
        cycle?.isShared
          ? 'Cet axe contient une formulation prescriptive (programme partagé).'
          : (res.error ?? 'Ajout impossible.')
      );
    }
  }

  async function onToggleStepStatus(step: CycleStep) {
    const next = step.status === 'en_cours' ? 'atteint' : 'en_cours';
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: next } : s)));
    const res = await updateStep(step.id, { status: next });
    if (!res.ok) reload();
  }

  function onDeleteStep(step: CycleStep) {
    Alert.alert('Supprimer cet axe', 'Cet axe sera effacé.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteStep(step.id);
          if (res.ok) reload();
        },
      },
    ]);
  }

  function onDeleteCycle() {
    if (!cycle) return;
    Alert.alert('Supprimer le programme', 'Le programme et ses axes seront effacés.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteCycle(cycle.id);
          if (res.ok) router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <AppBar title="PROGRAMME" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {loading || !cycle ? (
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Programme introuvable.'}</Text>
        ) : (
          <>
            <Text style={s.title} accessibilityRole="header">
              {cycle.title}
            </Text>
            {cycle.intention ? <Text style={s.intention}>{cycle.intention}</Text> : null}

            <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
              <View style={s.shareRow}>
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={s.rowLabel}>Partager au pilote</Text>
                  <Text style={s.caption}>
                    Le pilote ne voit le programme qu&apos;une fois partagé.
                  </Text>
                </View>
                <Switch
                  value={cycle.isShared}
                  onValueChange={onToggleShare}
                  accessibilityRole="switch"
                  accessibilityLabel="Partager le programme au pilote"
                  accessibilityState={{ checked: cycle.isShared }}
                  trackColor={{ false: '#26262B', true: theme.palette.coach }}
                  thumbColor={theme.palette.cream}
                />
              </View>
              <Button
                label={cycle.status === 'active' ? 'Clôturer le cycle' : 'Réactiver le cycle'}
                variant="ghost"
                onPress={onToggleStatus}
              />
            </Card>

            {error ? (
              <Text
                style={[s.error, { marginTop: theme.spacing.md }]}
                accessibilityLiveRegion="polite"
              >
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: theme.spacing.xxl, gap: theme.spacing.sm }}>
              <SectionLabel>{`Axes (${steps.length})`}</SectionLabel>
              {steps.map((step) => (
                <Card key={step.id} style={{ gap: theme.spacing.sm }}>
                  <Text style={s.focus}>{step.focus}</Text>
                  {step.note ? <Text style={s.caption}>{step.note}</Text> : null}
                  <View style={s.shareRow}>
                    <Text style={s.statusLabel}>
                      {step.status === 'atteint' ? 'Atteint' : 'En cours'}
                    </Text>
                    <Switch
                      value={step.status === 'atteint'}
                      onValueChange={() => onToggleStepStatus(step)}
                      accessibilityRole="switch"
                      accessibilityLabel="Marquer l'axe atteint"
                      accessibilityState={{ checked: step.status === 'atteint' }}
                      trackColor={{ false: '#26262B', true: theme.palette.gold }}
                      thumbColor={theme.palette.cream}
                    />
                  </View>
                  <Button
                    label="Supprimer l'axe"
                    variant="ghost"
                    onPress={() => onDeleteStep(step)}
                  />
                </Card>
              ))}
            </View>

            <Card style={{ marginTop: theme.spacing.lg, gap: theme.spacing.md }}>
              <SectionLabel>Nouvel axe</SectionLabel>
              <Field label="Focus" value={focus} onChangeText={setFocus} maxLength={500} />
              <Field
                label="Note"
                optional
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
              />
              <Button
                label="Ajouter l'axe"
                onPress={onAddStep}
                loading={saving}
                disabled={!focus.trim()}
              />
            </Card>

            <View style={{ marginTop: theme.spacing.xxl }}>
              <Button label="Supprimer le programme" variant="ghost" onPress={onDeleteCycle} />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.sm,
  },
  intention: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.body * 1.5,
    marginTop: theme.spacing.sm,
  },
  shareRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  rowLabel: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  focus: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
  },
  statusLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  caption: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.45,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
