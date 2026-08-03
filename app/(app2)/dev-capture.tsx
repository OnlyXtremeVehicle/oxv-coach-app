/**
 * BANC DE CAPTURE — écran de développement, arbre `app/(app2)`, kit V2.
 *
 * Porté depuis `app/(app)/debug-capture.tsx` au lot J5, sur décision fondateur
 * du 29/07/2026 : « porter en app2 sous __DEV__ », comme `dev-galerie`.
 *
 * ---
 *
 * POURQUOI IL SURVIT ALORS QU'IL N'EST DANS AUCUNE DES 37 ROUTES PILOTE
 *
 * C'est la seule surface qui capture et exporte des trames UBX RÉELLES, et le
 * seul consommateur d'interface de `flic2Service`. Le programme constate que
 * rien n'a jamais tourné et exige une journée complète avec boîtier : supprimer
 * ce banc, c'est supprimer le moyen de la préparer.
 *
 * Comme `dev-galerie`, il est STRICTEMENT `__DEV__` : en build de production la
 * route redirige, deep link compris.
 *
 * ---
 *
 * CE QUE LE PORTAGE A CORRIGÉ : LA LIGNE D'ARRIVÉE
 *
 * La version V1 portait une constante en dur :
 *
 *     const BELTOISE_FINISH = { lat: 45.6004, lon: -0.141, radiusM: 40 };
 *
 * Elle ne correspond à AUCUNE ligne de la table `circuits`. La plus proche
 * était « La charade », 45.5988 / -0.1339 — à plusieurs centaines de mètres, et
 * de rayon 30 m, pas 40 ; cette fiche a elle-même été retirée le 03/08/2026
 * (jalon 0.H). Un banc censé valider la détection de tours validait donc une
 * ligne qui n'existait nulle part.
 *
 * Le circuit se CHOISIT désormais, et ses coordonnées viennent de
 * `fetchCircuits()` — mêmes valeurs que la capture réelle, cap de porte inclus
 * quand il est renseigné. Sans circuit chargé, la détection reste inerte : on
 * n'invente pas une ligne pour faire tourner un bouton.
 *
 * ---
 *
 * CORRESPONDANCE DES JETONS V1 → V2
 *
 *   palette.night     → colors.bg.base        palette.cream    → colors.text.hi
 *   palette.creamSoft → colors.text.mid       palette.creamMute→ colors.text.mid
 *   palette.faint     → colors.text.dim       palette.line     → colors.border.hairline
 *   palette.edge      → colors.border.card    palette.card2    → colors.bg.card2
 *   fonts.mono        → typo.mono             fonts.body       → typo.body
 *   spacing.screen    → space.xl              radius.md        → radius.cell
 *
 * Renoncements nommés :
 *   — `Screen` et `AppBar` n'existent pas en V2 : l'en-tête est composé.
 *   — Les boutons maison passent au `Button` du kit (variantes ghost/primary).
 *   — `palette.gold` (or de donnée) DISPARAÎT des lignes de valeur : en V2 l'or
 *     `heritage` code le tier Heritage et le chrono, pas un compteur d'octets.
 *     Les valeurs chiffrées restent en mono, qui suffit à les dire.
 *   — `palette.green` disparaît aussi : l'état se lit au mot, pas à la teinte.
 *     Seul l'accent rouge subsiste, sur les deux états qui interrompent —
 *     liaison perdue et erreur.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { fetchCircuits, type Circuit } from '@/services/circuitsService';
import { useSessionStore } from '@/store/useSessionStore';
import { Button, Chip, PressScale, SectionHeader, colors, radius, space, typo } from '@/ui/v2';
import type { BleStatus, RaceBoxDevice } from '@/types/telemetry';

export default function DevCaptureScreen() {
  // Banc de développement : inaccessible en production, deep link compris.
  if (!__DEV__) return <Redirect href={'/(app2)' as never} />;
  return <DevCaptureInner />;
}

function DevCaptureInner() {
  const insets = useSafeAreaInsets();

  const [bleStatus, setBleStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState<boolean>(isCapturing());
  const [reconnect, setReconnect] = useState<ReconnectState>(bluetoothService.getReconnectState());
  const [, setTick] = useState(0);
  const [lastUri, setLastUri] = useState<string | null>(getLastSavedUri());
  const [actionError, setActionError] = useState<string | null>(null);
  const [lapStatus, setLapStatus] = useState<LapDetectorStatus>(getLapDetectorStatus());

  // Circuits RÉELS de la base — plus aucune ligne d'arrivée en dur.
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [circuitId, setCircuitId] = useState<string | null>(null);
  const [circuitsError, setCircuitsError] = useState<string | null>(null);

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

  useEffect(() => {
    let annule = false;
    fetchCircuits()
      .then((rows) => {
        if (annule) return;
        setCircuits(rows);
        // Présélection : le circuit marqué par défaut, sinon le premier.
        // Jamais de repli inventé — si la liste est vide, rien n'est choisi.
        setCircuitId(rows.find((c) => c.isDefault)?.id ?? rows[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!annule) setCircuitsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      annule = true;
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
  const circuit = circuits.find((c) => c.id === circuitId) ?? null;

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

  const onStartCapture = () => {
    setActionError(null);
    startCapture();
    setCapturing(true);
  };

  const onStopCapture = async () => {
    setActionError(null);
    try {
      setLastUri(await stopCapture());
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

  const onStartLapDetection = useCallback(() => {
    // Sans circuit chargé, on ne démarre pas : une ligne d'arrivée inventée
    // produirait des tours qui ne veulent rien dire.
    if (!circuit) return;
    startLapDetection({
      finishLineLat: circuit.finishLineLat,
      finishLineLon: circuit.finishLineLon,
      finishLineRadiusM: circuit.finishLineRadiusM,
      finishLineHeadingDeg: circuit.finishLineHeading,
    });
    setLapStatus(getLapDetectorStatus());
  }, [circuit]);

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
      circuitId,
      vehicleId: null,
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.chevron}>‹</Text>
        </PressScale>
        <Text style={styles.headerTitle} accessibilityRole="header">
          BANC DE CAPTURE
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: insets.bottom + space.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Banniere
          bleStatus={bleStatus}
          connected={connected}
          capturing={capturing}
          reconnect={reconnect}
        />

        <SectionHeader eyebrow="BLE" />
        <Ligne label="État" value={etatBleEnMots(bleStatus)} alerte={bleStatus === 'error'} />
        {bleError ? <Ligne label="Erreur" value={bleError} alerte /> : null}
        <View style={styles.actions}>
          {bleStatus !== 'scanning' && !connected ? (
            <Button label="Chercher un boîtier" onPress={onScan} />
          ) : null}
          {bleStatus === 'scanning' ? (
            <Button
              label="Arrêter la recherche"
              variant="ghost"
              onPress={() => bluetoothService.stopScan()}
            />
          ) : null}
          {connected ? (
            <Button
              label="Déconnecter"
              variant="ghost"
              onPress={() => void bluetoothService.disconnect()}
            />
          ) : null}
        </View>

        {!connected && devices.length > 0 ? (
          <>
            <SectionHeader eyebrow="BOÎTIERS DÉTECTÉS" count={devices.length} />
            {devices.map((d) => (
              <PressScale
                key={d.id}
                onPress={() => void onConnect(d.id)}
                accessibilityRole="button"
                accessibilityLabel={`Se lier à ${d.name}`}
              >
                <View style={styles.boitier}>
                  <Text style={styles.boitierNom}>{d.name}</Text>
                  <Text style={styles.boitierMeta}>
                    {d.id}
                    {d.rssi !== null ? ` · RSSI ${d.rssi}` : ''}
                  </Text>
                </View>
              </PressScale>
            ))}
          </>
        ) : null}

        {connected ? (
          <>
            <SectionHeader eyebrow="TRAMES UBX BRUTES" />
            <Ligne label="État" value={capturing ? 'EN COURS' : 'arrêtée'} />
            <Ligne label="Blocs reçus" value={liveStats.chunkCount.toLocaleString('fr-FR')} mono />
            <Ligne
              label="Octets"
              value={`${liveStats.byteCount.toLocaleString('fr-FR')} (~${(
                liveStats.byteCount / 1024
              ).toFixed(1)} ko)`}
              mono
            />
            <Ligne
              label="Durée"
              value={
                liveStats.durationMs > 0 ? `${Math.floor(liveStats.durationMs / 1000)} s` : '—'
              }
              mono
            />
            <View style={styles.actions}>
              <Button
                label={capturing ? 'Arrêter et enregistrer' : 'Démarrer la capture'}
                onPress={capturing ? () => void onStopCapture() : onStartCapture}
              />
            </View>
            {actionError ? <Ligne label="Erreur" value={actionError} alerte /> : null}
            {lastUri ? (
              <View style={styles.actions}>
                <Text style={styles.note}>Dernière capture : {lastUri.split('/').pop()}</Text>
                <Button
                  label="Partager le fichier .ubx"
                  variant="ghost"
                  onPress={() => void onShare()}
                />
              </View>
            ) : null}
          </>
        ) : null}

        {connected ? (
          <>
            <SectionHeader eyebrow="DÉTECTION DE TOURS" />
            {circuitsError ? (
              <Ligne label="Circuits" value={circuitsError} alerte />
            ) : circuits.length === 0 ? (
              <Text style={styles.note}>
                Aucun circuit chargé. La détection reste inerte tant qu&apos;une ligne
                d&apos;arrivée réelle n&apos;est pas disponible.
              </Text>
            ) : (
              <>
                <View style={styles.chips}>
                  {circuits.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      active={c.id === circuitId}
                      onPress={() => setCircuitId(c.id)}
                    />
                  ))}
                </View>
                {circuit ? (
                  <>
                    <Ligne
                      label="Ligne d'arrivée"
                      value={`${circuit.finishLineLat.toFixed(5)} · ${circuit.finishLineLon.toFixed(5)}`}
                      mono
                    />
                    <Ligne
                      label="Mode"
                      value={
                        circuit.finishLineHeading !== null
                          ? `porte, cap ${circuit.finishLineHeading}°, demi-largeur ${circuit.finishLineRadiusM} m`
                          : `rayon ${circuit.finishLineRadiusM} m`
                      }
                    />
                  </>
                ) : null}
              </>
            )}

            <Ligne label="Détecteur" value={lapStatus.active ? 'actif' : 'inactif'} />
            <Ligne label="Passages ligne (bruts)" value={lapStatus.rawCrossings} mono />
            <Ligne label="Tours enregistrés" value={sessionLapCount} mono />
            {sessionBestLapMs !== null ? (
              <Ligne
                label="Meilleur tour"
                value={`${(sessionBestLapMs / 1000).toFixed(3)} s`}
                mono
              />
            ) : null}

            <View style={styles.actions}>
              <Button
                label={lapStatus.active ? 'Arrêter la détection' : 'Démarrer la détection'}
                variant={lapStatus.active ? 'ghost' : 'primary'}
                onPress={lapStatus.active ? onStopLapDetection : onStartLapDetection}
                disabled={!lapStatus.active && circuit === null}
                accessibilityLabel={
                  !lapStatus.active && circuit === null
                    ? 'Démarrer la détection — choisissez d’abord un circuit'
                    : undefined
                }
              />
            </View>
          </>
        ) : null}

        <SectionHeader eyebrow="SÉANCE DE TEST" />
        <Ligne label="Statut" value={sessionStatus} />
        <Ligne label="Marqueurs Flic" value={markers.length} mono />
        <View style={styles.actions}>
          <Button
            label={
              sessionStatus === 'recording' || sessionStatus === 'paused'
                ? 'Arrêter la séance'
                : 'Démarrer la séance'
            }
            variant={
              sessionStatus === 'recording' || sessionStatus === 'paused' ? 'ghost' : 'primary'
            }
            onPress={
              sessionStatus === 'recording' || sessionStatus === 'paused'
                ? () => useSessionStore.getState().endSession()
                : onStartTestSession
            }
          />
        </View>

        <SectionHeader eyebrow="FLIC 2 — SIMULATION" />
        <Text style={styles.note}>
          Pas de scan BLE réel pour le bouton : simulez un clic et vérifiez qu&apos;un marqueur
          s&apos;ajoute à la séance active.
        </Text>
        <View style={styles.chips}>
          <Chip label="Simple" onPress={() => flic2Service.simulateClick('good')} />
          <Chip label="Double" onPress={() => flic2Service.simulateClick('incident')} />
          <Chip label="Triple" onPress={() => flic2Service.simulateClick('question')} />
        </View>

        {markers.length > 0 ? (
          <View style={styles.marqueurs}>
            {markers
              .slice(-5)
              .reverse()
              .map((m, i) => (
                <Text key={`${m.at}-${i}`} style={styles.marqueur}>
                  {new Date(m.at).toLocaleTimeString('fr-FR')} — {m.kind} (tour {m.lapNumber ?? '—'}
                  )
                </Text>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Présentation pure — traduction d'un état déjà calculé en mots lisibles.
// ---------------------------------------------------------------------------

function etatBleEnMots(status: BleStatus): string {
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

/**
 * Bandeau d'état dominant : sur site, l'opérateur doit lire d'un coup d'œil où
 * en est le lien. Du plus critique au plus calme —
 *   1. LIAISON PERDUE     reconnexion auto épuisée, terminal (accent) ;
 *   2. RECONNEXION…       lien tombé, tentatives en cours (n/N) ;
 *   3. EN ENREGISTREMENT  capture nominale ;
 *   4. CONNECTÉ           boîtier lié, prêt ;
 *   5. DÉCONNECTÉ         repos.
 *
 * Les états 1 et 2 sont volontairement distincts d'un repos nominal : il ne
 * faut JAMAIS laisser croire qu'on enregistre alors que le boîtier a décroché.
 * Seul le cas terminal porte l'accent — le reste se lit au mot.
 */
function Banniere({
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
  let titre: string;
  let sous: string;
  let alerte = false;

  if (reconnect.phase === 'lost') {
    titre = 'LIAISON PERDUE';
    sous =
      'Reconnexion impossible après plusieurs tentatives. Vérifiez le boîtier, puis relancez une recherche.';
    alerte = true;
  } else if (reconnect.phase === 'reconnecting') {
    titre = 'RECONNEXION…';
    sous = `Lien interrompu — tentative ${Math.max(reconnect.attempt, 1)}/${reconnect.maxAttempts}. La capture reprend dès le lien rétabli.`;
  } else if (capturing) {
    titre = 'EN ENREGISTREMENT';
    sous = 'Le boîtier transmet — les trames sont capturées.';
  } else if (connected) {
    titre = 'CONNECTÉ';
    sous = 'Boîtier lié. Prêt à enregistrer.';
  } else {
    titre = 'DÉCONNECTÉ';
    sous = `Aucun boîtier lié (${etatBleEnMots(bleStatus)}).`;
  }

  return (
    <View
      style={[styles.banniere, alerte ? styles.banniereAlerte : null]}
      accessible
      accessibilityLabel={`${titre}. ${sous}`}
    >
      <Text style={[styles.banniereTitre, alerte ? styles.banniereTitreAlerte : null]}>
        {titre}
      </Text>
      <Text style={styles.banniereSous}>{sous}</Text>
    </View>
  );
}

function Ligne({
  label,
  value,
  mono = false,
  alerte = false,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
  alerte?: boolean;
}) {
  return (
    <View style={styles.ligne} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={styles.ligneLabel}>{label}</Text>
      <Text
        style={[
          mono ? styles.ligneValeurMono : styles.ligneValeur,
          alerte ? styles.ligneValeurAlerte : null,
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
  chevron: { fontFamily: typo.body, fontSize: 30, color: colors.text.hi, lineHeight: 34 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 2.4,
    color: colors.text.mid,
  },
  headerSpacer: { width: 30 },

  banniere: {
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    backgroundColor: colors.bg.card2,
    padding: space.lg,
    marginBottom: space.lg,
  },
  banniereAlerte: { borderColor: colors.accent },
  banniereTitre: {
    fontFamily: typo.mono,
    fontSize: 14,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  banniereTitreAlerte: { color: colors.accent },
  banniereSous: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.sm,
  },

  ligne: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  ligneLabel: { fontFamily: typo.mono, fontSize: 11, letterSpacing: 0.6, color: colors.text.dim },
  ligneValeur: {
    fontFamily: typo.body,
    fontSize: 13,
    color: colors.text.hi,
    textAlign: 'right',
    flexShrink: 1,
  },
  ligneValeurMono: {
    fontFamily: typo.mono,
    fontSize: 14,
    color: colors.text.hi,
    textAlign: 'right',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  ligneValeurAlerte: { color: colors.accent },

  actions: { gap: space.sm, marginTop: space.md, marginBottom: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md },

  boitier: {
    borderWidth: 1,
    borderColor: colors.border.card,
    borderRadius: radius.cell,
    padding: space.md,
    marginBottom: space.sm,
  },
  boitierNom: { fontFamily: typo.bodyMedium, fontSize: 15, color: colors.text.hi },
  boitierMeta: { fontFamily: typo.mono, fontSize: 11, color: colors.text.dim, marginTop: 2 },

  note: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.sm,
    marginBottom: space.sm,
  },
  marqueurs: { marginTop: space.md },
  marqueur: { fontFamily: typo.mono, fontSize: 12, color: colors.text.mid, marginBottom: 4 },
});
