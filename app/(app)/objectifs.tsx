/**
 * Écran #31 — Objectifs personnels du pilote. Design V2 (charte oxv-mirror-app).
 *
 * Le pilote se fixe un objectif sobre avant une session. L'app le
 * conserve, l'affiche, mais ne le juge pas. Auto-évaluation libre
 * après : atteint / à continuer / lâcher.
 *
 * Doctrine OXV :
 *   - Pas d'objectif imposé par l'app
 *   - Pas de score, pas de gamification
 *   - Un seul objectif actif à la fois (auto-archivage des anciens)
 *   - Coach ne voit RIEN (espace intime du pilote, cf. migration 0023)
 *
 * Placeholder texte d'exemple sobre : « Apprivoiser l'épingle Sud. »
 * Reskin V2 : Screen + AppBar, Card/SectionLabel, logique inchangée.
 */

import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import {
  type GoalStatus,
  type PilotGoal,
  createGoal,
  listMyGoals,
  updateGoalStatus,
} from '@/services/pilotGoalsService';
import { theme } from '@/theme/v2';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateShort } from '@/utils/format';

export default function ObjectifsScreen() {
  const [goals, setGoals] = useState<PilotGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setGoals(await listMyGoals());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const activeGoal = goals.find((g) => g.status === 'active') ?? null;
  const pastGoals = goals.filter((g) => g.status !== 'active');

  const onCreate = async () => {
    if (!body.trim()) return;
    setSaving(true);
    await createGoal(body);
    setBody('');
    await reload();
    setSaving(false);
  };

  const onUpdate = async (id: string, status: GoalStatus) => {
    await updateGoalStatus(id, status);
    await reload();
  };

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          <Text style={s.eyebrow}>OBJECTIFS</Text>
          <Text style={s.title}>Ce que vous vous donnez.</Text>
          <Text style={s.manifest}>Un mot. Pas une consigne.</Text>

          {/* Objectif actif */}
          {loading ? (
            <Text style={[s.meta, { paddingVertical: theme.spacing.lg }]}>Chargement…</Text>
          ) : activeGoal ? (
            <Card style={{ borderColor: theme.palette.edge, marginTop: theme.spacing.xxl }}>
              <SectionLabel>Objectif en cours</SectionLabel>
              <Text style={s.activeBody}>« {activeGoal.body} »</Text>
              <Text style={s.meta}>Donné le {formatDateShort(activeGoal.createdAt)}</Text>

              {/* Boutons auto-évaluation */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: theme.spacing.sm,
                  marginTop: theme.spacing.lg,
                }}
              >
                <EvalBtn
                  label="Atteint"
                  color={theme.dataColors.accel}
                  onPress={() => onUpdate(activeGoal.id, 'achieved')}
                />
                <EvalBtn
                  label="À continuer"
                  color={theme.palette.gold}
                  onPress={() => onUpdate(activeGoal.id, 'continued')}
                />
                <EvalBtn
                  label="Lâché"
                  color={theme.palette.creamMute}
                  onPress={() => onUpdate(activeGoal.id, 'abandoned')}
                />
              </View>
            </Card>
          ) : null}

          {/* Saisie nouvel objectif */}
          <View style={{ marginTop: theme.spacing.xxl }}>
            <SectionLabel>{activeGoal ? 'Remplacer par' : 'Prochain objectif'}</SectionLabel>
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Apprivoiser l'épingle Sud."
            placeholderTextColor={theme.palette.creamMute}
            multiline
            numberOfLines={3}
            maxLength={200}
            style={s.input}
          />
          <Text style={[s.meta, { textAlign: 'right', marginTop: theme.spacing.xs }]}>
            {body.length} / 200
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={saving || !body.trim()}
            onPress={onCreate}
            style={({ pressed }) => [
              s.submit,
              !body.trim() ? s.submitDisabled : s.submitActive,
              { opacity: pressed ? 0.85 : !body.trim() ? 0.5 : 1 },
            ]}
          >
            <Text style={s.submitTxt}>
              {activeGoal ? "Remplacer l'objectif" : 'Se donner cet objectif'}
            </Text>
          </Pressable>

          {/* Historique */}
          {pastGoals.length > 0 ? (
            <View style={{ marginTop: theme.spacing.xxl }}>
              <SectionLabel>Ce que vous vous êtes donné</SectionLabel>
              <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
                {pastGoals.map((g) => (
                  <Card key={g.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: theme.spacing.xs,
                      }}
                    >
                      <Text style={[s.statusTag, { color: colorForStatus(g.status) }]}>
                        {labelForStatus(g.status)}
                      </Text>
                      <Text style={s.meta}>{formatDateShort(g.createdAt)}</Text>
                    </View>
                    <Text style={s.pastBody}>« {g.body} »</Text>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: theme.spacing.xxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={s.backLink}>Retour</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function EvalBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: color,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color,
          fontFamily: theme.fonts.mono,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function colorForStatus(status: GoalStatus): string {
  switch (status) {
    case 'achieved':
      return theme.dataColors.accel;
    case 'continued':
      return theme.palette.gold;
    case 'abandoned':
      return theme.palette.creamMute;
    default:
      return theme.palette.cream;
  }
}

function labelForStatus(status: GoalStatus): string {
  switch (status) {
    case 'achieved':
      return 'ATTEINT';
    case 'continued':
      return 'À CONTINUER';
    case 'abandoned':
      return 'LÂCHÉ';
    default:
      return 'EN COURS';
  }
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h2,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h2 * 1.25,
  },
  manifest: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.creamSoft,
    marginTop: theme.spacing.md,
  },
  activeBody: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    lineHeight: theme.fontSize.bodyLg * 1.6,
    color: theme.palette.cream,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  input: {
    backgroundColor: theme.palette.card2,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    padding: theme.spacing.md,
    color: theme.palette.cream,
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    marginTop: theme.spacing.sm,
  },
  submit: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center' as const,
  },
  submitActive: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.edge,
  },
  submitDisabled: {
    backgroundColor: theme.palette.card2,
    borderColor: theme.palette.line,
  },
  submitTxt: {
    color: theme.palette.cream,
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  statusTag: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: 'uppercase' as const,
  },
  pastBody: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.body,
    fontStyle: 'italic' as const,
    color: theme.palette.creamSoft,
  },
  backLink: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    color: theme.palette.creamMute,
  },
};
