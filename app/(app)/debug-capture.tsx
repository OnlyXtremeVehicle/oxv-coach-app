/**
 * Écran de debug : capture des bytes UBX bruts depuis un RaceBox.
 *
 * Visible uniquement quand __DEV__ est vrai. Permet à Gabin de produire
 * des fixtures .ubx réutilisables pour les tests du parser (semaines 3-4),
 * comme évoqué en Q5 du rapport d'onboarding.
 *
 * Workflow type :
 *   1. Démarrer le scan BLE
 *   2. Sélectionner son RaceBox dans la liste
 *   3. Démarrer la capture
 *   4. Rouler (ou simuler 30-60 min)
 *   5. Stopper, sauvegarder, partager le .ubx via la sheet système
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { bluetoothService } from '@/ble/bluetoothService';
import {
  getCurrentStats,
  getLastSavedUri,
  isCapturing,
  shareCapture,
  startCapture,
  stopCapture,
} from '@/ble/captureMode';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

export default function DebugCaptureScreen() {
  const [bleStatus, setBleStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<boolean>(isCapturing());
  const [, setTick] = useState(0);
  const [lastUri, setLastUri] = useState<string | null>(getLastSavedUri());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const offStatus = bluetoothService.onStatusChange(setBleStatus);
    const offDevice = bluetoothService.onDeviceFound((d) => {
      setDevices((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
    });
    const offError = bluetoothService.onError(setBleError);
    return () => {
      offStatus();
      offDevice();
      offError();
    };
  }, []);

  // Rafraîchissement périodique des stats live pendant la capture
  useEffect(() => {
    if (!capturing) return;
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, [capturing]);

  const onScan = () => {
    setBleError(null);
    setDevices([]);
    bluetoothService.startScan();
  };

  const onConnect = async (id: string) => {
    bluetoothService.stopScan();
    await bluetoothService.connect(id);
  };

  const onDisconnect = async () => {
    await bluetoothService.disconnect();
  };

  const onStart = () => {
    setActionError(null);
    startCapture();
    setCapturing(true);
  };

  const onStop = async () => {
    setActionError(null);
    try {
      const uri = await stopCapture();
      setLastUri(uri);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
    setCapturing(false);
  };

  const onShare = async () => {
    setActionError(null);
    try {
      await shareCapture();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const connected = bleStatus === 'connected';
  // getCurrentStats() est un getter pur sur le buffer ; recalculé à chaque render
  // (rerender forcé toutes les 500 ms pendant la capture via setTick).
  const liveStats = getCurrentStats();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>DEBUG / CAPTURE UBX</Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.xxl }]}>
          Capture d'une session RaceBox
        </Text>

        <Section label="BLE">
          <Row label="État" value={bleStatus} />
          {bleError ? <Row label="Erreur" value={bleError} danger /> : null}
          <ButtonsRow>
            {bleStatus !== 'scanning' && bleStatus !== 'connected' ? (
              <Btn label="Scan" onPress={onScan} primary />
            ) : null}
            {bleStatus === 'scanning' ? (
              <Btn label="Arrêter le scan" onPress={() => bluetoothService.stopScan()} />
            ) : null}
            {connected ? <Btn label="Déconnecter" onPress={onDisconnect} /> : null}
          </ButtonsRow>
        </Section>

        {!connected && devices.length > 0 ? (
          <Section label="Appareils détectés">
            {devices.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => onConnect(d.id)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  marginBottom: spacing.sm,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.text.primary, fontSize: fontSize.body }}>
                  {d.name}
                </Text>
                <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
                  {d.id} {d.rssi !== null ? `· RSSI ${d.rssi}` : null}
                </Text>
              </Pressable>
            ))}
          </Section>
        ) : null}

        {connected ? (
          <Section label="Capture">
            <Row label="État" value={capturing ? 'EN COURS' : 'arrêtée'} />
            <Row label="Chunks reçus" value={liveStats.chunkCount.toLocaleString('fr-FR')} />
            <Row
              label="Octets capturés"
              value={`${liveStats.byteCount.toLocaleString('fr-FR')} (~${(
                liveStats.byteCount / 1024
              ).toFixed(1)} KB)`}
            />
            <Row
              label="Durée"
              value={
                liveStats.durationMs > 0 ? `${Math.floor(liveStats.durationMs / 1000)} s` : '—'
              }
            />

            <ButtonsRow>
              {!capturing ? <Btn label="Démarrer la capture" onPress={onStart} primary /> : null}
              {capturing ? <Btn label="Arrêter et sauvegarder" onPress={onStop} primary /> : null}
            </ButtonsRow>

            {actionError ? <Row label="Erreur" value={actionError} danger /> : null}

            {lastUri ? (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={[typography.caption, { marginBottom: spacing.sm }]} numberOfLines={2}>
                  Dernière capture : {lastUri.split('/').pop()}
                </Text>
                <Btn label="Partager le fichier .ubx" onPress={onShare} />
              </View>
            ) : null}
          </Section>
        ) : null}

        <View style={{ marginTop: spacing.xxxl, alignItems: 'center' }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ color: colors.text.tertiary, fontSize: fontSize.caption }}>
              Retour à l'accueil
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[typography.eyebrow, { marginBottom: spacing.md }]}>{label}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.border.subtle,
      }}
    >
      <Text style={{ color: colors.text.secondary, fontSize: fontSize.caption }}>{label}</Text>
      <Text
        style={{
          color: danger ? colors.system.error : colors.text.primary,
          fontSize: fontSize.caption,
          fontWeight: fontWeight.medium,
        }}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ButtonsRow({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.lg,
      }}
    >
      {children}
    </View>
  );
}

function Btn({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        backgroundColor: primary ? colors.accent.red : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: colors.border.medium,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: fontSize.caption,
          fontWeight: fontWeight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
