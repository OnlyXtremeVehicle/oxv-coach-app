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
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Bronze = couleur de RÔLE réservée à l'admin (doctrine).
// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';

export default function AdminCoachsScreen() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = await listCoaches();
      setCoaches(rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listCoaches()
      .then((rows) => {
        if (!cancelled) setCoaches(rows);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : coaches.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="COACHS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN OXV · COACHS</Text>
        <Text style={s.title} accessibilityRole="header">
          Les coachs
        </Text>
        <Text style={s.lede}>Un toucher ouvre la gestion des pilotes assignés.</Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucun coach pour l'instant."
          // L'ÉTAT VIDE DÉLIVRAIT UNE INSTRUCTION SQL de console Supabase, alors
          // que l'application sait faire ce geste : `preparation.tsx` promeut un
          // pilote en coach depuis son écran. Envoyer un administrateur écrire
          // un UPDATE à la main, c'est lui faire contourner toutes les gardes
          // que le code pose autour de ce changement de rôle.
          emptyMessage="Aucun coach pour l'instant. Un pilote se promeut en coach depuis l'écran Préparation."
          errorCause="La liste des coachs n'a pas pu être chargée."
          onRetry={() => setReloadKey((k) => k + 1)}
        >
          <View style={{ gap: theme.spacing.sm }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} onDemote={() => confirmDemote(coach)} />
            ))}
          </View>
        </StateWrapper>
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

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: ADMIN,
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
};
