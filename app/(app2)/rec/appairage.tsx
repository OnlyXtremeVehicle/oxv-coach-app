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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { diagnostiquer, texteDiagnostic } from '@/features/rec/diagnosticBle';
import { batirPanneau } from '@/features/rec/panneauDiagnostic';
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
import { doitSolliciterConsentementBio } from '@/features/rec/consentementBioLogic';
import {
  loadBiometryConsents,
  loadBiometrySollicitation,
  markBiometryAsked,
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
import { REC_ROUTES } from '@/features/rec/captureStepLogic';

const SCAN_TIMEOUT_MS = 30_000;
/** Mémoire du dernier boîtier appairé — partagée avec la v1 (même clé). */
const LAST_DEVICE_KEY = 'oxv.lastPairedDeviceId';
/** Dernière ceinture cardio appairée (mémoire par pilote, patron RaceBox). */
const LAST_BELT_KEY = 'oxv.lastPairedBeltId';
/** Temps d'affichage de la carte « appairé » avant d'ouvrir Placement. */
const PAIRED_REVEAL_MS = 1400;

/**
 * Délai au-delà duquel la question de consentement est considérée comme sans
 * réponse, et la navigation libérée. Voir le garde-fou plus bas.
 */
const DELAI_SECOURS_CONSENTEMENT_MS = 8000;
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

// ---------------------------------------------------------------------------
// Feuille de consentement biométrie (texte = docs/juridique/consentement_biometrie.md,
// source avocat qui fait foi — tenir ce bloc synchronisé avec le .md).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Le panneau de diagnostic — deux colonnes qui ne se mélangent pas
// ---------------------------------------------------------------------------

/**
 * Ce que le téléphone a établi, et ce que seul le pilote peut regarder.
 *
 * La règle du plan tient en une phrase : « les quatre causes non vérifiables
 * sont posées en questions, jamais en affirmations ». Le rendu la respecte de
 * deux façons — les questions gardent leur point d'interrogation, et une ligne
 * vérifiée dont l'état est inconnu ne prend NI la couleur d'un succès NI celle
 * d'un échec. Elle reste au gris de fond, avec un tiret.
 *
 * Le tiret est le même que partout ailleurs dans l'application : une absence se
 * dit, elle ne se remplace pas par zéro ni par une supposition.
 */
function PanneauDiagnostic({
  cause,
  permissionIndeterminee,
}: {
  cause: string | null;
  permissionIndeterminee: boolean;
}) {
  const panneau = batirPanneau({
    cause,
    permissionIndeterminee,
    // Sur iOS la localisation n'est pas interrogeable : `app.json` ne déclare
    // que la poignée Bluetooth. Elle bascule alors du côté des questions.
    localisationLisible: Platform.OS === 'android',
  });

  return (
    <View style={styles.diagBloc}>
      <SectionHeader eyebrow="VÉRIFIÉ" />
      {panneau.verifie.map((l) => (
        <View key={l.cle} style={styles.diagLigne}>
          <Text
            style={[
              styles.diagMarque,
              l.etat === 'ok' && styles.diagMarqueOk,
              l.etat === 'echec' && styles.diagMarqueEchec,
            ]}
            accessibilityElementsHidden
          >
            {l.etat === 'ok' ? '·' : l.etat === 'echec' ? '×' : '—'}
          </Text>
          <View style={styles.diagTextes}>
            <Text
              style={styles.diagLibelle}
              accessibilityLabel={`${l.libelle} : ${
                l.etat === 'ok' ? 'en ordre' : l.etat === 'echec' ? 'bloquant' : 'non vérifiable'
              }`}
            >
              {l.libelle}
            </Text>
            {l.geste ? <Text style={styles.diagGeste}>{l.geste}</Text> : null}
          </View>
        </View>
      ))}

      <View style={styles.diagEspace} />
      <SectionHeader eyebrow="À REGARDER" />
      {panneau.questions.map((q) => (
        <Text key={q.cle} style={styles.diagQuestion}>
          {q.texte}
        </Text>
      ))}
    </View>
  );
}

export default function EquipementScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);

  const [status, setStatus] = useState<BleStatus>(bluetoothService.getStatus());
  const [devices, setDevices] = useState<RaceBoxDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  /**
   * Vrai quand la permission Bluetooth n'a PAS pu être lue — le `indetermine`
   * de `permissionsLogic`. Le panneau de diagnostic s'en sert pour ne pas
   * afficher en vert une ligne dont il ne sait rien.
   */
  const [permissionIndeterminee, setPermissionIndeterminee] = useState(false);
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
  /**
   * Sort de la feuille de consentement L21, du point de vue de la NAVIGATION.
   *
   * `inconnu` tant qu'on n'a pas fini d'interroger la base : la navigation vers
   * Placement attend. `ouverte` pendant que le pilote la lit. `fermee` dès qu'il
   * n'y a rien à demander, ou qu'il a refermé — la navigation repart alors.
   *
   * Un booléen n'aurait pas suffi : il aurait laissé « pas encore ouverte » et
   * « déjà refermée » se confondre, et la navigation serait partie sous la
   * requête. Trois états, parce qu'il y a trois situations.
   */
  /**
   * LA PORTE EST DEVENUE UNE DESTINATION, le 05/08/2026, en scindant l'écran.
   *
   * Elle valait `'inconnu' | 'ouverte' | 'fermee'` du temps où le consentement
   * était une feuille posée SUR cet écran. Le consentement étant maintenant un
   * écran à part, la question n'est plus « la feuille est-elle refermée » mais
   * « où va-t-on ensuite ».
   *
   * TROIS ÉTATS, toujours, et pour la même raison qu'avant : `'inconnu'` retient
   * la navigation pendant que les lectures sont en vol. Un booléen ferait
   * repartir le pilote vers `placement` avant que la réponse n'arrive, et la
   * question ne serait jamais posée.
   */
  const [destination, setDestination] = useState<'inconnu' | 'consentement' | 'placement'>(
    'inconnu'
  );

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
      // Pas de consentement : on renvoie vers l'écran qui le recueille, plutôt
      // que d'ouvrir une feuille qui n'existe plus.
      router.push(REC_ROUTES.consentement as never);
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
    // On ne navigue QUE lorsque le sort de la feuille de consentement est
    // tranché — pas ouverte, et pas encore inconnue.
    //
    // COURSE FERMÉE ICI. Le minuteur vaut 1,4 s ; une lecture de la base au
    // bord d'une piste peut être plus lente. Un simple booléen « la feuille
    // est-elle ouverte » aurait laissé partir la navigation pendant que la
    // requête était en vol, et la feuille se serait ouverte sur un écran déjà
    // quitté. L'état inconnu retient la navigation ; lui seul la libère.
    if (destination === 'inconnu') return;
    const route = destination === 'consentement' ? REC_ROUTES.consentement : REC_ROUTES.placement;
    const timer = setTimeout(() => {
      router.replace(route as never);
    }, PAIRED_REVEAL_MS);
    return () => clearTimeout(timer);
  }, [status, selectedId, destination]);

  /**
   * L21 — LA QUESTION DU CARDIO, UNE FOIS, JUSTE APRÈS L'APPAIRAGE.
   *
   * Placement décidé par le fondateur le 01/08/2026 : ici, dans le flux du jour
   * J, et pas à l'onboarding. Le pilote vient de connecter son boîtier — c'est
   * le moment où la question a un sens et où il comprend de quoi on parle. Le
   * flux reste à HUIT étapes : aucune vue neuve, on ouvre la feuille qui existe.
   *
   * On ne demande qu'une fois : `doitSolliciterConsentementBio` exige que la
   * question n'ait JAMAIS été posée. Un refus vaut réponse et ne se
   * re-sollicite pas — voir `consentementBioLogic`.
   *
   * La date est écrite à l'OUVERTURE, pas à la réponse : une feuille refermée
   * sans répondre est une question posée.
   */
  /**
   * LA GARDE EST UNE RÉFÉRENCE, ET C'EST LA CORRECTION DU 04/08/2026.
   *
   * Elle était un état, et cet état figurait dans les dépendances de son propre
   * effet. Le flux s'arrêtait donc à l'appairage : connecté, et plus rien.
   *
   * L'enchaînement, et il est déterministe — ce n'était pas un aléa réseau :
   *
   *   1. l'effet part, appelle `setConsentDemande(true)` ;
   *   2. ce changement d'état relance l'effet, puisque la valeur est en
   *      dépendance ;
   *   3. React exécute d'abord le NETTOYAGE du passage précédent, qui pose
   *      `annule = true` ;
   *   4. or c'est ce passage-là qui porte la fonction asynchrone en vol.
   *
   * Quand les lectures revenaient, tous les `if (annule) return` se
   * déclenchaient. `setDestination` n'était jamais appelé, la porte
   * restait « inconnu », et l'effet de navigation — qui exige « fermee » —
   * attendait indéfiniment.
   *
   * Une référence ne provoque pas de rendu, donc pas de relance, donc pas de
   * nettoyage prématuré. `consentDemande` n'était lu nulle part au rendu :
   * c'était un état qui n'avait aucune raison d'en être un.
   */
  const consentDemande = useRef(false);
  useEffect(() => {
    if (status !== 'connected') return;
    if (consentDemande.current) return; // une seule tentative par passage sur l'écran
    const pilotId = profile?.id;

    let annule = false;
    consentDemande.current = true;

    // Sans compte connu, on ne peut ni lire ni dater : on ne demande pas, et on
    // libère la navigation plutôt que de retenir le pilote sur cet écran.
    if (!pilotId) {
      setDestination('placement');
      return;
    }

    void (async () => {
      const [flagActif, sollicitation] = await Promise.all([
        isFlagEnabled('biometry').catch(() => false),
        loadBiometrySollicitation(pilotId).catch(() => null),
      ]);
      if (annule) return;

      const doit =
        sollicitation !== null &&
        doitSolliciterConsentementBio({
          flagActif,
          solliciteLe: sollicitation.solliciteLe,
          consentementCaptureLe: sollicitation.consentementCaptureLe,
        });

      if (!doit) {
        // Rien à demander : on file droit au placement.
        setDestination('placement');
        return;
      }

      // On date AVANT d'ouvrir : si l'application meurt feuille ouverte, la
      // question a tout de même été posée, et on ne la reposera pas.
      //
      // L'ÉCRITURE EST GARDÉE, comme les deux lectures au-dessus. Elle ne
      // l'était pas : un rejet réseau au bord d'une piste faisait échouer la
      // fonction asynchrone avant tout appel à `setDestination`, et
      // laissait le pilote sur cet écran. Échouer à DATER la question ne
      // justifie pas de retenir la journée — au pire, elle sera reposée.
      // ON DATE AVANT DE NAVIGUER, et l'ordre compte : si l'application meurt
      // entre les deux, la question compte tout de même comme posée. L'écrire
      // au montage de l'écran de consentement changerait cette règle sur une
      // donnée sensible au sens de l'article 9.
      const marque = await markBiometryAsked(pilotId).catch(() => ({
        ok: false as const,
        error: 'réseau',
      }));
      if (annule) return;
      if (!marque.ok) {
        // Échouer à dater ne justifie pas de retenir la journée. On pose tout de
        // même la question : au pire elle sera reposée une fois.
        console.warn('[OXV][rec] datation de la question de consentement :', marque.error);
      }
      setDestination('consentement');
    })();

    return () => {
      annule = true;
    };
  }, [status, profile?.id]);

  /**
   * LE GARDE-FOU — au circuit, RIEN ne retient le pilote sur cet écran.
   *
   * Le correctif ci-dessus ferme la cause connue. Celui-ci ferme la CLASSE :
   * quoi qu'il arrive à la question de consentement — un rejet qu'on n'a pas
   * prévu, une lecture qui ne revient jamais, un chemin ajouté demain qui
   * oublierait de refermer la porte —, la navigation reprend.
   *
   * C'est la règle que le plan pose pour l'écran d'arrivée, et elle vaut ici :
   * permission refusée, GPS qui ne fixe pas, circuit sans coordonnées —
   * « aucun de ces cas ne bloque la journée ».
   *
   * Huit secondes : deux lectures réseau en parallèle, au bord d'une piste, sur
   * un réseau de campagne. Généreux à dessein — ce délai ne doit jamais couper
   * une question légitime, seulement rattraper un silence.
   */
  useEffect(() => {
    if (status !== 'connected') return;
    if (destination !== 'inconnu') return;
    const secours = setTimeout(() => {
      console.warn(
        '[OXV][rec] la question de consentement n’a pas abouti en ' +
          `${DELAI_SECOURS_CONSENTEMENT_MS / 1000} s — la navigation reprend.`
      );
      setDestination('placement');
    }, DELAI_SECOURS_CONSENTEMENT_MS);
    return () => clearTimeout(secours);
  }, [status, destination]);

  // Scan au montage (permissions + timeout) — identique à la v1.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const perm = await requestBlePermissions();
      if (cancelled) return;
      // « Je ne sais pas » n'est pas « oui » : voir `permissionsLogic`.
      setPermissionIndeterminee(perm.indetermine === true);
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
    // `connect` n'était pas gardé : un rejet sautait `setConnecting(false)` et
    // l'écran restait en attente, indéfiniment, sans message. Le `finally`
    // rend la main dans tous les cas — l'erreur, elle, arrive par
    // `onError`, qui est déjà branché.
    try {
      await bluetoothService.connect(deviceId);
    } finally {
      setConnecting(false);
    }
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

  const isPairing = phase === 'connecting' || phase === 'connected';

  return (
    <Animated.View style={[styles.root, door]}>
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <PressScale
          onPress={() => router.back()}
          accessibilityLabel="Retour"
          // Chevron de 22 px : 22 + 2 × 12 = 46 px de cible réelle (le minimum
          // est 44). Le visuel ne bouge pas. C'est la seule sortie de l'écran,
          // le segment masquant la TabBar.
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <BackChevron />
        </PressScale>
        <Text style={styles.title} accessibilityRole="header">
          ÉQUIPEMENT
        </Text>
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
            {/* Chaque fait se lit d'un bloc : éclatés, « 87 » et « RB-1234 »
                perdaient leur étiquette. formatBatteryValue rend « — » quand la
                mesure est absente — le libellé reste factuel. */}
            <View
              style={styles.pairedTop}
              accessible
              accessibilityLabel={`${
                phase === 'connected' ? 'Boîtier appairé' : 'Connexion en cours'
              } : ${pairedName}`}
            >
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
              <View
                style={styles.pairedMetaCell}
                accessible
                // Le tiret d'absence est muet à l'oral : « Batterie — % » se dit
                // « Batterie pour cent », une unité sans valeur. On dit l'absence
                // avec des mots, comme la cellule voisine (« non communiqué »).
                accessibilityLabel={
                  battery != null
                    ? `Batterie : ${formatBatteryValue(battery)} %`
                    : 'Batterie : non mesurée'
                }
              >
                <Text style={styles.metaEyebrow}>BATTERIE</Text>
                <View style={styles.batteryRow}>
                  <RollingCounter value={formatBatteryValue(battery)} fontSize={30} />
                  <Text style={styles.batteryUnit}>%</Text>
                </View>
              </View>
              <View
                style={styles.pairedMetaCell}
                accessible
                accessibilityLabel={`Numéro de série : ${pairedSerial ?? 'non communiqué'}`}
              >
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
                /* Le service BLE émet la chaîne anglaise de react-native-ble-plx
                   (« Operation timed out », « Device <UUID> connection failed »).
                   Le service est protégé : la traduction se fait ici, à la
                   lecture — et c'est de toute façon sa place. Voir
                   `src/features/rec/diagnosticBle.ts`. */
                errorMessage={error ? texteDiagnostic(diagnostiquer(error)) : 'Le scan a échoué.'}
                onRetry={onRescan}
                style={styles.stateGap}
              />
            ) : phase === 'empty' ? (
              <StateView
                state="empty"
                // « Vérifiez » est un impératif, que la doctrine proscrit — et le
                // panneau ci-dessous pose désormais la question sans l'ordonner.
                emptyMessage="Aucun équipement à portée."
                style={styles.stateGap}
              />
            ) : null}

            {/* LE DIAGNOSTIC, DÈS LE PREMIER ÉCHEC — lot 21c.
                Deux colonnes qui ne se mélangent pas : ce que le téléphone a pu
                établir, et ce que seul le pilote peut regarder. La seconde est
                posée en QUESTIONS : affirmer « le boîtier est hors de portée »
                sans le savoir enverrait chercher du mauvais côté.
                La construction est dans `panneauDiagnostic.ts`, pure et testée. */}
            {phase === 'error' || phase === 'empty' ? (
              <PanneauDiagnostic
                cause={error ? diagnostiquer(error).cause : null}
                permissionIndeterminee={permissionIndeterminee}
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
              onPress={() => router.push(REC_ROUTES.consentement as never)}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // --- Panneau de diagnostic (lot 21c) --------------------------------------
  diagBloc: {
    marginTop: space.lg,
    gap: space.xs,
  },
  diagLigne: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.xs,
  },
  /**
   * La marque d'état. `—` pour l'inconnu, et c'est délibéré : le tiret est le
   * signe d'absence employé partout dans l'application. Une ligne dont on n'a
   * pas pu lire l'état ne prend ni le vert ni le rouge.
   */
  diagMarque: {
    fontFamily: typo.mono,
    fontSize: 15,
    lineHeight: 21,
    width: 16,
    textAlign: 'center',
    color: colors.text.mid,
  },
  diagMarqueOk: {
    color: colors.text.hi,
  },
  diagMarqueEchec: {
    color: colors.text.hi,
  },
  diagTextes: {
    flex: 1,
  },
  diagLibelle: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.hi,
  },
  diagGeste: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.mid,
    marginTop: 1,
  },
  diagEspace: {
    height: space.md,
  },
  diagQuestion: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.mid,
    paddingVertical: 2,
  },
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
    color: colors.text.mid,
    marginTop: 2,
  },
  deviceSignal: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text.mid,
    marginTop: 2,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 20,
    lineHeight: 20,
    color: colors.text.mid,
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
    color: colors.text.mid,
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
    color: colors.text.mid,
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
});
