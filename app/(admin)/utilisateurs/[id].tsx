/**
 * Admin — fiche utilisateur : rôle (audité), suspension, consentements, notes (PR-12).
 *
 * Le changement de rôle est tracé dans admin_audit (trigger 0015) ; on confirme
 * avant d'agir. Admin-only (RLS). Bronze = rôle admin ; rouge = action de
 * suspension (surface admin), jamais une donnée pilote.
 */

import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import {
  USER_ROLES,
  type AdminUserDetail,
  getUserDetail,
  roleLabel,
  setAdminNotes,
  setSuspended,
  setUserRole,
} from '@/services/adminUsersService';
import type { UserRole } from '@/store/useAuthStore';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';

const BRONZE = '#B87333';

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminUserDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');

  const reload = useCallback(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getUserDetail(id).then((u) => {
      if (!cancelled) {
        setUser(u);
        setNotes(u?.adminNotes ?? '');
        setReason(u?.suspensionReason ?? '');
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(reload);

  function confirmRole(role: UserRole) {
    if (!id || !user || role === user.role) return;
    Alert.alert(
      'Changer le rôle',
      `Attribuer le rôle « ${roleLabel(role)} » à ce compte ? Ce changement est tracé dans le journal d'audit.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setBusy(true);
            const res = await setUserRole(id, role);
            setBusy(false);
            if (res.ok) reload();
            else Alert.alert('Rôle', res.error ?? 'Changement impossible.');
          },
        },
      ]
    );
  }

  function confirmSuspend() {
    if (!id || !user) return;
    const suspending = !user.suspendedAt;
    Alert.alert(
      suspending ? 'Suspendre le compte' : 'Réactiver le compte',
      suspending
        ? 'Le compte ne pourra plus accéder à ses données tant qu’il est suspendu.'
        : 'Le compte retrouvera son accès.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: suspending ? 'Suspendre' : 'Réactiver',
          style: suspending ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            const res = await setSuspended(id, suspending, reason);
            setBusy(false);
            if (res.ok) reload();
            else Alert.alert('Suspension', res.error ?? 'Action impossible.');
          },
        },
      ]
    );
  }

  async function onSaveNotes() {
    if (!id || busy) return;
    setBusy(true);
    const res = await setAdminNotes(id, notes);
    setBusy(false);
    if (!res.ok) Alert.alert('Notes', res.error ?? 'Enregistrement impossible.');
    else reload();
  }

  if (loading || !user) {
    return (
      <Screen>
        <AppBar title="COMPTE" onBack={() => router.back()} />
        <View style={{ padding: theme.spacing.lg }}>
          <Text style={s.muted}>{loading ? 'Chargement…' : 'Compte introuvable.'}</Text>
        </View>
      </Screen>
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

  return (
    <Screen>
      <AppBar title="COMPTE" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.name} accessibilityRole="header">
          {name}
        </Text>
        <Text style={s.email}>{user.email}</Text>
        <Text style={s.metaLine}>
          Inscrit le {fmt(user.createdAt)} · Dernière connexion {fmt(user.lastLoginAt)}
        </Text>
        {user.deletionScheduledAt ? (
          <Text style={s.warn}>Suppression programmée le {fmt(user.deletionScheduledAt)}</Text>
        ) : null}

        {/* Rôle (audité) */}
        <View style={s.block}>
          <SectionLabel>Rôle</SectionLabel>
          <View style={s.pills}>
            {USER_ROLES.map((r) => {
              const on = user.role === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => confirmRole(r.value)}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: busy }}
                  accessibilityLabel={r.label}
                  hitSlop={6}
                  style={[s.pill, on ? s.pillOn : null]}
                >
                  <Text style={[s.pillTxt, on ? s.pillTxtOn : null]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.hint}>Tout changement de rôle est tracé dans le journal d'audit.</Text>
        </View>

        {/* Consentements */}
        <View style={s.block}>
          <SectionLabel>Consentements</SectionLabel>
          <Card>
            <ConsentRow label="Pacte de pilotage" at={user.pactAcceptedAt} />
            <ConsentRow label="Conditions générales" at={user.cguAcceptedAt} />
            <ConsentRow label="Confidentialité" at={user.privacyAcceptedAt} last />
          </Card>
        </View>

        {/* Suspension */}
        <View style={s.block}>
          <SectionLabel>Accès</SectionLabel>
          <Field
            label="Motif (suspension)"
            optional
            value={reason}
            onChangeText={setReason}
            maxLength={300}
            placeholder="Visible des admins uniquement"
          />
          <Button
            label={user.suspendedAt ? 'Réactiver le compte' : 'Suspendre le compte'}
            variant="ghost"
            onPress={confirmSuspend}
            disabled={busy}
          />
        </View>

        {/* Notes admin */}
        <View style={s.block}>
          <SectionLabel>Note interne</SectionLabel>
          <Field
            label="Note admin"
            optional
            value={notes}
            onChangeText={setNotes}
            maxLength={2000}
            multiline
            placeholder="Jamais visible du pilote."
          />
          <Button label="Enregistrer la note" onPress={onSaveNotes} loading={busy} />
        </View>
      </View>
    </Screen>
  );
}

function ConsentRow({ label, at, last }: { label: string; at: string | null; last?: boolean }) {
  return (
    <View style={[s.consentRow, last ? { borderBottomWidth: 0 } : null]}>
      <Text style={s.consentLabel}>{label}</Text>
      <Text style={[s.consentVal, !at ? { color: theme.palette.red } : null]}>
        {at ? fmt(at) : 'Non accepté'}
      </Text>
    </View>
  );
}

const s = {
  name: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
    marginTop: theme.spacing.sm,
  },
  email: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  metaLine: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.palette.faint,
    marginTop: theme.spacing.sm,
  },
  warn: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.red,
    marginTop: theme.spacing.sm,
  },
  block: {
    marginTop: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  pills: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
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
  hint: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.faint,
    lineHeight: theme.fontSize.small * 1.5,
  },
  consentRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.line,
  },
  consentLabel: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  consentVal: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    color: theme.palette.cream,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    color: theme.palette.creamMute,
  },
};
