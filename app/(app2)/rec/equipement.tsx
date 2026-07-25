/**
 * ÉQUIPEMENT — écran 4/8 du lot V2-L2 (porte REC). Route `rec/equipement`
 * (segment masquant la TabBar : cf. V2_HIDDEN_SEGMENTS).
 *
 * PEAU sensorielle sur les services BLE v1 INTACTS : mêmes appels que
 * `app/(app)/equipement.tsx` (bluetoothService scan/connexion, mémoire du
 * dernier boîtier via SecureStore, boîtier affecté via getMyAssignedDevice).
 * AUCUNE logique de capture ni de state-machine ici — l'appairage BLE et la
 * navigation vers Placement sont exactement ceux de la v1.
 *
 * Mise en scène (V2) :
 *   1. Scan théâtralisé : anneau radar Skia (balayage lent) + boîtiers trouvés
 *      en Stagger. Carte du boîtier appairé : pastille de connexion pulsée une
 *      fois, batterie en RollingCounter, n° de série mono.
 *   2. Ceinture Polar (coachés) : carte « À appairer au paddock par le staff »
 *      + lien vers le consentement. (Scan Polar réel = BIO-2, hors lot.)
 *   3. Consentement biométrie : Sheet plein, deux cases distinctes (capture /
 *      partage coach), écriture via consentService (garde-fou dans le service),
 *      fail-closed.
 *   4. Rappel Watch phase A : gaté par shouldOfferWatchReminder (4 conditions).
 *      Drapeau `biometry` OFF aujourd'hui → tout le bloc biométrie est absent.
 *
 * Doctrine : FR vouvoyé, zéro emoji, jamais prescriptif, tout consentement
 * fail-closed. Skia natif (dev-client EAS), pas d'Expo Go.
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Canvas, Circle } from '@shopify/react-native-skia';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { bluetoothService, type PolarDevice } from '@/ble/bluetoothService';
import { requestBlePermissions } from '@/ble/permissions';
import {
  clampBatteryLevel,
  deriveScanPhase,
  deviceBadge,
  displayDeviceName,
  formatBatteryValue,
  isMyDevice,
  orderDevices,
  serialFromDeviceName,
  shouldOfferWatchReminder,
} from '@/features/rec/equipementLogic';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  loadBiometryConsents,
  setBiometryCaptureConsent,
  setBiometryCoachShareConsent,
} from '@/services/consentService';
import { getMyAssignedDevice, type MyDevice } from '@/services/deviceHealthService';
import { listMyCoaches } from '@/services/pilotConsentService';
import { useAuthStore } from '@/store/useAuthStore';
import type { BleStatus, RaceBoxData, RaceBoxDevice } from '@/types/telemetry';
import {
  GlowStroke,
  ListRow,
  OxvIcon,
  PressScale,
  RollingCounter,
  SectionHeader,
  Sheet,
  StateView,
  colors,
  radius,
  space,
  staggerEntering,
  tabBarSpace,
  typo,
  useDoorTransition,
  useReduceMotion,
} from '@/ui/v2';

const SCAN_TIMEOUT_MS = 30_000;
/** Mémoire du dernier boîtier appairé — partagée avec la v1 (même clé). */
const LAST_DEVICE_KEY = 'oxv.lastPairedDeviceId';
/** Dernière ceinture cardio appairée (mémoire par pilote, patron RaceBox). */
const LAST_BELT_KEY = 'oxv.lastPairedBeltId';
/** Temps d'affichage de la carte « appairé » avant d'ouvrir Placement. */
const PAIRED_REVEAL_MS = 1400;
const RADAR_SIZE = 208;

// ---------------------------------------------------------------------------
// Chevron retour (aucune flèche dans le registre d'icônes — trait local)
// ---------------------------------------------------------------------------

function BackChevron() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M14.5 5 L8 12 L14.5 19"
        stroke={colors.text.hi}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Radar de scan — anneaux Skia statiques + balayage radial qui tourne lentement
// ---------------------------------------------------------------------------

function ScanRadar() {
  const reduce = useReduceMotion();
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    angle.value = 0;
    angle.value = withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(angle);
  }, [reduce, angle]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }],
  }));

  const size = RADAR_SIZE;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.46;
  const rings = [rOuter, size * 0.32, size * 0.18];

  // Fan de rayons décroissants derrière le bord d'attaque (0° = midi) : la
  // traîne du balayage. 0=top, sens horaire ; calcul JS pur (aucun flag d'arc).
  const trail = [0, 8, 16, 24, 32].map((deg, i) => {
    const th = (-deg * Math.PI) / 180;
    const x = cx + rOuter * Math.sin(th);
    const y = cy - rOuter * Math.cos(th);
    return { path: `M ${cx} ${cy} L ${x} ${y}`, opacity: 1 - i * 0.2 };
  });

  return (
    <View
      style={styles.radar}
      accessible
      accessibilityLabel="Recherche de votre équipement en cours"
    >
      <Canvas
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {rings.map((r, i) => (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            style="stroke"
            strokeWidth={1}
            color={colors.border.card}
          />
        ))}
        <Circle cx={cx} cy={cy} r={3} color={colors.accent} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
        <Canvas
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {trail.map((seg, i) => (
            <GlowStroke key={i} path={seg.path} strokeWidth={2} opacity={seg.opacity} />
          ))}
        </Canvas>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pastille de connexion — pulsée UNE fois à l'appairage
// ---------------------------------------------------------------------------

function PairedDot() {
  const reduce = useReduceMotion();
  const ring = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    ring.value = 0;
    ring.value = withSequence(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })
    );
  }, [reduce, ring]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - ring.value),
    transform: [{ scale: 1 + ring.value * 1.6 }],
  }));

  return (
    <View style={styles.dotWrap}>
      {/* Onde de connexion (une fois). Couleur : jeton QDI vert utilisé ICI
          comme SEUL signal d'état « appairé » (go), jamais un fond ni une
          donnée — tension de doctrine signalée au fondateur. */}
      <Animated.View style={[styles.dotPulse, ringStyle]} />
      <View style={styles.dotCore} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Case à cocher (consentement) — carré hairline, coche accent
// ---------------------------------------------------------------------------

function CheckRow({
  checked,
  title,
  hint,
  onToggle,
}: {
  checked: boolean;
  title: string;
  hint: string;
  onToggle: () => void;
}) {
  return (
    <PressScale
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
    >
      <View style={styles.checkRow}>
        <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
          {checked ? (
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path
                d="M5 12.5 L10 17.5 L19 6.5"
                stroke={colors.text.hi}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          ) : null}
        </View>
        <View style={styles.checkLabels}>
          <Text style={styles.checkTitle}>{title}</Text>
          <Text style={styles.checkHint}>{hint}</Text>
        </View>
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Feuille de consentement biométrie (texte = docs/juridique/consentement_biometrie.md,
// source avocat qui fait foi — tenir ce bloc synchronisé avec le .md).
// ---------------------------------------------------------------------------

function ConsentSheet({
  visible,
  initialCapture,
  initialShare,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialCapture: boolean;
  initialShare: boolean;
  onClose: () => void;
  onSave: (capture: boolean, share: boolean) => void;
}) {
  const { height } = useWindowDimensions();
  const [capture, setCapture] = useState(initialCapture);
  const [share, setShare] = useState(initialShare);

  // Réinitialise le brouillon sur l'état persisté à chaque ouverture.
  useEffect(() => {
    if (visible) {
      setCapture(initialCapture);
      setShare(initialShare);
    }
  }, [visible, initialCapture, initialShare]);

  // Invariant (miroir du garde-fou du service) : le partage implique la capture.
  const toggleCapture = () => {
    setCapture((prev) => {
      const next = !prev;
      if (!next) setShare(false); // couper la capture coupe le partage
      return next;
    });
  };
  const toggleShare = () => {
    setShare((prev) => {
      const next = !prev;
      if (next) setCapture(true); // partager suppose capter
      return next;
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} snapHeight={Math.round(height * 0.86)}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
        <View style={styles.sheetHead}>
          <OxvIcon name="coeur" size={26} color={colors.text.hi} />
          <Text style={styles.sheetTitle}>Biométrie cardiaque</Text>
        </View>

        <Text style={styles.sheetPara}>
          Nous mesurons votre fréquence cardiaque pendant vos sessions, rien d’autre. Selon votre
          équipement : votre Apple Watch (mesure au poignet, indicative) ou une ceinture Polar
          appairée au paddock par le staff (mesure de précision).
        </Text>
        <Text style={styles.sheetPara}>
          Aucune donnée cardiaque ne s’affiche pendant que vous roulez. La restitution se fait à
          l’arrêt, pour une lecture posée de votre séance.
        </Text>
        <Text style={styles.sheetPara}>
          Vous seul y avez accès. Votre coach ne la voit que si vous l’y autorisez. Vos données sont
          conservées 30 jours, puis supprimées.
        </Text>

        <View style={styles.sheetChecks}>
          <CheckRow
            checked={capture}
            title="Capter ma fréquence cardiaque en séance"
            hint="Active la mesure et sa restitution, pour vous seul."
            onToggle={toggleCapture}
          />
          <CheckRow
            checked={share}
            title="Partager avec mon coach"
            hint="Ouvre à votre coach l’analyse détaillée de votre cardio. Suppose la capture."
            onToggle={toggleShare}
          />
        </View>

        <Text style={styles.sheetNote}>
          Désactivé par défaut. Vous pouvez le retirer à tout moment, en un geste.
        </Text>

        <PressScale
          onPress={() => onSave(capture, share)}
          accessibilityLabel="Accorder"
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnLabel}>Accorder</Text>
        </PressScale>
        <PressScale
          onPress={() => onSave(false, false)}
          accessibilityLabel="Refuser"
          style={styles.ghostBtn}
        >
          {/* « Refuser » = révocation EXPLICITE (vérif L2 [8]) : écrit
              capture=false/share=false via onSave, jamais un simple close qui
              laisserait un consentement pré-coché intact. */}
          <Text style={styles.ghostBtnLabel}>Refuser</Text>
        </PressScale>
      </ScrollView>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function EquipementScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);

  const [status, setStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [myDevice, setMyDevice] = useState<MyDevice | null>(null);
  const [lastPairedId, setLastPairedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);

  // Biométrie — tout fail-closed (défaut false, jamais bloquant).
  const [biometryFlagOn, setBiometryFlagOn] = useState(false);
  const [isCoached, setIsCoached] = useState(false);
  const [captureConsent, setCaptureConsent] = useState(false);
  const [coachShareConsent, setCoachShareConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  // Ceinture cardio (BIO-2, L2) — état SÉPARÉ du RaceBox : le scan cardio ne
  // s'ouvre QUE sous drapeau + consentement de capture (gate absolue), et son
  // échec n'affecte jamais l'appairage du boîtier.
  const [belts, setBelts] = useState<PolarDevice[]>([]);
  const [beltScanning, setBeltScanning] = useState(false);
  const [beltConnectedId, setBeltConnectedId] = useState<string | null>(null);
  const [lastBeltId, setLastBeltId] = useState<string | null>(null);
  const [beltContact, setBeltContact] = useState<'ok' | 'poor' | 'unsupported' | null>(null);

  // Boîtier affecté (alias flotte) + dernier appairé — best-effort (v1).
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
    SecureStore.getItemAsync(LAST_BELT_KEY)
      .then((v) => {
        if (!cancelled) setLastBeltId(v);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Ceinture — abonnements cardio, montés SEULEMENT sous drapeau + consentement
  // de capture. Sans consentement, RIEN n'écoute la santé (fail-closed).
  const beltAllowed = biometryFlagOn && captureConsent;
  useEffect(() => {
    if (!beltAllowed) return;
    const offFound = bluetoothService.onPolarDeviceFound((d) => {
      setBelts((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
    });
    // Le contact peau est un FAIT de capteur (pastille), jamais une alerte.
    const offBio = bluetoothService.onBiometry((s) => setBeltContact(s.contact));
    return () => {
      offFound();
      offBio();
      bluetoothService.stopPolarScan();
    };
  }, [beltAllowed]);

  const onScanBelt = useCallback(async () => {
    if (!beltAllowed) {
      setConsentOpen(true); // pas de consentement → on renvoie vers la feuille
      return;
    }
    setBelts([]);
    setBeltScanning(true);
    const perm = await requestBlePermissions();
    if (!perm.granted) {
      setBeltScanning(false);
      setError(`Permissions Bluetooth refusées : ${perm.missing.join(', ')}`);
      return;
    }
    await bluetoothService.startPolarScan().catch(() => undefined);
    setTimeout(() => {
      bluetoothService.stopPolarScan();
      setBeltScanning(false);
    }, SCAN_TIMEOUT_MS);
  }, [beltAllowed]);

  const onSelectBelt = useCallback(async (deviceId: string) => {
    bluetoothService.stopPolarScan();
    setBeltScanning(false);
    await bluetoothService.connectPolar(deviceId).catch(() => undefined);
    if (bluetoothService.isPolarConnected()) {
      setBeltConnectedId(deviceId);
      SecureStore.setItemAsync(LAST_BELT_KEY, deviceId).catch(() => undefined);
    }
  }, []);

  // Abonnements BLE (services v1 intacts).
  useEffect(() => {
    const offStatus = bluetoothService.onStatusChange(setStatus);
    const offDevice = bluetoothService.onDeviceFound((d) => {
      setDevices((prev) => (prev.some((p) => p.id === d.id) ? prev : [...prev, d]));
    });
    const offError = bluetoothService.onError(setError);
    const offData = bluetoothService.onData((frame: RaceBoxData) => {
      const level = clampBatteryLevel(frame.battery?.level);
      if (level !== null) setBattery(level);
    });
    return () => {
      offStatus();
      offDevice();
      offError();
      offData();
    };
  }, []);

  // Gating biométrie (best-effort). Le drapeau OFF garde tout le bloc absent.
  useEffect(() => {
    let cancelled = false;
    isFlagEnabled('biometry')
      .then((v) => {
        if (!cancelled) setBiometryFlagOn(v);
      })
      .catch(() => undefined);
    listMyCoaches()
      .then((list) => {
        if (!cancelled) setIsCoached(list.some((a) => a.active));
      })
      .catch(() => undefined);
    if (profile?.id) {
      loadBiometryConsents(profile.id)
        .then((c) => {
          if (!cancelled) {
            setCaptureConsent(c.capture);
            setCoachShareConsent(c.coachShare);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Appairé : mémorise le boîtier puis ouvre Placement après un temps de
  // confirmation. La transition BLE→Placement est celle de la v1 (aucune
  // logique de capture ici) ; seul le délai de confirmation est nouveau.
  useEffect(() => {
    if (status !== 'connected') return;
    if (selectedId) {
      SecureStore.setItemAsync(LAST_DEVICE_KEY, selectedId).catch(() => undefined);
    }
    const timer = setTimeout(() => {
      router.replace('/(app2)/rec/placement' as never);
    }, PAIRED_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [status, selectedId]);

  // Scan au montage (permissions + timeout) — identique à la v1.
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
          setError(
            (prev) =>
              prev ??
              "Aucun équipement détecté. Vérifiez qu'il est allumé et proche de votre téléphone."
          );
        }
      }, SCAN_TIMEOUT_MS);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      bluetoothService.stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelect = useCallback(async (deviceId: string) => {
    setConnecting(true);
    setSelectedId(deviceId);
    setError(null);
    bluetoothService.stopScan();
    await bluetoothService.connect(deviceId);
    setConnecting(false);
  }, []);

  const onRescan = useCallback(() => {
    setError(null);
    setDevices([]);
    bluetoothService.startScan();
  }, []);

  const mySerial = myDevice?.serial ?? null;
  const phase = deriveScanPhase({ status, deviceCount: devices.length, error, connecting });
  const ordered = orderDevices(devices, { mySerial, lastPairedId });

  const pairedDevice = devices.find((d) => d.id === selectedId) ?? null;
  const pairedName = pairedDevice
    ? isMyDevice(pairedDevice, mySerial) && myDevice?.alias
      ? myDevice.alias
      : displayDeviceName(pairedDevice.name)
    : (myDevice?.alias ?? 'Boîtier OXV Mirror');
  const pairedSerial = pairedDevice ? serialFromDeviceName(pairedDevice.name) : mySerial;

  const showWatchReminder = shouldOfferWatchReminder({
    biometryFlagOn,
    captureConsent,
    hasPolarBelt: isCoached,
    isIOS: Platform.OS === 'ios',
  });

  const onSaveConsent = useCallback(
    async (capture: boolean, share: boolean) => {
      setConsentOpen(false);
      if (!profile?.id) return;
      // Fail-closed : on n'écrit QUE les changements réels (rien coché et rien
      // en base ⇒ aucune écriture). Le garde-fou partage⇒capture est DANS le
      // service ; l'invariant UI (CheckRow) le reflète déjà.
      try {
        if (capture !== captureConsent) await setBiometryCaptureConsent(profile.id, capture);
        if (share !== coachShareConsent) await setBiometryCoachShareConsent(profile.id, share);
        setCaptureConsent(capture);
        setCoachShareConsent(share);
      } catch {
        // best-effort — jamais bloquant
      }
    },
    [profile?.id, captureConsent, coachShareConsent]
  );

  const isPairing = phase === 'connecting' || phase === 'connected';

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <BackChevron />
        </PressScale>
        <Text style={styles.title}>ÉQUIPEMENT</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: space.xl,
          paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
        }}
      >
        {isPairing ? (
          // -- Carte du boîtier appairé -------------------------------------
          <View style={styles.pairedCard}>
            <View style={styles.pairedTop}>
              <PairedDot />
              <View style={styles.pairedNames}>
                <Text style={styles.pairedLabel}>
                  {phase === 'connected' ? 'Boîtier appairé' : 'Connexion…'}
                </Text>
                <Text style={styles.pairedName} numberOfLines={1}>
                  {pairedName}
                </Text>
              </View>
            </View>

            <View style={styles.pairedMeta}>
              <View style={styles.pairedMetaCell}>
                <Text style={styles.metaEyebrow}>BATTERIE</Text>
                <View style={styles.batteryRow}>
                  <RollingCounter value={formatBatteryValue(battery)} fontSize={30} />
                  <Text style={styles.batteryUnit}>%</Text>
                </View>
              </View>
              <View style={styles.pairedMetaCell}>
                <Text style={styles.metaEyebrow}>N° DE SÉRIE</Text>
                <Text style={styles.serial}>{pairedSerial ?? '—'}</Text>
              </View>
            </View>
          </View>
        ) : (
          // -- Scan ---------------------------------------------------------
          <>
            <Text style={styles.lede} accessibilityRole="header">
              À la recherche de votre équipement.
            </Text>

            {phase === 'scanning' ? (
              <ScanRadar />
            ) : phase === 'error' ? (
              <StateView
                state="error"
                errorMessage={error ?? 'Le scan a échoué.'}
                onRetry={onRescan}
                style={styles.stateGap}
              />
            ) : phase === 'empty' ? (
              <StateView
                state="empty"
                emptyMessage="Aucun équipement à portée. Vérifiez qu'il est allumé et proche de votre téléphone."
                style={styles.stateGap}
              />
            ) : null}

            {ordered.length > 0 ? (
              <View style={styles.list}>
                <SectionHeader eyebrow="À PORTÉE" count={ordered.length} />
                {ordered.map((d, index) => {
                  const badge = deviceBadge(d, { mySerial, lastPairedId });
                  const name =
                    isMyDevice(d, mySerial) && myDevice?.alias
                      ? myDevice.alias
                      : displayDeviceName(d.name);
                  const signal = d.rssi !== null ? `Signal ${d.rssi} dBm` : 'À portée';
                  return (
                    <Animated.View key={d.id} entering={staggerEntering(index)}>
                      <PressScale
                        onPress={() => onSelect(d.id)}
                        disabled={connecting}
                        accessibilityLabel={`${name}${badge ? `, ${badge}` : ''}, ${signal}`}
                        style={styles.deviceCard}
                      >
                        <View style={styles.deviceLeft}>
                          <OxvIcon name="cle" size={20} color={colors.text.mid} />
                          <View style={styles.deviceLabels}>
                            <Text style={styles.deviceName} numberOfLines={1}>
                              {name}
                            </Text>
                            {badge ? (
                              <Text style={styles.deviceBadge}>{badge.toUpperCase()}</Text>
                            ) : null}
                            <Text style={styles.deviceSignal}>{signal}</Text>
                          </View>
                        </View>
                        <Text style={styles.chevron}>›</Text>
                      </PressScale>
                    </Animated.View>
                  );
                })}
              </View>
            ) : null}
          </>
        )}

        {/* -- Bloc biométrie (gaté par le drapeau, fail-closed) --------------
            Aujourd'hui le drapeau `biometry` est OFF → ce bloc est absent. */}
        {biometryFlagOn ? (
          <View style={styles.bioBlock}>
            <SectionHeader eyebrow="BIOMÉTRIE" />

            {/* Ceinture cardio — appairage RÉEL (BIO-2, L2). GATE ABSOLUE : sans
                consentement de capture, la ligne renvoie vers la feuille de
                consentement et aucun scan cardio n'est ouvert. Le contact peau
                est un FAIT de capteur affiché tel quel, jamais une alerte. */}
            {isCoached ? (
              <>
                <ListRow
                  icon="ceinture"
                  label="Ceinture Polar"
                  sublabel={
                    !captureConsent
                      ? 'Consentement requis pour appairer'
                      : beltConnectedId !== null
                        ? beltContact === 'ok'
                          ? 'Appairée · contact établi'
                          : beltContact === 'poor'
                            ? 'Appairée · contact faible'
                            : 'Appairée'
                        : beltScanning
                          ? 'Recherche en cours…'
                          : lastBeltId !== null
                            ? 'Déjà appairée · à reconnecter'
                            : 'À appairer'
                  }
                  value={
                    !captureConsent
                      ? 'Consentement'
                      : beltConnectedId !== null
                        ? undefined
                        : 'Chercher'
                  }
                  onPress={beltConnectedId !== null ? undefined : onScanBelt}
                  chevron={beltConnectedId === null}
                />

                {beltAllowed && beltConnectedId === null
                  ? belts.map((b) => (
                      <ListRow
                        key={b.id}
                        icon="ceinture"
                        label={b.name}
                        sublabel={b.id === lastBeltId ? 'Déjà appairée' : 'Détectée'}
                        onPress={() => onSelectBelt(b.id)}
                        chevron
                      />
                    ))
                  : null}
              </>
            ) : null}

            <ListRow
              icon="coeur"
              label="Biométrie cardiaque"
              sublabel={
                captureConsent
                  ? coachShareConsent
                    ? 'Capture et partage coach activés'
                    : 'Capture activée'
                  : 'Non activée'
              }
              onPress={() => setConsentOpen(true)}
            />

            {showWatchReminder ? (
              <ListRow
                icon="montre"
                label="Lancez un entraînement sur votre Watch"
                sublabel="Pour mesurer votre fréquence cardiaque pendant la séance"
                divider={false}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <ConsentSheet
        visible={consentOpen}
        initialCapture={captureConsent}
        initialShare={coachShareConsent}
        onClose={() => setConsentOpen(false)}
        onSave={onSaveConsent}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  headerSpacer: {
    width: 22,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  lede: {
    fontFamily: typo.bodySemi,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text.hi,
    marginTop: space.md,
    marginBottom: space.xl,
  },
  radar: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignSelf: 'center',
    marginVertical: space.lg,
  },
  stateGap: {
    marginTop: space.lg,
  },
  list: {
    marginTop: space.xl,
    gap: space.sm,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  deviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
    paddingRight: space.md,
  },
  deviceLabels: {
    flex: 1,
  },
  deviceName: {
    fontFamily: typo.bodyMedium,
    fontSize: 16,
    color: colors.text.hi,
  },
  deviceBadge: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.text.low,
    marginTop: 2,
  },
  deviceSignal: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.low,
    marginTop: 2,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 20,
    lineHeight: 20,
    color: colors.text.dim,
  },
  // Carte appairé
  pairedCard: {
    marginTop: space.xl,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
    borderRadius: radius.hero,
    padding: space.xl,
  },
  pairedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  pairedNames: {
    flex: 1,
  },
  pairedLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  pairedName: {
    fontFamily: typo.bodySemi,
    fontSize: 18,
    color: colors.text.hi,
    marginTop: 2,
  },
  pairedMeta: {
    flexDirection: 'row',
    gap: space.xl,
    marginTop: space.xl,
  },
  pairedMetaCell: {
    flex: 1,
  },
  metaEyebrow: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.text.low,
    marginBottom: space.sm,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  batteryUnit: {
    fontFamily: typo.mono,
    fontSize: 16,
    color: colors.text.mid,
    marginLeft: 2,
    marginBottom: 4,
  },
  serial: {
    fontFamily: typo.mono,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.text.hi,
  },
  // Pastille de connexion
  dotWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.text.hi, // vérif L2 [10] : pastille de statut = chrome neutre (QDI = données seules)
  },
  dotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text.hi, // vérif L2 [10] : pastille de statut = chrome neutre (QDI = données seules)
  },
  // Bloc biométrie
  bioBlock: {
    marginTop: space.xxl,
    gap: space.xs,
  },
  // Feuille de consentement
  sheetBody: {
    paddingBottom: space.lg,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  sheetTitle: {
    fontFamily: typo.display,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.text.hi,
  },
  sheetPara: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.mid,
    marginBottom: space.md,
  },
  sheetChecks: {
    marginTop: space.sm,
    gap: space.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.sm,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkLabels: {
    flex: 1,
  },
  checkTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
  },
  checkHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: 2,
  },
  sheetNote: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.low,
    marginTop: space.md,
    marginBottom: space.lg,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 0.5,
    color: colors.text.hi,
  },
  ghostBtn: {
    marginTop: space.sm,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ghostBtnLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.mid,
  },
});
