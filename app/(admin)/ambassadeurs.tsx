/**
 * Admin — Ambassadeurs (PR-77).
 *
 * Liste des candidatures ambassadeur ; l'admin active ou révoque. Le statut n'est
 * modifiable que par un admin (RLS + trigger). Aucun classement : un rôle factuel.
 * Bronze = couleur de rôle admin. Doctrine : sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import * as haptics from '@/lib/haptics';
import {
  type AdminAmbassador,
  type AmbassadorStatus,
  listAmbassadors,
  setAmbassadorStatus,
} from '@/services/ambassadorService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { RoleBadge } from '@/ui/RoleBadge';
import { Screen } from '@/ui/Screen';
import { StateWrapper, type ScreenState } from '@/ui/StateWrapper';

// Cyan = identité de rôle admin (canon fondateur 2026-07-06, ex-bronze).
const ADMIN = '#22D3EE';
const STATUS_LABEL: Record<AmbassadorStatus, string> = {
  pending: 'En attente',
  active: 'Actif',
  revoked: 'Révoqué',
};

export default function AdminAmbassadeursScreen() {
  const [rows, setRows] = useState<AdminAmbassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    listAmbassadors()
      .then((r) => {
        // Ordre d'arrivée (created_at desc, depuis la requête). Pas de tri par statut :
        // un rôle factuel, jamais une hiérarchie.
        if (!cancelled) {
          setRows(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(reload, [reload]);

  async function onSet(a: AdminAmbassador, status: AmbassadorStatus) {
    setBusy(a.id);
    const res = await setAmbassadorStatus(a.id, status);
    setBusy(null);
    if (res.ok) {
      haptics.success();
      reload();
    } else {
      Toast.show({ type: 'error', text1: res.error ?? 'Échec.' });
    }
  }

  const state: ScreenState = loading
    ? 'loading'
    : error
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : 'nominal';

  return (
    <Screen>
      <AppBar title="AMBASSADEURS" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <View style={{ marginBottom: theme.spacing.md }}>
          <RoleBadge role="admin" />
        </View>
        <Text style={s.eyebrow}>ADMIN · COMMUNAUTÉ</Text>
        <Text style={s.title} accessibilityRole="header">
          Candidatures
        </Text>

        <StateWrapper
          state={state}
          skeletonLines={5}
          emptyLabel="Aucune candidature"
          emptyMessage="Les candidatures ambassadeur apparaîtront ici."
          emptySource="ambassador_profiles"
          errorCause="La liste des candidatures n'a pas pu être chargée."
          onRetry={reload}
        >
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            {rows.map((a) => (
              <Card
                key={a.id}
                style={{ borderColor: a.status === 'pending' ? ADMIN : theme.palette.line }}
              >
                <View style={s.rowBetween}>
                  <Text style={s.name} numberOfLines={1}>
                    {a.pilotName}
                  </Text>
                  <Text style={s.status}>{STATUS_LABEL[a.status].toUpperCase()}</Text>
                </View>
                {a.bio ? (
                  <Text style={s.bio} numberOfLines={3}>
                    {a.bio}
                  </Text>
                ) : null}
                <View style={s.actions}>
                  {a.status !== 'active' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Activer ${a.pilotName}`}
                      accessibilityState={{ busy: busy === a.id }}
                      disabled={busy === a.id}
                      hitSlop={6}
                      onPress={() => onSet(a, 'active')}
                      style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.actionT}>Activer</Text>
                    </Pressable>
                  ) : null}
                  {a.status !== 'revoked' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Révoquer ${a.pilotName}`}
                      accessibilityState={{ busy: busy === a.id }}
                      disabled={busy === a.id}
                      hitSlop={6}
                      onPress={() => onSet(a, 'revoked')}
                      style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={[s.actionT, { color: theme.palette.red }]}>Révoquer</Text>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            ))}
          </View>
        </StateWrapper>
      </View>
    </Screen>
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
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    flex: 1,
  },
  status: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: theme.palette.creamMute,
  },
  bio: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.5,
    marginTop: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  actionBtn: {
    minHeight: 40,
    paddingHorizontal: theme.spacing.lg,
    justifyContent: 'center' as const,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.palette.edge,
  },
  actionT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.cream,
  },
};
