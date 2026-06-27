/**
 * Écran #08 — Détection équipement. Design V2 (charte oxv-mirror-app).
 *
 * Variante "production" de l'écran debug-capture : scan BLE des RaceBox
 * à portée, sélection d'un appareil, connexion, transition automatique
 * vers #09 Placement.
 *
 * Doctrine : on utilise "Équipement OXV Mirror" et pas "RaceBox" côté
 * pilote (brand-neutral).
 * Reskin V2 : Screen + AppBar, Card/Button, logique inchangée.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { bluetoothService } from '@/ble/bluetoothService';
import { requestBlePermissions } from '@/ble/permissions';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

const SCAN_TIMEOUT_MS = 30_000;

export default function EquipementScreen() {
  const [status, setStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const offStatus = bluetoothService.onStatusChange(setStatus);
    const offDevice = bluetoothService.onDeviceFound((d) => {
      setDevices((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
    });
    const offError = bluetoothService.onError(setError);
    return () => {
      offStatus();
      offDevice();
      offError();
    };
  }, []);

  // Auto-redirect vers #09 dès qu'on est connecté
  useEffect(() => {
    if (status === 'connected') {
      router.replace('/(app)/placement');
    }
  }, [status]);

  // Démarrer le scan au mount
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const perm = await requestBlePermissions();
      if (cancelled) return;
      if (!perm.granted) {
        setError(`Permissions Bluetooth refusées : ${perm.missing.join(', ')}`);
        return;
      }
      bluetoothService.startScan();
      timer = setTimeout(() => {
        if (!cancelled && bluetoothService.getStatus() === 'scanning') {
          bluetoothService.stopScan();
          if (devices.length === 0) {
            setError(
              "Aucun équipement détecté. Vérifiez qu'il est allumé et proche de votre téléphone."
            );
          }
        }
      }, SCAN_TIMEOUT_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      bluetoothService.stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelect = async (deviceId: string) => {
    setConnecting(true);
    setError(null);
    bluetoothService.stopScan();
    await bluetoothService.connect(deviceId);
    setConnecting(false);
  };

  const onRescan = () => {
    setError(null);
    setDevices([]);
    bluetoothService.startScan();
  };

  return (
    <Screen>
      <AppBar title="ÉQUIPEMENT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title}>À la recherche de votre équipement OXV Mirror…</Text>

        {status === 'scanning' && devices.length === 0 && !error ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xl }}
          >
            <ActivityIndicator color={theme.palette.creamMute} />
            <Text style={[s.meta, { marginLeft: theme.spacing.md }]}>Scan en cours…</Text>
          </View>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={{ gap: theme.spacing.sm }}>
          {devices.map((d) => (
            <Pressable
              accessibilityRole="button"
              key={d.id}
              onPress={() => onSelect(d.id)}
              disabled={connecting}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <Card
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={s.deviceName}>{d.name.replace(/^RaceBox/, 'OXV Mirror')}</Text>
                  <Text style={s.meta}>
                    {d.rssi !== null ? `Signal ${d.rssi} dBm` : 'À portée'}
                  </Text>
                </View>
                {connecting ? (
                  <ActivityIndicator color={theme.palette.creamMute} />
                ) : (
                  <Text style={{ color: theme.palette.creamMute, fontSize: 18 }}>›</Text>
                )}
              </Card>
            </Pressable>
          ))}
        </View>

        {error || status === 'idle' ? (
          <View style={{ marginTop: theme.spacing.xl }}>
            <Button label="Relancer le scan" variant="ghost" onPress={onRescan} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const s = {
  title: {
    fontFamily: theme.fonts.display,
    fontSize: theme.fontSize.h3,
    letterSpacing: 0.5,
    color: theme.palette.cream,
    lineHeight: theme.fontSize.h3 * 1.3,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  error: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.body,
    lineHeight: theme.fontSize.body * 1.5,
    color: theme.palette.red,
    marginBottom: theme.spacing.xl,
  },
  deviceName: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: theme.fontSize.bodyLg,
    color: theme.palette.cream,
  },
};
