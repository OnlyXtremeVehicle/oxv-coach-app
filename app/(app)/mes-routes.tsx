/**
 * Écran « Mes belles routes » — routes balade sauvegardées par le pilote (doc 09).
 *
 * Liste les routes enregistrées, leur statut de certification, et permet de
 * demander la certification OXV (un admin validera) ou de supprimer.
 * Doctrine : curation par le pilote, certification par un admin — aucun
 * classement par agressivité.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import Toast from 'react-native-toast-message';

import {
  type SavedScenicRoute,
  type ScenicRouteStatus,
  deleteRoute,
  listMyRoutes,
  requestCertification,
} from '@/services/routing/scenicRoutesService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';

const STATUS: Record<ScenicRouteStatus, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: theme.palette.creamMute },
  pending_review: { label: 'En revue OXV', color: theme.palette.gold },
  certified: { label: 'Certifiée OXV', color: theme.dataColors.accel },
  rejected: { label: 'Non retenue', color: theme.palette.red },
};

export default function MesRoutesScreen() {
  const [routes, setRoutes] = useState<SavedScenicRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setRoutes(await listMyRoutes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onRequest(id: string) {
    setBusyId(id);
    try {
      const ok = await requestCertification(id);
      Toast.show({
        type: ok ? 'success' : 'error',
        text1: ok ? 'Demande envoyée' : 'Action impossible',
        text2: ok ? 'Un admin OXV examinera votre route.' : undefined,
      });
      if (ok) await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(id: string) {
    setBusyId(id);
    try {
      const ok = await deleteRoute(id);
      if (ok) setRoutes((rs) => rs.filter((r) => r.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <AppBar title="MES BELLES ROUTES" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.palette.creamMute} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title="MES BELLES ROUTES" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        {routes.length === 0 ? (
          <Card style={{ alignItems: 'center', paddingVertical: theme.spacing.xxl }}>
            <Text style={s.emptyTitle}>Aucune route enregistrée.</Text>
            <Text style={s.emptyHint}>
              Depuis « Belle route », composez un itinéraire et enregistrez-le ici.
            </Text>
            <View style={{ marginTop: theme.spacing.lg, alignSelf: 'stretch' }}>
              <Button
                label="Trouver une belle route"
                onPress={() => router.push('/(app)/belle-route' as never)}
              />
            </View>
          </Card>
        ) : (
          <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
            {routes.map((r) => {
              const st = STATUS[r.status];
              const canRequest = r.status === 'draft' || r.status === 'rejected';
              const meta = [
                r.distanceKm ? `${Math.round(r.distanceKm)} km` : null,
                r.curviness,
                r.sinuosity ? `sinuosité ${r.sinuosity.toFixed(2)}` : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <Card key={r.id}>
                  <View style={s.row}>
                    <Text style={s.name}>{r.name}</Text>
                    <Chip label={st.label} dotColor={st.color} />
                  </View>
                  {meta ? <Text style={s.meta}>{meta}</Text> : null}
                  {r.status === 'rejected' && r.reviewNotes ? (
                    <Text style={s.notes}>{r.reviewNotes}</Text>
                  ) : null}
                  <View style={s.actions}>
                    {canRequest ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={busyId === r.id}
                        onPress={() => onRequest(r.id)}
                        style={({ pressed }) => [
                          s.btn,
                          { opacity: pressed || busyId === r.id ? 0.6 : 1 },
                        ]}
                      >
                        <Text style={s.btnT}>Demander la certification</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      disabled={busyId === r.id}
                      onPress={() => onDelete(r.id)}
                      hitSlop={6}
                    >
                      <Text style={s.delete}>Supprimer</Text>
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
    marginTop: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
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
  notes: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.sm,
  },
  actions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  btn: {
    borderWidth: 1,
    borderColor: theme.palette.gold,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  btnT: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.gold,
  },
  delete: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
};
