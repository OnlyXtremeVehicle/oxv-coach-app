/**
 * Vue Admin — certification des belles routes (doc 09).
 *
 * Liste les routes dont un pilote a demandé la certification (pending_review).
 * L'admin certifie (visible communauté) ou rejette. Accès réservé aux admins
 * (RLS + verrou DB). Accent bronze (couleur de rôle admin).
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import { EmptyState } from '@/components/instruments/EmptyState';
import {
  type SavedScenicRoute,
  certifyRoute,
  listPendingCertification,
  rejectRoute,
} from '@/services/routing/scenicRoutesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';

const BRONZE = '#B87333';

export default function RoutesCertificationScreen() {
  const [routes, setRoutes] = useState<SavedScenicRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRoutes(await listPendingCertification());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act(id: string, certify: boolean) {
    setBusyId(id);
    try {
      const ok = certify ? await certifyRoute(id) : await rejectRoute(id);
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok ? (certify ? 'Route certifiée' : 'Route rejetée') : 'Action impossible',
      });
      if (ok) setRoutes((rs) => rs.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="CERTIFICATION" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator
            color={BRONZE}
            accessibilityLabel="Chargement des demandes de certification"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="CERTIFICATION" subtitle="Belles routes" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow} accessibilityRole="header">
          DEMANDES EN ATTENTE
        </Text>

        {routes.length === 0 ? (
          <EmptyState
            label="Certification"
            message="Aucune demande de certification en attente."
            source="scenic_routes"
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {routes.map((r) => {
              const meta = [
                r.distanceKm ? `${Math.round(r.distanceKm)} km` : null,
                r.curviness,
                r.sinuosity ? `sinuosité ${r.sinuosity.toFixed(2)}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              const busy = busyId === r.id;
              return (
                <Card key={r.id} style={{ borderColor: BRONZE }}>
                  <Text style={s.name}>{r.name}</Text>
                  {meta ? <Text style={s.meta}>{meta}</Text> : null}
                  <View style={s.actions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Certifier la route ${r.name}`}
                      accessibilityState={{ disabled: busy, busy }}
                      disabled={busy}
                      hitSlop={theme.hitSlop}
                      onPress={() => act(r.id, true)}
                      style={({ pressed }) => [s.certify, { opacity: pressed || busy ? 0.6 : 1 }]}
                    >
                      <Text style={s.certifyT}>Certifier</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Rejeter la route ${r.name}`}
                      accessibilityState={{ disabled: busy, busy }}
                      disabled={busy}
                      hitSlop={theme.hitSlop}
                      onPress={() => act(r.id, false)}
                      style={({ pressed }) => [s.reject, { opacity: pressed || busy ? 0.6 : 1 }]}
                    >
                      <Text style={s.rejectT}>Rejeter</Text>
                    </Pressable>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
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
    color: BRONZE,
    marginBottom: theme.spacing.lg,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  // Méta = libellé (mots + chiffres mêlés) → corps, jamais mono (doctrine).
  meta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
    lineHeight: theme.fontSize.small * 1.4,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  // Accent d'action admin = bronze (couleur de rôle), pas une couleur de
  // donnée détournée. Le libellé « Certifier » porte le sens.
  certify: {
    minHeight: 44,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: BRONZE,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  // Libellé d'action → corps (jamais mono sur un libellé, doctrine).
  certifyT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: BRONZE,
  },
  reject: {
    minHeight: 44,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  rejectT: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.5,
    color: theme.palette.creamMute,
  },
};
