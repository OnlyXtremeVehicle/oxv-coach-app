/**
 * Écran #08 — Détection équipement.
 *
 * Variante "production" de l'écran debug-capture : scan BLE des RaceBox
 * à portée, sélection d'un appareil, connexion, transition automatique
 * vers #09 Placement.
 *
 * Doctrine : on utilise "Équipement OXV Coach" et pas "RaceBox" côté
 * pilote (brand-neutral).
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { bluetoothService } from '@/ble/bluetoothService';
import { requestBlePermissions } from '@/ble/permissions';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
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
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background.primary,
        paddingHorizontal: spacing.xl,
      }}
    >
      <View style={{ flex: 1, paddingTop: spacing.xxxl }}>
        <Text
          style={[typography.eyebrow, { marginBottom: spacing.lg, color: colors.text.tertiary }]}
        >
          ÉQUIPEMENT
        </Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.xl }]}>
          À la recherche de votre équipement OXV Coach…
        </Text>

        {status === 'scanning' && devices.length === 0 && !error ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl }}>
            <ActivityIndicator color={colors.text.secondary} />
            <Text style={[typography.caption, { marginLeft: spacing.md }]}>Scan en cours…</Text>
          </View>
        ) : null}

        {error ? (
          <Text style={[typography.body, { color: colors.system.error, marginBottom: spacing.xl }]}>
            {error}
          </Text>
        ) : null}

        <View style={{ gap: spacing.md }}>
          {devices.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => onSelect(d.id)}
              disabled={connecting}
              style={({ pressed }) => ({
                padding: spacing.lg,
                borderRadius: borderRadius.lg,
                borderWidth: 0.5,
                borderColor: colors.border.subtle,
                backgroundColor: colors.background.secondary,
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <View>
                <Text
                  style={{
                    color: colors.text.primary,
                    fontSize: fontSize.body,
                    fontWeight: fontWeight.medium,
                  }}
                >
                  {d.name.replace(/^RaceBox/, 'OXV Coach')}
                </Text>
                <Text
                  style={{
                    color: colors.text.tertiary,
                    fontSize: fontSize.caption,
                    marginTop: spacing.xxs,
                  }}
                >
                  {d.rssi !== null ? `Signal ${d.rssi} dBm` : 'À portée'}
                </Text>
              </View>
              {connecting ? (
                <ActivityIndicator color={colors.text.secondary} />
              ) : (
                <Text style={{ color: colors.accent.red, fontSize: fontSize.body }}>›</Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {error || status === 'idle' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRescan}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border.medium,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.xl,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={{
              color: colors.text.primary,
              fontSize: fontSize.body,
              fontWeight: fontWeight.regular,
            }}
          >
            Relancer le scan
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
