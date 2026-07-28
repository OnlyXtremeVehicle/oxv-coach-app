/**
 * Mon boîtier (V9) — panneau d'état permanent de l'équipement affecté au pilote.
 *
 * Distinct du scan-connect du flux de capture (`equipement.tsx`) : ici, une vue
 * posée de SON boîtier OXV — modèle, batterie, santé, et l'historique des
 * relevés. Lecture seule, scopée par la RLS (le pilote ne voit que son boîtier).
 *
 * Doctrine : des FAITS (batterie, signal), jamais un verdict ; ni or (= donnée
 * de perf) ni rouge (= marque) sur les états. Sobre, vouvoiement, pas d'emoji.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/instruments';
import {
  getDeviceHealthHistory,
  getMyAssignedDevice,
  type DeviceHealthEntry,
  type MyDevice,
} from '@/services/deviceHealthService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { SectionLabel } from '@/ui/SectionLabel';
import { formatDateTime } from '@/utils/format';

function pretty(value: string | null): string {
  if (!value) return '—';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function MonEquipementScreen() {
  const [device, setDevice] = useState<MyDevice | null>(null);
  const [history, setHistory] = useState<DeviceHealthEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const dev = await getMyAssignedDevice();
      if (cancelled) return;
      setDevice(dev);
      setHistory(dev ? await getDeviceHealthHistory(dev.deviceId) : []);
      if (!cancelled) setLoading(false);
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(reload);

  return (
    <Screen>
      <AppBar title="MON BOÎTIER" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.screen, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.eyebrow}>VOTRE ÉQUIPEMENT</Text>
        <Text style={s.title} accessibilityRole="header">
          Votre boîtier OXV.
        </Text>

        {loading ? (
          <View style={{ paddingVertical: theme.spacing.xxl, alignItems: 'center' }}>
            <ActivityIndicator color={theme.palette.creamMute} accessibilityLabel="Chargement" />
          </View>
        ) : !device ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <EmptyState
              label="Aucun boîtier affecté"
              message="L'équipe OXV vous remettra un boîtier le jour de votre séance. Il apparaîtra ici."
            />
          </View>
        ) : (
          <>
            <Card style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
              <Text style={s.deviceLabel}>{device.alias ?? device.label}</Text>
              {device.type || device.serial ? (
                <Text style={s.deviceMeta}>
                  {[device.type, device.serial ? `N° ${device.serial}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}

              <View style={s.statRow}>
                <Stat label="Batterie" value={pretty(device.batteryStatus)} />
                <Stat label="État" value={pretty(device.healthStatus)} />
              </View>
            </Card>

            <View style={{ marginTop: theme.spacing.xxl }}>
              <SectionLabel>Historique</SectionLabel>
              {history.length === 0 ? (
                <Text style={s.muted}>
                  Les relevés (batterie, signal) apparaîtront ici au fil de vos connexions.
                </Text>
              ) : (
                <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
                  {history.map((h, i) => (
                    <View key={`${h.recordedAt}-${i}`} style={s.histRow}>
                      <Text style={s.histDate}>{formatDateTime(h.recordedAt)}</Text>
                      <Text style={s.histMeta}>
                        {[
                          h.batteryStatus ? `Batterie ${pretty(h.batteryStatus)}` : null,
                          h.rssi != null ? `${h.rssi} dBm` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || pretty(h.healthStatus)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Text style={s.doctrine}>
              Votre boîtier, tel que mesuré. Le briefing de sécurité prime sur tout.
            </Text>
          </>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statLabel}>{label.toUpperCase()}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

const s = {
  eyebrow: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    color: theme.palette.faint,
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
  deviceLabel: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    color: theme.palette.cream,
  },
  deviceMeta: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
  },
  statRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.line,
  },
  statLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
  },
  statValue: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
    marginTop: 2,
  },
  muted: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamMute,
    lineHeight: theme.fontSize.small * 1.6,
    marginTop: theme.spacing.md,
  },
  histRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.line,
  },
  histDate: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
    color: theme.palette.creamSoft,
  },
  histMeta: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.small,
    letterSpacing: 0.4,
    color: theme.palette.creamMute,
  },
  doctrine: {
    fontFamily: theme.fonts.bodyLight,
    fontSize: theme.fontSize.small,
    fontStyle: 'italic' as const,
    color: theme.palette.creamMute,
    textAlign: 'center' as const,
    marginTop: theme.spacing.xxl,
  },
};
