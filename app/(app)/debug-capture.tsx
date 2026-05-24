/**
 * Écran de debug : capture des bytes UBX bruts depuis un RaceBox +
 * détection de tours live + simulation Flic 2.
 *
 * Visible uniquement quand __DEV__ est vrai. Permet à Gabin de :
 *   - capturer des fixtures .ubx réelles (Q5)
 *   - valider la détection de tours sur la finish line Beltoise
 *   - tester les markers Flic 2 sans matériel
 *
 * Toutes les sections sont composables : on peut démarrer une session
 * test sans BLE pour valider les markers, ou capturer sans démarrer la
 * détection de tours, etc.
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
import { flic2Service } from '@/ble/flic2Service';
import {
  type LapDetectorStatus,
  getLapDetectorStatus,
  startLapDetection,
  stopLapDetection,
} from '@/ble/lapDetectionRunner';
import { requestBlePermissions } from '@/ble/permissions';
import { useSessionStore } from '@/store/useSessionStore';
import { borderRadius, colors, fontSize, fontWeight, spacing, typography } from '@/theme/tokens';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

// Finish line Beltoise (circuits.id = e4bc0bd2…, Haute Saintonge officiel)
const BELTOISE_FINISH = {
  lat: 45.6004,
  lon: -0.141,
  radiusM: 40,
};

export default function DebugCaptureScreen() {
  const [bleStatus, setBleStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<boolean>(isCapturing());
  const [, setTick] = useState(0);
  const [lastUri, setLastUri] = useState<string | null>(getLastSavedUri());
  const [actionError, setActionError] = useState<string | null>(null);
  const [lapStatus, setLapStatus] = useState<LapDetectorStatus>(getLapDetectorStatus());

  const sessionStatus = useSessionStore((s) => s.status);
  const sessionLapCount = useSessionStore((s) => s.lapCount);
  const sessionBestLapMs = useSessionStore((s) => s.bestLapMs);
  const markers = useSessionStore((s) => s.markers);

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

  // Rafraîchissement périodique des stats live pendant la capture ou la détection.
  useEffect(() => {
    if (!capturing && !lapStatus.active) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setLapStatus(getLapDetectorStatus());
    }, 500);
    return () => clearInterval(interval);
  }, [capturing, lapStatus.active]);

  const connected = bleStatus === 'connected';
  const liveStats = getCurrentStats();

  const onScan = async () => {
    setBleError(null);
    setDevices([]);
    const perms = await requestBlePermissions();
    if (!perms.granted) {
      setBleError(`Permissions BLE refusées : ${perms.missing.join(', ')}`);
      return;
    }
    bluetoothService.startScan();
  };

  const onConnect = async (id: string) => {
    bluetoothService.stopScan();
    await bluetoothService.connect(id);
  };

  const onDisconnect = async () => {
    await bluetoothService.disconnect();
  };

  const onStartCapture = () => {
    setActionError(null);
    startCapture();
    setCapturing(true);
  };

  const onStopCapture = async () => {
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

  const onStartLapDetection = () => {
    startLapDetection({
      finishLineLat: BELTOISE_FINISH.lat,
      finishLineLon: BELTOISE_FINISH.lon,
      finishLineRadiusM: BELTOISE_FINISH.radiusM,
    });
    setLapStatus(getLapDetectorStatus());
  };

  const onStopLapDetection = () => {
    stopLapDetection();
    setLapStatus(getLapDetectorStatus());
  };

  const onStartTestSession = () => {
    useSessionStore.getState().startSession({
      id: `debug-${Date.now()}`,
      userId: 'debug-user',
      startedAt: new Date(),
      endedAt: null,
      circuitId: null,
      vehicleId: null,
    });
  };

  const onStopTestSession = () => {
    useSessionStore.getState().endSession();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing.huge }}>
        <Text style={[typography.eyebrow, { marginBottom: spacing.lg }]}>DEBUG / TÉLÉMÉTRIE</Text>
        <Text style={[typography.screenTitle, { marginBottom: spacing.xxl }]}>
          Outils de capture et de validation
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
          <Section label="Capture UBX brute">
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
              {!capturing ? (
                <Btn label="Démarrer la capture" onPress={onStartCapture} primary />
              ) : null}
              {capturing ? (
                <Btn label="Arrêter et sauvegarder" onPress={onStopCapture} primary />
              ) : null}
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

        {connected ? (
          <Section label="Détection de tours (Beltoise)">
            <Row label="Détecteur" value={lapStatus.active ? 'actif' : 'inactif'} />
            <Row label="Passages ligne (raw)" value={lapStatus.rawCrossings} />
            <Row label="Tours enregistrés" value={sessionLapCount} />
            {sessionBestLapMs !== null ? (
              <Row label="Meilleur tour" value={`${(sessionBestLapMs / 1000).toFixed(3)} s`} />
            ) : null}

            <ButtonsRow>
              {!lapStatus.active ? (
                <Btn label="Démarrer détection" onPress={onStartLapDetection} primary />
              ) : (
                <Btn label="Arrêter détection" onPress={onStopLapDetection} />
              )}
            </ButtonsRow>
          </Section>
        ) : null}

        <Section label="Session test (pour les markers)">
          <Row label="Statut" value={sessionStatus} />
          <Row label="Marqueurs Flic" value={markers.length} />

          <ButtonsRow>
            {sessionStatus === 'recording' || sessionStatus === 'paused' ? (
              <Btn label="Arrêter session" onPress={onStopTestSession} />
            ) : (
              <Btn label="Démarrer session" onPress={onStartTestSession} primary />
            )}
          </ButtonsRow>
        </Section>

        <Section label="Flic 2 — simulation (V1 stub)">
          <Text
            style={{
              color: colors.text.tertiary,
              fontSize: fontSize.caption,
              marginBottom: spacing.md,
            }}
          >
            Pas de scan BLE réel en V1. Simulez un clic et vérifiez qu'un marqueur s'ajoute à la
            session active.
          </Text>

          <ButtonsRow>
            <Btn label="Single (good)" onPress={() => flic2Service.simulateClick('good')} primary />
            <Btn label="Double (incident)" onPress={() => flic2Service.simulateClick('incident')} />
            <Btn label="Triple (question)" onPress={() => flic2Service.simulateClick('question')} />
          </ButtonsRow>

          {markers.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[typography.eyebrow, { marginBottom: spacing.sm }]}>
                DERNIERS MARQUEURS
              </Text>
              {markers
                .slice(-5)
                .reverse()
                .map((m, i) => (
                  <Text
                    key={`${m.at}-${i}`}
                    style={{
                      color: colors.text.secondary,
                      fontSize: fontSize.caption,
                      marginBottom: 4,
                    }}
                  >
                    {new Date(m.at).toLocaleTimeString('fr-FR')} — {m.kind} (tour{' '}
                    {m.lapNumber ?? '—'})
                  </Text>
                ))}
            </View>
          ) : null}
        </Section>

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
