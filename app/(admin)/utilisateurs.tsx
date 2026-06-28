/**
 * Admin — Utilisateurs : annuaire + accès à la gestion de rôle auditée (PR-12).
 *
 * Recherche (email/nom), filtre par rôle. Tap → fiche (rôle, suspension,
 * consentements, notes). Admin-only (RLS). Bronze = rôle admin.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments/EmptyState';
import { USER_ROLES, type AdminUser, listUsers, roleLabel } from '@/services/adminUsersService';
import type { UserRole } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';

const BRONZE = '#B87333';

function fullName(u: AdminUser): string {
  const n = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return n.length > 0 ? n : u.email;
}

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null);
  const [search, setSearch] = useState('');

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    listUsers(roleFilter ?? undefined).then((rows) => {
      if (!cancelled) {
        setUsers(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roleFilter]);

  useFocusEffect(reload);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [users, search]);

  return (
    <Screen>
      <AppBar title="UTILISATEURS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={[s.eyebrow, { color: BRONZE }]}>ANNUAIRE</Text>
        <Text style={s.title} accessibilityRole="header">
          Les comptes.
        </Text>

        <View style={{ marginTop: theme.spacing.md }}>
          <Field
            label="Rechercher"
            value={search}
            onChangeText={setSearch}
            placeholder="Email ou nom"
          />
        </View>

        <View style={s.pills}>
          <RolePill label="Tous" active={roleFilter === null} onPress={() => setRoleFilter(null)} />
          {USER_ROLES.map((r) => (
            <RolePill
              key={r.value}
              label={r.label}
              active={roleFilter === r.value}
              onPress={() => setRoleFilter(r.value)}
            />
          ))}
        </View>

        <View style={{ marginTop: theme.spacing.lg, gap: theme.spacing.sm }}>
          {!loading && filtered.length === 0 ? (
            <EmptyState
              label="Aucun compte"
              message="Aucun compte pour ces critères."
              source="users"
            />
          ) : (
            filtered.map((u) => (
              <Card
                key={u.id}
                onPress={() => router.push(`/(admin)/utilisateurs/${u.id}` as never)}
                accessibilityLabel={`${fullName(u)}, ${roleLabel(u.role)}`}
              >
                <View style={s.top}>
                  <Text style={s.name}>{fullName(u)}</Text>
                  <Text style={s.role}>{roleLabel(u.role)}</Text>
                </View>
                <Text style={s.email}>{u.email}</Text>
                {u.suspendedAt ? <Text style={s.suspended}>Compte suspendu</Text> : null}
              </Card>
            ))
          )}
        </View>
      </View>
    </Screen>
  );
}

function RolePill({
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
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      hitSlop={6}
      style={[s.pill, active ? s.pillOn : null]}
    >
      <Text style={[s.pillTxt, active ? s.pillTxtOn : null]}>{label}</Text>
    </Pressable>
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
    lineHeight: theme.fontSize.h2 * 1.25,
    marginTop: theme.spacing.md,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    minHeight: 38,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.palette.line,
    backgroundColor: theme.palette.card2,
  },
  pillOn: {
    borderColor: BRONZE,
    backgroundColor: 'rgba(184,115,51,0.12)',
  },
  pillTxt: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  pillTxtOn: {
    color: theme.palette.cream,
  },
  top: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: theme.spacing.xs,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.body,
    color: theme.palette.cream,
    flex: 1,
    paddingRight: theme.spacing.md,
  },
  role: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: BRONZE,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  suspended: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.red,
    marginTop: theme.spacing.xs,
  },
};
