/**
 * Écran "Mon coach" — gestion du consentement RGPD au coaching.
 *
 * Le pilote voit ici les coachs qu'OXV lui a assignés. Pour chacun, il
 * peut consentir (autoriser le coach à voir ses sessions) ou retirer son
 * consentement (le coach cesse immédiatement de voir).
 *
 * Doctrine :
 *   - Le consentement est libre. L'app n'insiste pas, ne moralise pas.
 *   - Pas d'instruction à donner son accord — c'est strictement neutre.
 *   - Le pilote peut révoquer à tout moment, sans justification.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import * as haptics from '@/lib/haptics';
import {
  type MyCoachAssignment,
  giveConsent,
  listMyCoaches,
  revokeConsent,
} from '@/services/pilotConsentService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import { formatDateLong } from '@/utils/format';

export default function MonCoachScreen() {
  const [coaches, setCoaches] = useState<MyCoachAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const rows = await listMyCoaches();
    setCoaches(rows);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    listMyCoaches().then((rows) => {
      if (!cancelled) {
        setCoaches(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onToggle(assignment: MyCoachAssignment, next: boolean) {
    const result = next ? await giveConsent(assignment.id) : await revokeConsent(assignment.id);
    if (result.ok) {
      // Confirmation tactile : un consentement RGPD mérite un retour clair
      if (next) haptics.success();
      else haptics.tap();
      await reload();
    }
  }

  const activeAssignments = coaches.filter((c) => c.active);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.coach }]}>MON COACH</Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          Le regard d'un autre.
        </Text>
        <Text
          style={[typography.manifest, { color: colors.text.secondary, marginBottom: spacing.xxl }]}
        >
          Vous décidez qui voit vos sessions.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : activeAssignments.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: spacing.md }}>
            {activeAssignments.map((assignment) => (
              <CoachCard
                key={assignment.id}
                assignment={assignment}
                onToggle={(next) => onToggle(assignment, next)}
              />
            ))}
          </View>
        )}

        <ExplainerCard />

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>Retour</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CoachCard({
  assignment,
  onToggle,
}: {
  assignment: MyCoachAssignment;
  onToggle: (next: boolean) => void;
}) {
  const fullName =
    [assignment.coachFirstName, assignment.coachLastName].filter(Boolean).join(' ') ||
    assignment.coachEmail;
  const consented = assignment.pilotConsentAt !== null;
  const consentText = consented
    ? `Vous avez consenti le ${formatDateLong(assignment.pilotConsentAt!)}`
    : "Vous n'avez pas encore consenti";

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: consented ? colors.accent.coach : colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.lg }}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.title,
              fontWeight: fontWeight.light,
            }}
          >
            {fullName}
          </Text>
          <Text
            style={[
              typography.caption,
              {
                color: consented ? colors.margin.green : colors.text.tertiary,
                marginTop: spacing.sm,
              },
            ]}
          >
            {consentText}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
          >
            Assigné par OXV le {formatDateLong(assignment.createdAt)}
          </Text>
        </View>
        <Switch
          value={consented}
          onValueChange={onToggle}
          trackColor={{ false: colors.border.subtle, true: colors.accent.coach }}
          thumbColor={colors.text.primary}
        />
      </View>

      {assignment.notes ? (
        <Text
          style={[
            typography.caption,
            {
              color: colors.text.secondary,
              marginTop: spacing.md,
              fontStyle: 'italic',
              paddingTop: spacing.md,
              borderTopWidth: 0.5,
              borderTopColor: colors.border.subtle,
            },
          ]}
        >
          {assignment.notes}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyState() {
  return (
    <View
      style={{
        padding: spacing.xxl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        alignItems: 'center',
      }}
    >
      <Text style={[typography.manifest, { color: colors.text.secondary, textAlign: 'center' }]}>
        Aucun coach assigné.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Si l'équipe OXV vous assigne un coach, son nom apparaîtra ici. Vous resterez libre de
        consentir ou non au partage de vos données.
      </Text>
    </View>
  );
}

function ExplainerCard() {
  return (
    <View
      style={{
        marginTop: spacing.xxxl,
        padding: spacing.xl,
        borderRadius: borderRadius.lg,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
      }}
    >
      <Text style={[typography.eyebrow, { color: colors.text.tertiary, marginBottom: spacing.sm }]}>
        CE QUE LE COACH VOIT
      </Text>
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.light,
          lineHeight: fontSize.body * 1.6,
          marginBottom: spacing.md,
        }}
      >
        Quand vous consentez, votre coach voit vos sessions, vos analyses par virage, et votre
        progression. Il ne voit jamais votre email, votre téléphone ou vos documents.
      </Text>
      <Text
        style={{
          color: colors.text.secondary,
          fontSize: fontSize.body,
          fontWeight: fontWeight.light,
          lineHeight: fontSize.body * 1.6,
        }}
      >
        Vous pouvez retirer votre accord à tout moment. Le coach cessera immédiatement de voir vos
        données.
      </Text>
    </View>
  );
}
