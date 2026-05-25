/**
 * Vue Admin — Liste des coachs OXV.
 *
 * Affiche tous les users role='coach' avec leur nombre d'assignations
 * actives. Tap un coach → écran de gestion de ses assignations.
 *
 * Pour promouvoir un user en coach, passer par le Dashboard Supabase
 * (UPDATE users SET role = 'coach' WHERE id = ...). V1 n'expose pas
 * cette action dans l'app (sécurité : un admin pourrait promouvoir
 * par erreur).
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';

import { type CoachRow, listCoaches } from '@/services/coachAdminService';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';

export default function AdminCoachsScreen() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);

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
          Tap un coach pour gérer ses pilotes assignés.
        </Text>

        {loading ? (
          <Text style={[typography.caption, { paddingVertical: spacing.lg }]}>Chargement…</Text>
        ) : coaches.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </View>
        )}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CoachCard({ coach }: { coach: CoachRow }) {
  const fullName = [coach.firstName, coach.lastName].filter(Boolean).join(' ') || coach.email;
  const assignText =
    coach.activeAssignmentsCount === 0
      ? 'Aucun pilote'
      : coach.activeAssignmentsCount === 1
        ? '1 pilote actif'
        : `${coach.activeAssignmentsCount} pilotes actifs`;

  return (
    <Link href={{ pathname: '/(admin)/coachs/[id]', params: { id: coach.id } } as never} asChild>
      <Pressable
        style={({ pressed }) => ({
          padding: spacing.lg,
          borderRadius: borderRadius.md,
          borderWidth: 0.5,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={{
            color: colors.text.primary,
            fontSize: fontSize.body,
            fontWeight: fontWeight.regular,
          }}
        >
          {fullName}
        </Text>
        <Text style={[typography.caption, { color: colors.text.tertiary, marginTop: spacing.xs }]}>
          {coach.email} · {assignText}
        </Text>
      </Pressable>
    </Link>
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
