/**
 * Écran #31 — Objectifs personnels du pilote.
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import {
  type GoalStatus,
  type PilotGoal,
  createGoal,
  listMyGoals,
  updateGoalStatus,
} from '@/services/pilotGoalsService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateShort } from '@/utils/format';

export default function ObjectifsScreen() {
  const [goals, setGoals] = useState<PilotGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setGoals(await listMyGoals());
    setLoading(false);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
          <Text style={[typography.eyebrow, { color: colors.text.tertiary }]}>OBJECTIFS</Text>
          <Text
            style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}
          >
            Ce que vous vous donnez.
          </Text>
          <Text
            style={[
              typography.manifest,
              { color: colors.text.secondary, marginBottom: spacing.xxl },
            ]}
          >
            Un mot. Pas une consigne.
          </Text>

          {/* Objectif actif */}
          {loading ? (
            <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
          ) : activeGoal ? (
            <View
              style={{
                padding: spacing.xl,
                borderRadius: borderRadius.lg,
                borderWidth: 1,
                borderColor: colors.text.primary,
                backgroundColor: colors.background.secondary,
                marginBottom: spacing.xxl,
              }}
            >
              <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>
                OBJECTIF EN COURS
              </Text>
              <Text
                style={{
                  color: colors.text.primary,
                  fontSize: fontSize.bodyLarge,
                  fontWeight: fontWeight.light,
                  fontStyle: 'italic',
                  lineHeight: fontSize.bodyLarge * 1.6,
                  marginBottom: spacing.lg,
                }}
              >
                « {activeGoal.body} »
              </Text>
              <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                Donné le {formatDateShort(activeGoal.createdAt)}
              </Text>

              {/* Boutons auto-évaluation */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.xs,
                  marginTop: spacing.lg,
                }}
              >
                <EvalBtn
                  label="Atteint"
                  color={colors.margin.green}
                  onPress={() => onUpdate(activeGoal.id, 'achieved')}
                />
                <EvalBtn
                  label="À continuer"
                  color={colors.margin.yellow}
                  onPress={() => onUpdate(activeGoal.id, 'continued')}
                />
                <EvalBtn
                  label="Lâché"
                  color={colors.text.tertiary}
                  onPress={() => onUpdate(activeGoal.id, 'abandoned')}
                />
              </View>
            </View>
          ) : null}

          {/* Saisie nouvel objectif */}
          <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>
            {activeGoal ? 'REMPLACER PAR' : 'PROCHAIN OBJECTIF'}
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Apprivoiser l'épingle Sud."
            placeholderTextColor={colors.text.tertiary}
            multiline
            numberOfLines={3}
            maxLength={200}
            style={{
              backgroundColor: colors.background.secondary,
              borderRadius: borderRadius.md,
              borderWidth: 0.5,
              borderColor: colors.border.subtle,
              padding: spacing.md,
              color: colors.text.primary,
              fontSize: fontSize.body,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
          />
          <Text
            style={[
              typography.caption,
              { color: colors.text.tertiary, textAlign: 'right', marginTop: spacing.xs },
            ]}
          >
            {body.length} / 200
          </Text>

          <Pressable
            accessibilityRole="button"
            disabled={saving || !body.trim()}
            onPress={onCreate}
            style={({ pressed }) => ({
              marginTop: spacing.lg,
              padding: spacing.lg,
              borderRadius: borderRadius.md,
              backgroundColor: !body.trim()
                ? colors.background.secondary
                : colors.background.elevated,
              borderWidth: 0.5,
              borderColor: !body.trim() ? colors.border.subtle : colors.text.primary,
              alignItems: 'center',
              opacity: pressed ? 0.85 : !body.trim() ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                color: colors.text.primary,
                fontSize: fontSize.body,
                fontWeight: fontWeight.semibold,
              }}
            >
              {activeGoal ? "Remplacer l'objectif" : 'Se donner cet objectif'}
            </Text>
          </Pressable>

          {/* Historique */}
          {pastGoals.length > 0 ? (
            <View style={{ marginTop: spacing.huge }}>
              <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>
                CE QUE VOUS VOUS ÊTES DONNÉ
              </Text>
              <View style={{ gap: spacing.xs }}>
                {pastGoals.map((g) => (
                  <View
                    key={g.id}
                    style={{
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      borderWidth: 0.5,
                      borderColor: colors.border.subtle,
                      backgroundColor: colors.background.secondary,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        marginBottom: spacing.xs,
                      }}
                    >
                      <Text style={[typography.eyebrow, { color: colorForStatus(g.status) }]}>
                        {labelForStatus(g.status)}
                      </Text>
                      <Text style={[typography.caption, { color: colors.text.tertiary }]}>
                        {formatDateShort(g.createdAt)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.text.secondary,
                        fontSize: fontSize.body,
                        fontStyle: 'italic',
                      }}
                    >
                      « {g.body} »
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => router.back()}>
              <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                Retour
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EvalBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: color,
        alignItems: 'center',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color, fontSize: fontSize.caption, fontWeight: fontWeight.medium }}>
        {label}
      </Text>
    </Pressable>
  );
}

function colorForStatus(status: GoalStatus): string {
  switch (status) {
    case 'achieved':
      return colors.margin.green;
    case 'continued':
      return colors.margin.yellow;
    case 'abandoned':
      return colors.text.tertiary;
    default:
      return colors.text.primary;
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
