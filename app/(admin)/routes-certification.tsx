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
          <ActivityIndicator color={BRONZE} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="CERTIFICATION" subtitle="Belles routes" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>DEMANDES EN ATTENTE</Text>

        {routes.length === 0 ? (
          <Card
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.xxl,
              borderColor: BRONZE,
            }}
          >
            <Text style={s.empty}>Aucune demande de certification en attente.</Text>
          </Card>
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
                      disabled={busy}
                      onPress={() => act(r.id, true)}
                      style={({ pressed }) => [s.certify, { opacity: pressed || busy ? 0.6 : 1 }]}
                    >
                      <Text style={s.certifyT}>Certifier</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
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
  empty: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.bodyLg,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
  },
  name: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  certify: {
    borderWidth: 1,
    borderColor: theme.dataColors.accel,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  certifyT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.dataColors.accel,
  },
  reject: {
    borderWidth: 1,
    borderColor: theme.palette.line,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  rejectT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
