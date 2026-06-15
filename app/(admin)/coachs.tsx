/**
 * Vue Admin — Liste des coachs OXV.
 *
 * Affiche tous les users role='coach' avec leur nombre d'assignations
 * actives. Tap un coach → écran de gestion de ses assignations.
 *
 * Promotion pilote → coach : depuis l'écran Préparation (bouton « ↦ coach »,
 * avec confirmation explicite Alert). Rétrogradation coach → pilote : ici
 * même, avec garde-fou (refus si le coach a des assignations actives).
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';

import { type CoachRow, demoteToPilot, listCoaches } from '@/services/coachAdminService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function AdminCoachsScreen() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const rows = await listCoaches();
    setCoaches(rows);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    listCoaches().then((rows) => {
      if (!cancelled) {
        setCoaches(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function confirmDemote(coach: CoachRow) {
    const name = [coach.firstName, coach.lastName].filter(Boolean).join(' ') || coach.email;
    if (coach.activeAssignmentsCount > 0) {
      Alert.alert(
        'Coach actif',
        `${name} a ${coach.activeAssignmentsCount} assignation(s) active(s). Désactivez-les d'abord avant de rétrograder.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    Alert.alert('Rétrograder en pilote', `${name} perdra ses droits coach. Continuer ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Rétrograder',
        style: 'destructive',
        onPress: async () => {
          const result = await demoteToPilot(coach.id);
          if (result.ok) await reload();
          else Alert.alert('Échec', result.error ?? 'Erreur inconnue.');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { color: colors.accent.bronze }]}>
          ADMIN OXV · COACHS
        </Text>
        <Text style={[typography.screenTitle, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          Les coachs
        </Text>
        <Text
          style={[typography.caption, { color: colors.text.tertiary, marginBottom: spacing.xxl }]}
        >
          Un toucher ouvre la gestion des pilotes assignés.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : coaches.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} onDemote={() => confirmDemote(coach)} />
            ))}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CoachCard({ coach, onDemote }: { coach: CoachRow; onDemote: () => void }) {
  const fullName = [coach.firstName, coach.lastName].filter(Boolean).join(' ') || coach.email;
  const assignText =
    coach.activeAssignmentsCount === 0
      ? 'Aucun pilote'
      : coach.activeAssignmentsCount === 1
        ? '1 pilote actif'
        : `${coach.activeAssignmentsCount} pilotes actifs`;

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 0.5,
        borderColor: colors.border.subtle,
        backgroundColor: colors.background.secondary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Link href={{ pathname: '/(admin)/coachs/[id]', params: { id: coach.id } } as never} asChild>
        <Pressable style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            {fullName}
          </Text>
          <Text
            style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}
          >
            {coach.email} · {assignText}
          </Text>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        onPress={onDemote}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
          borderRadius: borderRadius.sm,
          borderWidth: 0.5,
          borderColor: colors.border.medium,
          opacity: pressed ? 0.85 : coach.activeAssignmentsCount > 0 ? 0.4 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.secondary,
            fontSize: 11,
            fontWeight: fontWeight.medium,
          }}
        >
          ↤ pilote
        </Text>
      </Pressable>
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
        Aucun coach pour l'instant.
      </Text>
      <Text
        style={[
          typography.caption,
          { color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md },
        ]}
      >
        Pour ajouter un coach : Dashboard Supabase → SQL → UPDATE users SET role = 'coach' WHERE id
        = '...'
      </Text>
    </View>
  );
}
