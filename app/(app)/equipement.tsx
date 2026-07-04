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
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { bluetoothService } from '@/ble/bluetoothService';
import { requestBlePermissions } from '@/ble/permissions';
import { getMyAssignedDevice, type MyDevice } from '@/services/deviceHealthService';
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

const SCAN_TIMEOUT_MS = 30_000;
/** Mémoire du dernier boîtier appairé (M7.2) — id BLE local, non sensible. */
const LAST_DEVICE_KEY = 'oxv.lastPairedDeviceId';

export default function EquipementScreen() {
  const [status, setStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Flotte (M7.2) : boîtier affecté au pilote (alias résolu par serial) +
  // dernier boîtier appairé — les deux best-effort, l'écran marche sans.
  const [myDevice, setMyDevice] = useState<MyDevice | null>(null);
  const [lastPairedId, setLastPairedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyAssignedDevice()
      .then((d) => {
        if (!cancelled) setMyDevice(d);
      })
      .catch(() => undefined);
    SecureStore.getItemAsync(LAST_DEVICE_KEY)
      .then((v) => {
        if (!cancelled) setLastPairedId(v);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Auto-redirect vers #09 dès qu'on est connecté (+ mémorise le boîtier)
  useEffect(() => {
    if (status === 'connected') {
      if (selectedId) {
        SecureStore.setItemAsync(LAST_DEVICE_KEY, selectedId).catch(() => undefined);
      }
      router.replace('/(app)/placement');
    }
  }, [status, selectedId]);

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
    setSelectedId(deviceId);
    setError(null);
    bluetoothService.stopScan();
    await bluetoothService.connect(deviceId);
    setConnecting(false);
  };

  // Résolution flotte : le boîtier AFFECTÉ au pilote est reconnu par son
  // serial contenu dans le nom BLE d'usine (« RaceBox Mini S 1234567890 »).
  const isMine = (d: RaceBoxDevice) =>
    Boolean(myDevice?.serial && d.name.toLowerCase().includes(myDevice.serial.toLowerCase()));
  // Ordre : mon boîtier d'abord, puis le dernier appairé, puis les autres.
  const orderedDevices = [...devices].sort((a, b) => {
    const rank = (d: RaceBoxDevice) => (isMine(d) ? 0 : d.id === lastPairedId ? 1 : 2);
    return rank(a) - rank(b);
  });

  const onRescan = () => {
    setError(null);
    setDevices([]);
    bluetoothService.startScan();
  };

  return (
    <Screen>
      <AppBar title="ÉQUIPEMENT" onBack={() => router.back()} />
      <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl }}>
        <Text style={s.title} accessibilityRole="header">
          À la recherche de votre équipement OXV Mirror…
        </Text>

        {status === 'scanning' && devices.length === 0 && !error ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xl }}
            accessibilityRole="text"
            accessibilityLabel="Scan en cours"
          >
            <ActivityIndicator color={theme.palette.creamMute} />
            <Text style={[s.meta, { marginLeft: theme.spacing.md }]}>Scan en cours…</Text>
          </View>
        ) : null}

        {error ? (
          <Text style={s.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            {error}
          </Text>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          {orderedDevices.map((d) => {
            const factoryName = d.name.replace(/^RaceBox/, 'OXV Mirror');
            const mine = isMine(d);
            // Alias flotte en premier (M7.2), nom d'usine en secondaire.
            const name = mine && myDevice?.alias ? myDevice.alias : factoryName;
            const badge = mine ? 'Votre boîtier' : d.id === lastPairedId ? 'Dernier utilisé' : null;
            const signal = d.rssi !== null ? `Signal ${d.rssi} dBm` : 'À portée';
            const secondary = [mine && myDevice?.alias ? factoryName : null, signal]
              .filter(Boolean)
              .join(' · ');
            return (
              <Card
                key={d.id}
                onPress={() => onSelect(d.id)}
                disabled={connecting}
                accessibilityLabel={`${name}${badge ? `, ${badge}` : ''}, ${signal}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Text style={s.deviceName}>{name}</Text>
                  {badge ? <Text style={s.badge}>{badge.toUpperCase()}</Text> : null}
                  <Text style={d.rssi !== null ? s.meta : s.metaText}>{secondary}</Text>
                </View>
                {connecting ? (
                  <ActivityIndicator color={theme.palette.creamMute} />
                ) : (
                  <Text style={s.chevron}>›</Text>
                )}
              </Card>
            );
          })}
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
  // Lecture d'instrument (RSSI) : porte un chiffre → mono.
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: theme.palette.creamMute,
    marginTop: theme.spacing.xs,
  },
  // Variante sans chiffre (« À portée ») : libellé → texte courant.
  metaText: {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSize.small,
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
  badge: {
    fontFamily: theme.fonts.mono,
    fontSize: theme.fontSize.eyebrow,
    letterSpacing: 1.2,
    // Métadonnée de récence/affectation, pas un état connecté : neutre.
    color: theme.palette.creamMute,
    marginTop: 2,
  },
  chevron: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    lineHeight: 18,
    color: theme.palette.faint,
  },
};
