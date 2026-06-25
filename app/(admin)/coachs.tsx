/**
 * Vue Admin — Liste des coachs OXV.
 *
 * Affiche tous les users role='coach' avec leur nombre d'assignations
 * actives. Tap un coach → écran de gestion de ses assignations.
 *
 * Promotion pilote → coach : depuis l'écran Préparation (bouton « ↦ coach »,
 * avec confirmation explicite Alert). Rétrogradation coach → pilote : ici
 * même, avec garde-fou (refus si le coach a des assignations actives).
 *
 * Reskin V2 : Screen + AppBar, Card. Accent bronze conservé (couleur de
 * rôle admin). Logique inchangée.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Link, router } from 'expo-router';

import { type CoachRow, demoteToPilot, listCoaches } from '@/services/coachAdminService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
const BRONZE = '#B87333';

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
    <Screen>
      <AppBar title="COACHS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>ADMIN OXV · COACHS</Text>
        <Text style={s.title} accessibilityRole="header">
          Les coachs
        </Text>
        <Text style={s.lede}>Un toucher ouvre la gestion des pilotes assignés.</Text>

        {loading ? (
          <Text style={s.loading}>Chargement…</Text>
        ) : coaches.length === 0 ? (
          <EmptyState />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} onDemote={() => confirmDemote(coach)} />
            ))}
          </View>
        )}
      </View>
    </Screen>
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

  const blocked = coach.activeAssignmentsCount > 0;

  return (
    <Card style={s.row}>
      <Link href={{ pathname: '/(admin)/coachs/[id]', params: { id: coach.id } } as never} asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${fullName}, ${assignText}. Ouvrir la gestion des pilotes assignés.`}
          hitSlop={theme.hitSlop}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.85 : 1 })}
        >
          <View style={s.nameBlock}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{fullName}</Text>
              <Text style={s.meta}>
                {coach.email} · {assignText}
              </Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </View>
        </Pressable>
      </Link>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Rétrograder ${fullName} en pilote`}
        accessibilityHint={blocked ? 'Indisponible : ce coach a des pilotes actifs.' : undefined}
        accessibilityState={{ disabled: blocked }}
        onPress={onDemote}
        hitSlop={theme.hitSlop}
        style={({ pressed }) => ({
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radius.sm,
          borderWidth: 1,
          borderColor: theme.palette.edge,
          opacity: pressed ? 0.85 : blocked ? 0.4 : 1,
        })}
      >
        <Text style={s.demote}>Rétrograder</Text>
      </Pressable>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
      <Text style={s.emptyTitle}>Aucun coach pour l&apos;instant.</Text>
      <Text style={s.emptyHint}>
        Pour ajouter un coach : Dashboard Supabase → SQL → UPDATE users SET role = &apos;coach&apos;
        WHERE id = &apos;...&apos;
      </Text>
    </Card>
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
    marginTop: theme.spacing.md,
  },
  lede: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xxl,
  },
  loading: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    paddingVertical: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  nameBlock: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  chevron: {
    color: theme.palette.faint,
    fontSize: 17,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  demote: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.3,
    color: theme.palette.creamSoft,
  },
  emptyTitle: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  emptyHint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.md,
    lineHeight: theme.fontSize.small * 1.5,
  },
};
