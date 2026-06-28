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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { bluetoothService, type ReconnectState } from '@/ble/bluetoothService';
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
import { theme } from '@/theme/v2';
import { AppBar } from '@/ui/AppBar';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

const { palette, fonts, fontSize, spacing, radius } = theme;

// Finish line Beltoise (circuits.id = e4bc0bd2…, Haute Saintonge officiel)
const BELTOISE_FINISH = {
  lat: 45.6004,
  lon: -0.141,
  radiusM: 40,
};

export default function DebugCaptureScreen() {
  // Écran de debug (BLE/capture) : inaccessible en production (deep-link inclus).
  if (!__DEV__) return <Redirect href={'/(app)' as never} />;
  return <DebugCaptureScreenInner />;
}

function DebugCaptureScreenInner() {
  const [bleStatus, setBleStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<boolean>(isCapturing());
  const [reconnect, setReconnect] = useState<ReconnectState>(bluetoothService.getReconnectState());
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
    // Le service émet '' pour effacer une erreur (ex. après reconnexion) ; on
    // normalise en null pour que la ligne « Erreur » disparaisse proprement.
    const offError = bluetoothService.onError((err) => setBleError(err || null));
    const offReconnect = bluetoothService.onReconnectChange(setReconnect);
    return () => {
      offStatus();
      offDevice();
      offError();
      offReconnect();
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
    <Screen>
      <AppBar title="CAPTURE" subtitle="Debug / télémétrie" onBack={() => router.back()} />
      <View style={styles.body}>
        {/* Bandeau d'état dominant : sur site, l'opérateur doit lire d'un coup
            d'œil si le boîtier est lié, si la capture tourne, et — surtout — si
            le lien décroche (reconnexion en cours / liaison perdue). */}
        <StatusBanner
          bleStatus={bleStatus}
          connected={connected}
          capturing={capturing}
          reconnect={reconnect}
        />

        <Section label="BLE">
          <Row label="État" value={bleStatusLabel(bleStatus)} tone={statusTone(bleStatus)} />
          {bleError ? <Row label="Erreur" value={bleError} danger /> : null}
          <ButtonsRow>
            {bleStatus !== 'scanning' && bleStatus !== 'connected' ? (
              <Btn label="Scan" onPress={onScan} primary />
            ) : null}
            {bleStatus === 'scanning' ? (
              <Btn label="Arrêter le scan" onPress={() => bluetoothService.stopScan()} />
            ) : null}
            {connected ? <Btn label="Déconnecter" onPress={onDisconnect} danger /> : null}
          </ButtonsRow>
        </Section>

        {!connected && devices.length > 0 ? (
          <Section label="Appareils détectés">
            {devices.map((d) => (
              <Pressable
                accessibilityRole="button"
                key={d.id}
                onPress={() => onConnect(d.id)}
                style={({ pressed }) => [styles.device, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={styles.deviceName}>{d.name}</Text>
                <Text style={styles.deviceMeta}>
                  {d.id} {d.rssi !== null ? `· RSSI ${d.rssi}` : null}
                </Text>
              </Pressable>
            ))}
          </Section>
        ) : null}

        {connected ? (
          <Section label="Capture UBX brute">
            <Row
              label="État"
              value={capturing ? 'EN COURS' : 'arrêtée'}
              tone={capturing ? 'rec' : 'idle'}
            />
            <Row label="Chunks reçus" value={liveStats.chunkCount.toLocaleString('fr-FR')} data />
            <Row
              label="Octets capturés"
              value={`${liveStats.byteCount.toLocaleString('fr-FR')} (~${(
                liveStats.byteCount / 1024
              ).toFixed(1)} KB)`}
              data
            />
            <Row
              label="Durée"
              value={
                liveStats.durationMs > 0 ? `${Math.floor(liveStats.durationMs / 1000)} s` : '—'
              }
              data
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
                <Text style={styles.caption} numberOfLines={2}>
                  Dernière capture : {lastUri.split('/').pop()}
                </Text>
                <Btn label="Partager le fichier .ubx" onPress={onShare} />
              </View>
            ) : null}
          </Section>
        ) : null}

        {connected ? (
          <Section label="Détection de tours (Beltoise)">
            <Row
              label="Détecteur"
              value={lapStatus.active ? 'actif' : 'inactif'}
              tone={lapStatus.active ? 'ok' : 'idle'}
            />
            <Row label="Passages ligne (raw)" value={lapStatus.rawCrossings} data />
            <Row label="Tours enregistrés" value={sessionLapCount} data />
            {sessionBestLapMs !== null ? (
              <Row label="Meilleur tour" value={`${(sessionBestLapMs / 1000).toFixed(3)} s`} data />
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
          <Row label="Marqueurs Flic" value={markers.length} data />

          <ButtonsRow>
            {sessionStatus === 'recording' || sessionStatus === 'paused' ? (
              <Btn label="Arrêter session" onPress={onStopTestSession} />
            ) : (
              <Btn label="Démarrer session" onPress={onStartTestSession} primary />
            )}
          </ButtonsRow>
        </Section>

        <Section label="Flic 2 — simulation (V1 stub)">
          <Text style={styles.note}>
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
              <Text style={[styles.eyebrow, { marginBottom: spacing.sm }]}>DERNIERS MARQUEURS</Text>
              {markers
                .slice(-5)
                .reverse()
                .map((m, i) => (
                  <Text key={`${m.at}-${i}`} style={styles.markerLine}>
                    {new Date(m.at).toLocaleTimeString('fr-FR')} — {m.kind} (tour{' '}
                    {m.lapNumber ?? '—'})
                  </Text>
                ))}
            </View>
          ) : null}
        </Section>

        <View style={{ marginTop: spacing.xxl, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={styles.back}>Retour à l'accueil</Text>
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

// ----------------------------------------------------------------------------
// Présentation pure (libellés + couleurs codées). Aucune logique de capture :
// ces helpers ne font que traduire un état déjà calculé en texte/teinte lisible.
// ----------------------------------------------------------------------------

/** Teinte sémantique d'une ligne : donnée (or), état ok/rec (vert/rouge), neutre. */
type RowTone = 'data' | 'ok' | 'rec' | 'idle' | 'danger' | 'warn';

function bleStatusLabel(status: BleStatus): string {
  switch (status) {
    case 'connected':
      return 'connecté';
    case 'connecting':
      return 'connexion…';
    case 'scanning':
      return 'recherche…';
    case 'disconnected':
      return 'déconnecté';
    case 'error':
      return 'erreur';
    case 'idle':
      return 'au repos';
    default:
      return status;
  }
}

function statusTone(status: BleStatus): RowTone {
  if (status === 'connected') return 'ok';
  if (status === 'error') return 'danger';
  if (status === 'disconnected') return 'idle';
  return 'data';
}

function toneColor(tone: RowTone): string {
  switch (tone) {
    case 'data':
      return palette.gold;
    case 'ok':
      return palette.green;
    case 'rec':
      return palette.red;
    case 'danger':
      return palette.red;
    // Ambre (or de marque) : reconnexion en cours — ni « tout va bien », ni
    // « perdu ». Distinct du rouge terminal.
    case 'warn':
      return palette.gold;
    default:
      return palette.cream;
  }
}

/**
 * Bandeau d'état dominant en tête d'écran : un seul repère visuel pour savoir,
 * sur site, où en est le boîtier. Une pastille colorée + un mot.
 *
 * Priorité d'affichage (du plus critique au plus calme) :
 *   1. LIAISON PERDUE (rouge)   — reconnexion auto épuisée, terminal.
 *   2. RECONNEXION…  (ambre)    — lien tombé, tentatives en cours (n/N).
 *   3. EN ENREGISTREMENT (rouge)— capture nominale en cours.
 *   4. CONNECTÉ (vert)          — boîtier lié, prêt.
 *   5. DÉCONNECTÉ (neutre)      — repos / aucun boîtier lié.
 *
 * Les états 1–2 dérivent de la reconnexion auto du service (additif) ; ils sont
 * volontairement distincts d'un repos nominal pour ne JAMAIS laisser croire, sur
 * site, qu'on enregistre alors que le boîtier a décroché.
 */
function StatusBanner({
  bleStatus,
  connected,
  capturing,
  reconnect,
}: {
  bleStatus: BleStatus;
  connected: boolean;
  capturing: boolean;
  reconnect: ReconnectState;
}) {
  let tone: RowTone;
  let label: string;
  let sub: string;

  if (reconnect.phase === 'lost') {
    tone = 'danger';
    label = 'LIAISON PERDUE';
    sub =
      'Reconnexion impossible après plusieurs tentatives. Vérifiez le boîtier, puis relancez un scan.';
  } else if (reconnect.phase === 'reconnecting') {
    tone = 'warn';
    label = 'RECONNEXION…';
    sub = `Lien interrompu — tentative ${Math.max(reconnect.attempt, 1)}/${reconnect.maxAttempts}. La capture reprend dès le lien rétabli.`;
  } else if (capturing) {
    tone = 'rec';
    label = 'EN ENREGISTREMENT';
    sub = 'Le boîtier transmet — les trames sont capturées.';
  } else if (connected) {
    tone = 'ok';
    label = 'CONNECTÉ';
    sub = 'Boîtier lié. Prêt à enregistrer.';
  } else {
    tone = 'idle';
    label = 'DÉCONNECTÉ';
    sub = `Aucun boîtier lié (${bleStatusLabel(bleStatus)}).`;
  }

  const accent = toneColor(tone);
  return (
    <Card style={{ ...styles.banner, borderColor: accent }}>
      <View style={styles.bannerRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={[styles.bannerLabel, { color: accent }]}>{label}</Text>
      </View>
      <Text style={styles.bannerSub}>{sub}</Text>
    </Card>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xxl }}>
      <Text style={[styles.eyebrow, { marginBottom: spacing.md }]}>{label}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  danger = false,
  data = false,
  tone,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
  data?: boolean;
  tone?: RowTone;
}) {
  const resolved: RowTone = danger ? 'danger' : (tone ?? (data ? 'data' : 'idle'));
  // Les valeurs chiffrées passent en mono (la voix de l'instrument) ; les
  // libellés d'état restent en corps de texte.
  const mono = data || resolved === 'data';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text
        style={[mono ? styles.rowValueMono : styles.rowValue, { color: toneColor(resolved) }]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

function ButtonsRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.buttonsRow}>{children}</View>;
}

function Btn({
  label,
  onPress,
  primary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.btnPrimary : styles.btnGhost,
        danger ? styles.btnDanger : null,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          styles.btnLabel,
          primary ? styles.btnLabelPrimary : styles.btnLabelGhost,
          danger ? styles.btnLabelDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: fontSize.eyebrow,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: palette.faint,
  },

  // Bandeau d'état (repère dominant en tête d'écran).
  banner: { marginBottom: spacing.xxl, padding: spacing.lg },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 9, height: 9, borderRadius: 999 },
  bannerLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  bannerSub: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginTop: spacing.sm,
    lineHeight: fontSize.small * 1.4,
  },

  // Lignes label / valeur.
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.line,
  },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    letterSpacing: 0.4,
    color: palette.creamMute,
  },
  rowValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.small,
    textAlign: 'right',
    flexShrink: 1,
  },
  rowValueMono: {
    fontFamily: fonts.monoMedium,
    fontSize: fontSize.body,
    textAlign: 'right',
    flexShrink: 1,
  },

  // Listes d'appareils détectés.
  device: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: spacing.sm,
  },
  deviceName: { fontFamily: fonts.body, fontSize: fontSize.body, color: palette.cream },
  deviceMeta: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.faint,
    marginTop: 2,
  },

  caption: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginBottom: spacing.sm,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: fontSize.small,
    color: palette.creamMute,
    marginBottom: spacing.md,
    lineHeight: fontSize.small * 1.4,
  },
  markerLine: {
    fontFamily: fonts.mono,
    fontSize: fontSize.small,
    color: palette.creamSoft,
    marginBottom: 4,
  },

  // Boutons.
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  btnPrimary: { backgroundColor: palette.cream },
  btnGhost: { borderWidth: 1, borderColor: palette.edge, backgroundColor: palette.card2 },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.red },
  btnLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  btnLabelPrimary: { color: palette.night },
  btnLabelGhost: { color: palette.cream },
  btnLabelDanger: { color: palette.red },

  back: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: palette.creamMute },
});
