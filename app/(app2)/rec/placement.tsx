/**
 * PLACEMENT — écran 5/8 du lot V2-L2 (porte REC). Route `rec/placement`
 * (segment masquant la TabBar). Dernière étape paddock avant le silence.
 *
 * PEAU sensorielle sur la capture v1 INTACTE : le démarrage appelle
 * `startCaptureSession` avec EXACTEMENT les mêmes arguments que
 * `app/(app)/placement.tsx` (userId, circuitId, circuitName, finishLine via
 * captureFinishLineFor). Aucune logique de capture nouvelle ; la sélection
 * multi-circuit vient de la même source (fetchCircuits / getDefaultCircuit).
 *
 * Nouveauté V2 :
 *   - carte circuit : tracé Skia GlowStroke (TraceCircuit) + marqueur blanc de
 *     ligne d'arrivée, placé depuis les coordonnées réelles du circuit
 *     (repli au départ du tracé si la ligne n'est pas renseignée) ;
 *   - « ARMER LA CAPTURE » : l'armement est un GESTE — appui long 600 ms avec
 *     jauge circulaire Skia qui se remplit, puis haptic('arm') et départ. Un
 *     relâchement précoce annule (aucune session créée). La durée/annulation
 *     est décrite par la logique pure testée `armementLogic`.
 *
 * Doctrine : FR vouvoyé, zéro emoji, jamais prescriptif. Skia natif (dev-client).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Canvas, Path as SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bluetoothService } from '@/ble/bluetoothService';
import { clampBatteryLevel } from '@/features/rec/equipementLogic';
import { evaluerPrevol, RAPPEL_PREVOL, type EtatPoste } from '@/features/rec/prevolLogic';
import { SEUIL_ARRET_KMH } from '@/telemetry/calibration';
import { fontSize as fs } from '@/theme/v2';
import { GpsFix, type RaceBoxData } from '@/types/telemetry';
import type { LatLon } from '@/circuit/circuitGenerator';
import { libelleAction, verdictArmement } from '@/features/rec/armementGateLogic';
import { ARM_HOLD_MS } from '@/features/rec/armementLogic';
import { libelleOrigineCircuit, type JourneeRetenue } from '@/features/rec/journeeDuJourLogic';
import { circuitDeMaJournee } from '@/services/journeeDuJourService';
import { phraseSensParcours } from '@/features/rec/sensParcoursLogic';
import { captureFinishLineFor } from '@/services/captureFinishLineLogic';
import { listMyVehicles, type Vehicle } from '@/services/garageService';
import { primaryVehicleId, vehicleName } from '@/features/vous/garageLogic';
import { startCaptureSession } from '@/services/captureSessionService';
import {
  fetchCircuitCenterline,
  fetchCircuits,
  getDefaultCircuit,
  type Circuit,
} from '@/services/circuitsService';
import { useAuthStore } from '@/store/useAuthStore';
import { haversineDistance } from '@/utils/geo';
import {
  Chip,
  GlowStroke,
  OxvIcon,
  TraceCircuit,
  colors,
  haptic,
  radius,
  space,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import { REC_ROUTES } from '@/features/rec/captureStepLogic';

/**
 * Côté du canevas de la jauge circulaire d'armement.
 *
 * 56 et non 96 : à 96 l'anneau (rayon 40) débordait d'un bouton de 72 pt et
 * traversait le libellé. Il vit maintenant EN FLUX, à gauche du texte — cf. le
 * commentaire au point d'insertion.
 */
const GAUGE_SIZE = 56;

/**
 * Fraction d'arc (0..1) de la ligne d'arrivée le long du tracé, pour placer le
 * marqueur. On cherche le point du tracé le plus proche des coordonnées réelles
 * de la ligne, puis sa position curviligne (haversine) sur la boucle. Ligne non
 * renseignée (0/0) ou coordonnées non finies → repli au départ du tracé (0),
 * jamais une fausse ligne (doctrine « données réelles »).
 */
function finishLineRatio(centerline: readonly LatLon[], lat: number, lon: number): number {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) return 0;
  if (centerline.length < 2) return 0;
  let bestIdx = 0;
  let bestD = Infinity;
  for (let i = 0; i < centerline.length; i++) {
    const d = haversineDistance(lat, lon, centerline[i].lat, centerline[i].lon);
    if (d < bestD) {
      bestD = d;
      bestIdx = i;
    }
  }
  let total = 0;
  let upto = 0;
  for (let i = 0; i < centerline.length; i++) {
    const a = centerline[i];
    const b = centerline[(i + 1) % centerline.length];
    const seg = haversineDistance(a.lat, a.lon, b.lat, b.lon);
    if (i < bestIdx) upto += seg;
    total += seg;
  }
  return total > 0 ? upto / total : 0;
}

// ---------------------------------------------------------------------------
// Prévol (M02) — la chaîne de mesure, poste par poste, avant d'armer
// ---------------------------------------------------------------------------

/**
 * Cadence de rafraîchissement du prévol. Le boîtier émet à 25 Hz : refléter
 * chaque trame dans l'état re-rendrait tout l'écran — tracé Skia compris —
 * vingt-cinq fois par seconde. Une fois par seconde suffit à un état des lieux.
 */
const PREVOL_MAJ_MS = 1000;

/**
 * Complément oral de la pastille. Le fait seul (« Batterie du boîtier : 82 % »)
 * ne dit pas l'état au lecteur d'écran — la pastille est purement visuelle.
 * `non_mesure` reste vide : son fait dit déjà « non mesurée ».
 */
const ORAL_ETAT: Record<EtatPoste, string> = {
  pret: ', prêt',
  a_verifier: ', à vérifier',
  bloquant: ', bloquant',
  non_mesure: '',
};

/**
 * La pastille d'état — dans les gris du kit, JAMAIS un sémaphore vert/rouge :
 * point plein = prêt, cercle = à vérifier, croix discrète = bloquant,
 * tiret = non mesuré. Le seul accent rouge de l'écran reste le bouton d'armement.
 */
function PastillePrevol({ etat }: { etat: EtatPoste }) {
  return (
    <View style={styles.pastilleCase}>
      {etat === 'pret' ? (
        <View style={styles.pastillePleine} />
      ) : etat === 'a_verifier' ? (
        <View style={styles.pastilleCerclee} />
      ) : (
        <Text style={styles.pastilleGlyphe}>{etat === 'bloquant' ? '×' : '—'}</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bouton d'armement — appui long 600 ms, jauge circulaire Skia
// ---------------------------------------------------------------------------

function ArmButton({ onArm, disabled }: { onArm: () => void; disabled: boolean }) {
  const progress = useSharedValue(0);
  // Verrou anti-double-départ (l'effet de bord ne doit partir qu'une fois).
  const fired = useRef(false);
  // Le geste est mémoïsé une seule fois (stable) : on lit onArm/disabled LES
  // PLUS RÉCENTS via des refs pour ne jamais démarrer sur un circuit périmé.
  const onArmRef = useRef(onArm);
  const disabledRef = useRef(disabled);
  onArmRef.current = onArm;
  disabledRef.current = disabled;

  const fire = () => {
    if (fired.current || disabledRef.current) return;
    fired.current = true;
    onArmRef.current();
  };

  /**
   * Rouvre le verrou, SUR LE FIL JS.
   *
   * Elle était appelée directement depuis `.onBegin`, qui est un worklet : le
   * fil UI ne reçoit qu'une COPIE sérialisée de `fired`, et l'écriture n'y
   * atteignait jamais l'objet que `fire()` relit côté JS. Conséquence, si un
   * premier armement échouait et que l'écran restait monté : l'anneau se
   * remplissait à nouveau, `fire()` voyait encore `true`, et rien ne partait —
   * sans message, et sans se débloquer autrement qu'en dépilant l'écran.
   *
   * Le défaut ne se voyait pas en développement : `freezeObjectInDev` de
   * `react-native-worklets` remplace alors `current` par un accesseur inerte,
   * et le verrou ne s'armait tout simplement jamais.
   *
   * L'ordre est garanti : `onBegin` survient au poser du doigt, `onStart` 600 ms
   * plus tard, et les deux passent par la même file `runOnJS`.
   */
  const rouvrirVerrou = () => {
    fired.current = false;
  };

  // Anneau plein (départ à midi, sens horaire) — GlowStroke le trime 0..progress.
  const c = GAUGE_SIZE / 2;
  const r = c - 8;
  const ringPath = `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c} ${c + r} A ${r} ${r} 0 1 1 ${c} ${c - r}`;

  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(ARM_HOLD_MS)
        // La capture doit survivre à un léger tremblement du doigt : on ne
        // l'annule pas sur un petit déplacement.
        .maxDistance(10_000)
        .onBegin(() => {
          // `runOnJS` est indispensable : voir `rouvrirVerrou`. Écrire
          // `fired.current` ici ne toucherait que le clone du fil UI.
          runOnJS(rouvrirVerrou)();
          progress.value = 0;
          progress.value = withTiming(1, { duration: ARM_HOLD_MS, easing: Easing.linear });
        })
        .onStart(() => {
          // Seuil atteint (le doigt est resté 600 ms) → on part.
          runOnJS(fire)();
        })
        .onFinalize((_event, success) => {
          // Relâchement précoce (non reconnu) → annulation : la jauge se vide.
          if (!success) {
            progress.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
          }
        }),
    // fire/disabled capturés par référence stable ; progress est un SharedValue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <GestureDetector gesture={gesture}>
      {/* `accessible` : sans lui, un View nu n'est pas un élément
          d'accessibilité et rôle/label/état sont ignorés. L'action `activate`
          ouvre le SEUL chemin non gestuel vers l'armement : le double-tap d'un
          lecteur d'écran ne déclenche jamais un LongPress gesture-handler.
          Elle appelle la MÊME fonction `fire()` — verrou anti-double-départ et
          garde `disabledRef` compris. */}
      <View
        style={[styles.armBtn, disabled && styles.armBtnDisabled]}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Armer la capture"
        accessibilityHint="Maintenez appuyé pour démarrer l’enregistrement"
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'activate') fire();
        }}
      >
        {/*
          LA JAUGE EST SORTIE DE DESSOUS LE TEXTE.

          Elle était un canevas de 96 pt en `position: 'absolute'` SANS aucun
          inset, dans un bouton de 72. Yoga la centrait donc dans un conteneur
          plus petit qu'elle : l'anneau (rayon 40) dépassait de 4 pt en haut et
          en bas du pilulier, et surtout ses extrémités gauche et droite —
          à ±40 pt du centre, exactement à mi-hauteur — traversaient
          « ARMER LA CAPTURE », qui s'étend à ±84 pt.

          Un trait blanc lumineux barrait le seul libellé de l'écran, pendant
          les 600 ms de l'appui, à chaque armement, sur tous les téléphones. De
          nuit, c'est ce que le fondateur a décrit par « les affichages se
          montent dessus ».

          Un absolu sans inset dans un conteneur plus petit que lui EST le
          mécanisme du recouvrement. La jauge passe donc en flux, à gauche du
          libellé, et rétrécit à 56 pt.
        */}
        <Canvas
          style={styles.gauge}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {/* Piste de la jauge (neutre) + remplissage lumineux piloté 0..1. */}
          <SkPath
            path={ringPath}
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            color={colors.bg.card2}
          />
          <GlowStroke
            path={ringPath}
            color={colors.text.hi}
            glowColor={colors.accentGlow}
            strokeWidth={3}
            progress={progress}
          />
        </Canvas>
        <View style={styles.armTexts}>
          <Text style={styles.armLabel}>ARMER LA CAPTURE</Text>
        </View>
      </View>
      {/*
        LA CONSIGNE SORT DU ROUGE — arbitrage du 13/08/2026.

        Elle était posée SUR `#C8102E`, où le blanc pur plafonne à 5,88 : aucune
        couleur de texte n'y atteint le plancher de 7:1 que ce flux s'impose.

        L'argument qui autorise 5,88 sur un LIBELLÉ — « il est doublé par la
        forme, la position et le geste » — ne vaut pas ici. « Maintenez pour
        armer » n'est pas un libellé, c'est une INSTRUCTION : elle existe
        précisément parce que la forme ne suffit pas à faire comprendre le
        geste. L'assumer à 5,88 revenait à rendre la consigne la moins lisible
        du flux celle dont on a le plus besoin.

        Sur le fond sombre, `text.hi` dépasse 12:1. Le bouton garde sa masse
        rouge — trouvable en plein soleil — et le plancher est tenu là où il
        protège. On ne choisit plus entre les deux.
      */}
      <Text style={styles.armHint}>Maintenez pour armer</Text>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function PlacementScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);

  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** La journée réservée du pilote, quand il y en a une à rouler maintenant. */
  const [journee, setJournee] = useState<JourneeRetenue | null>(null);
  const [centerline, setCenterline] = useState<LatLon[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * ÉTAT DE LA LIAISON — la garde qui manquait.
   *
   * Le bouton d'armement recevait `disabled={starting}`, un garde de
   * ré-entrance. L'état Bluetooth n'était consulté nulle part : boîtier éteint,
   * hors de portée ou Bluetooth coupé, le pilote armait quand même et roulait
   * une séance entière sans rien enregistrer. Aucune erreur n'était levée — un
   * flux BLE qui ne vient jamais n'est pas une panne, c'est un silence.
   *
   * On lit l'état au montage puis on suit ses changements : le boîtier peut
   * tomber pendant que le pilote choisit son circuit.
   */
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [ble, setBle] = useState(() => bluetoothService.getStatus());
  useEffect(() => bluetoothService.onStatusChange(setBle), []);

  /**
   * PRÉVOL (M02) — ce que la chaîne expose RÉELLEMENT, rien de plus.
   *
   * Le boîtier est connecté depuis l'écran Équipement ; ici, partir en piste
   * est l'étape suivante. C'est donc ici que la chaîne se passe en revue,
   * poste par poste, AVANT le geste d'armement.
   *
   * Sources — uniquement celles qui existent dans le dépôt :
   *   • trames BLE (`onData`) : batterie du boîtier, fix, hAcc, satellites ;
   *   • `getCurrentRate()` : fréquence de trames observée ;
   *   • NetInfo : réseau (le direct seulement, jamais l'enregistrement) ;
   *   • l'état BLE ci-dessus : la liaison.
   *
   * Ce qui n'est PAS lu reste `null`, et le poste dit « non mesurée » :
   * la mémoire du boîtier (le parser UBX ne la lit pas) et la batterie du
   * téléphone (expo-battery absent du dépôt). On n'invente aucune donnée.
   */
  const [trame, setTrame] = useState<RaceBoxData | null>(null);
  const [frequenceHz, setFrequenceHz] = useState<number | null>(null);
  const [reseau, setReseau] = useState<boolean | null>(null);
  const derniereTrameMs = useRef(0);

  /**
   * L'IMMOBILITÉ SE COMPTE SUR CHAQUE TRAME, PAS SUR L'ÉCHANTILLON AFFICHÉ.
   *
   * L'affichage est volontairement ralenti (`PREVOL_MAJ_MS`). Compter
   * l'immobilité sur ce rythme laisserait passer un roulement entre deux
   * échantillons : la voiture aurait bougé, le compteur aurait continué, et
   * l'écran aurait annoncé une orientation mesurable qui ne l'était pas.
   *
   * Le repère porte l'INSTANT où l'immobilité a commencé — `0` quand elle est
   * rompue. La durée s'en déduit ; elle ne s'accumule pas.
   */
  const immobileDepuis = useRef(0);
  const [secondesImmobile, setSecondesImmobile] = useState<number | null>(null);

  useEffect(
    () =>
      bluetoothService.onData((frame: RaceBoxData) => {
        const now = Date.now();

        // Avant tout filtrage d'affichage : la moindre trame en mouvement
        // remet le compteur à zéro.
        if (frame.motion.speed < SEUIL_ARRET_KMH) {
          if (immobileDepuis.current === 0) immobileDepuis.current = now;
        } else {
          immobileDepuis.current = 0;
        }

        if (now - derniereTrameMs.current < PREVOL_MAJ_MS) return;
        derniereTrameMs.current = now;
        setSecondesImmobile(
          immobileDepuis.current === 0 ? 0 : (now - immobileDepuis.current) / 1000
        );
        setTrame(frame);
        // Le taux est calculé sur une fenêtre glissante d'une seconde : il vaut
        // 0 tant qu'elle n'est pas remplie. Or on est DANS `onData` — une trame
        // vient d'arriver — donc un 0 ici est « pas encore calculé », jamais
        // « aucune trame » : il reste non mesuré plutôt qu'un faux bloquant.
        const taux = bluetoothService.getCurrentRate();
        setFrequenceHz(taux > 0 ? taux : null);
      }),
    []
  );

  // Liaison tombée → les dernières valeurs lues ne décrivent plus rien : on ne
  // certifie pas ce qu'on ne lit plus. Les postes redisent « non mesuré ».
  useEffect(() => {
    if (ble === 'connected') return;
    setTrame(null);
    setFrequenceHz(null);
    // On ne lit plus la vitesse : on ne peut plus certifier une immobilite.
    immobileDepuis.current = 0;
    setSecondesImmobile(null);
  }, [ble]);

  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        // Même définition du « en ligne » que src/lib/netinfo.ts.
        setReseau(Boolean(s.isConnected) && s.isInternetReachable !== false);
      }),
    []
  );

  const bilan = useMemo(
    () =>
      evaluerPrevol({
        batteriePct: trame ? clampBatteryLevel(trame.battery.level) : null,
        memoirePct: null, // non lue par le parser UBX — le poste le dit
        fixValide: trame ? trame.gps.fix === GpsFix.Fix3D : null,
        hAccM: trame ? trame.gps.accuracy : null, // mètres (parser : mm / 1000)
        satellites: trame ? trame.gps.satellites : null,
        frequenceHz,
        connexionEtablie: ble === 'connected',
        batterieTelephonePct: null, // expo-battery absent du dépôt — le poste le dit
        reseauDisponible: reseau,
        secondesImmobile,
      }),
    [trame, frequenceHz, ble, reseau, secondesImmobile]
  );

  // Le 4e argument ferme le chemin « armer sans circuit », qui retombait sur
  // `BELTOISE_FINISH` — une ligne d'arrivée qui n'appartient à aucun tracé réel.
  const verdict = verdictArmement(ble, starting, false, selectedId !== null);
  const actionSecondaire = libelleAction(verdict.action);

  /**
   * Circuits disponibles — RELECTURE FORCÉE, et c'est le seul écran où ça se
   * justifie.
   *
   * `fetchCircuits()` sert un cache de 24 h. Ailleurs c'est un confort ; ici
   * c'est le piège : un circuit ajouté en base le matin reste INVISIBLE au
   * paddock jusqu'au lendemain, sur un téléphone qui a consulté la liste la
   * veille. Aucune erreur, aucun symptôme — juste un tracé absent de la rangée
   * de choix, le jour où on vient rouler dessus. Vérifié en ajoutant Bouteville
   * le 12/08/2026, quelques heures avant le premier essai terrain.
   *
   * Le coût est d'une requête par armement. Le repli hors-ligne est intact :
   * en cas d'erreur réseau, `fetchCircuits` rend le cache — le pilote n'est
   * jamais bloqué avant la piste (cf. le commentaire du service sur le vide
   * d'accès).
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await fetchCircuits(true);
      if (cancelled) return;
      const official = all.filter((c) => c.isOfficial);
      const list = official.length > 0 ? official : all;
      setCircuits(list);

      /**
       * LA JOURNÉE RÉSERVÉE COMMANDE LE CIRCUIT — posé le 13/08/2026, après.
       *
       * Cette ligne appelait `getDefaultCircuit()`, qui rend le circuit marqué
       * `is_default` : Haute Saintonge, depuis toujours. L'écran qui arme la
       * capture ne consultait JAMAIS la journée du pilote.
       *
       * La nuit du 12 au 13/08, le fondateur avait une journée à Bouteville.
       * Le Paddock la lui affichait, le Pass la lui affichait, il a appairé son
       * boîtier et armé. **La séance est partie sur Haute Saintonge**, avec une
       * ligne d'arrivée à quarante kilomètres de l'endroit où il roulait. Zéro
       * tour, et rien qui le lui dise.
       *
       * Bouteville ÉTAIT dans la rangée de choix. Il fallait le désigner à la
       * main — un geste de plus, de nuit, avec des gants. Toute l'application
       * savait où il allait ; l'écran qui arme ne le demandait à personne.
       *
       * L'ordre est maintenant : la journée d'abord, le défaut ensuite. Le
       * pilote reste libre de changer, et la phrase sous la carte dit d'où
       * vient le circuit armé (cf. `libelleOrigineCircuit`) — une
       * pré-sélection muette reproduirait le même défaut à l'envers.
       */
      const retenue = await circuitDeMaJournee();
      if (cancelled) return;
      setJournee(retenue);

      const deLaJournee =
        retenue && list.some((c) => c.id === retenue.circuitId) ? retenue.circuitId : null;
      if (deLaJournee) {
        setSelectedId(deLaJournee);
        return;
      }
      const def = await getDefaultCircuit();
      if (!cancelled) setSelectedId(def?.id ?? list[0]?.id ?? null);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = circuits.find((c) => c.id === selectedId) ?? null;
  /**
   * D'où vient le circuit affiché. Muet quand il n'y a rien de factuel à dire :
   * on ne meuble pas une ligne pour rassurer.
   */
  const origineCircuit = libelleOrigineCircuit(journee, selectedId);
  /** Le sens obligatoire de franchissement. `null` en mode rayon (pas de sens). */
  const sensParcours = phraseSensParcours(selected?.finishLineHeading);

  /**
   * LE VÉHICULE ATTACHÉ À LA SÉANCE — posé ici le 12/08/2026.
   *
   * `startCaptureSession` accepte un `vehicleId` depuis toujours et cet écran
   * ne le passait pas : les dix séances de production portent donc
   * `vehicle_id = null`, sans exception. Le filtre par paire circuit-véhicule
   * que la Signature et la Saison attendent n'aurait eu AUCUNE paire à
   * proposer — il aurait été vert en test et vide au circuit.
   *
   * Le principal est pré-sélectionné, et il se dit. L'attacher en silence
   * serait pire que ne rien attacher : le pilote découvrirait au débrief que
   * sa séance est rangée sous une voiture qu'il n'a pas choisie.
   */
  useEffect(() => {
    let cancelled = false;
    listMyVehicles()
      .then((rows) => {
        if (cancelled) return;
        setVehicles(rows);
        setVehicleId(primaryVehicleId(rows));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const vehicleChoisi = vehicles.find((v) => v.id === vehicleId) ?? null;

  // Géométrie du circuit choisi (tracé réel ; null → pas de silhouette inventée).
  useEffect(() => {
    let cancelled = false;
    setCenterline(null);
    if (!selectedId) return;
    fetchCircuitCenterline(selectedId)
      .then((pts) => {
        if (!cancelled) setCenterline(pts);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const markers = useMemo(() => {
    if (!centerline || !selected) return [];
    const t = finishLineRatio(centerline, selected.finishLineLat, selected.finishLineLon);
    // Marqueur blanc (text.hi) = ligne d'arrivée. SpringDot le fait « claquer »
    // une fois après le tracé (pulsée UNE fois).
    return [{ t, color: colors.text.hi }];
  }, [centerline, selected]);

  async function onArm() {
    // Seconde barrière, côté action. Le bouton est déjà désactivé, mais un
    // chemin non gestuel existe (le double-tap d'accessibilité) et une garde qui
    // ne vit que dans le rendu est une garde qu'on contourne sans le savoir.
    if (
      !verdictArmement(bluetoothService.getStatus(), starting, false, selectedId !== null).peutArmer
    )
      return;
    haptic('arm');
    if (!profile?.id) {
      setError('Profil non chargé. Reconnectez-vous.');
      return;
    }
    setStarting(true);
    setError(null);
    // Le try/catch n'est pas décoratif : `starting` désactive le bouton, et sans
    // lui la moindre exception — `getDefaultCircuit()` sur un réseau muet, un
    // appel de capture qui lève — laissait l'écran figé sur « Démarrage en
    // cours », définitivement et sans un mot. Un second verrou permanent, sur
    // le seul geste de l'écran.
    try {
      // Rattache la session au circuit CHOISI (repli défaut). Arguments IDENTIQUES
      // à la v1 (app/(app)/placement.tsx) — aucune logique de capture nouvelle.
      const circuit = selected ?? (await getDefaultCircuit());
      const res = await startCaptureSession({
        userId: profile.id,
        circuitId: circuit?.id ?? null,
        circuitName: circuit?.name ?? null,
        finishLine: captureFinishLineFor(circuit),
        // Garage vide → `null`, et la séance reste lisible : une paire
        // incomplète ne se range pas, elle ne s'invente pas non plus.
        vehicleId,
      });
      if (res.ok) {
        router.replace('/(app2)/rec/roulage' as never);
        return;
      }
      setStarting(false);
      setError(res.error ?? "L'enregistrement n'a pas pu démarrer.");
    } catch (err) {
      setStarting(false);
      setError(err instanceof Error ? err.message : "L'enregistrement n'a pas pu démarrer.");
    }
  }

  return (
    <Animated.View style={[styles.root, door, { paddingTop: insets.top + space.xl }]}>
      <Text style={styles.title} accessibilityRole="header">
        PLACEMENT
      </Text>

      {/*
        DÉFILEMENT, ET CE N'EST PAS UN CONFORT.

        Ce bloc était un `View` en `flex: 1` avec `justifyContent: 'center'`.
        Tant que le contenu tenait, le centrage était joli. Passé la hauteur
        disponible — quatre circuits dont la rangée déborde sur deux lignes,
        une rangée de véhicules, la carte de 180 px, trois paragraphes — un
        conteneur centré ne coupe pas : il déborde des DEUX côtés, sans barre
        de défilement, et les éléments se recouvrent.

        C'est ce que le fondateur a vu la nuit du 13/08 : « les affichages se
        montent dessus ». Le quatrième circuit ajouté la veille a suffi à faire
        basculer l'écran.
      */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {/*
          LE CIRCUIT ARMÉ, EN GRAND ET EN PREMIER.

          Il était déduit d'une pastille active dans une rangée de quatre. Sur
          un écran de nuit, à travers un pare-brise, cette nuance de fond n'a
          pas suffi — et la séance est partie sur le mauvais tracé sans que
          rien ne le dise. Le nom du circuit est désormais la première chose
          que l'écran affirme.
        */}
        <Text style={styles.circuitEyebrow}>CIRCUIT</Text>
        <Text style={styles.circuitName} accessibilityRole="header">
          {selected?.name ?? '—'}
        </Text>
        {origineCircuit ? <Text style={styles.circuitOrigine}>{origineCircuit}</Text> : null}
        {/*
          LE SENS DE PARCOURS, ÉCRIT NULLE PART JUSQU'ICI.

          La ligne d'arrivée est une PORTE ORIENTÉE : franchie à contresens, elle
          ne compte rien — pas un tour approximatif, zéro. C'est le seul réglage
          d'un circuit qui décide de la journée avant même de démarrer, et
          l'application ne le disait à personne. Le pilote ne pouvait le
          découvrir qu'au bilan, sur une séance sans chrono.

          Muet quand le cap n'est pas relevé (mode rayon) : il n'y a alors pas de
          sens obligatoire, et l'affirmer serait faux.
        */}
        {sensParcours ? <Text style={styles.circuitSens}>{sensParcours}</Text> : null}

        {circuits.length > 1 ? (
          <View style={styles.chips}>
            {circuits.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                active={c.id === selectedId}
                onPress={() => setSelectedId(c.id)}
              />
            ))}
          </View>
        ) : null}

        {vehicles.length > 1 ? (
          <View style={styles.chips}>
            {vehicles.map((v) => (
              <Chip
                key={v.id}
                label={vehicleName(v)}
                active={v.id === vehicleId}
                onPress={() => setVehicleId(v.id)}
              />
            ))}
          </View>
        ) : null}

        {/* Carte circuit : tracé réel + ligne d'arrivée, ou repli sobre. */}
        <View style={styles.trackCard}>
          {centerline ? (
            <TraceCircuit centerline={centerline} height={180} markers={markers} />
          ) : (
            <View style={styles.trackFallback}>
              <OxvIcon name="circuit" size={30} color={colors.text.mid} />
              <Text style={styles.trackFallbackName}>{selected?.name ?? 'Circuit'}</Text>
            </View>
          )}
        </View>

        <Text style={styles.headline}>
          Posez le boîtier sur le support magnétique, côté passager.
        </Text>
        <Text style={styles.manifest}>Vous le verrez peu. Il s’occupera du reste.</Text>

        {vehicleChoisi !== null ? (
          <Text style={styles.vehicleNote}>Séance rattachée à {vehicleName(vehicleChoisi)}.</Text>
        ) : null}

        {/*
          LE PRÉVOL — la chaîne de mesure, dite AVANT le geste d'armement.

          Fiche M02 du cahier veille : découvrir au débrief que rien n'a été
          mesuré est le pire des scénarios. Chaque poste sort avec son FAIT
          (« Batterie du boîtier : 82 % ») et sa pastille — les gris du kit,
          pas un sémaphore. Le verdict reprend la phrase du module telle
          quelle : réseau absent → « enregistrement seul », dit factuellement,
          et la captation part quand même (le cahier l'exige). Le prévol
          MONTRE ; la seule porte qui bloque l'armement reste `verdictArmement`.
        */}
        <View style={styles.prevolBloc}>
          <Text style={styles.prevolEyebrow}>PRÉVOL</Text>
          <Text style={styles.prevolVerdict} accessibilityLiveRegion="polite">
            {bilan.verdict.phrase}
          </Text>
          {bilan.postes.map((p) => (
            <View
              key={p.poste}
              style={styles.prevolLigne}
              accessible
              accessibilityLabel={`${p.fait}${ORAL_ETAT[p.etat]}`}
            >
              <PastillePrevol etat={p.etat} />
              <Text style={[styles.prevolFait, p.etat === 'non_mesure' && styles.prevolFaitAbsent]}>
                {p.fait}
              </Text>
            </View>
          ))}
          <Text style={styles.prevolRappel}>{RAPPEL_PREVOL}</Text>
        </View>

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>

      {/*
        `tabBarSpace` RÉSERVAIT LA PLACE D'UNE BARRE QUI N'EST PAS RENDUE ICI.

        `placement` figure dans `V2_HIDDEN_SEGMENTS` : le layout masque
        explicitement la TabBar sur cet écran. Le pied de page lui gardait
        pourtant 56 pt de hauteur plus l'encoche — 106 pt pris sur le corps,
        soit à eux seuls plus que le débordement constaté sur un iPhone mini.
        La formule reste juste là où la barre existe (`rec/index`, `entre-runs`).
      */}
      <View
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) + space.lg }]}
      >
        {/* La raison du refus est dite AVANT le geste, pas après. Un pilote qui
            maintient six cents millisecondes pour rien a déjà perdu son tour. */}
        {verdict.raison ? (
          <Text style={styles.armRaison} accessibilityLiveRegion="polite">
            {verdict.raison}
          </Text>
        ) : null}

        <ArmButton onArm={onArm} disabled={!verdict.peutArmer} />

        {/* Refuser n'est pas bloquer la journée : la panne route par le
            diagnostic. `patienter` n'offre rien — proposer une action pendant
            qu'une connexion s'établit invite à l'interrompre. */}
        {actionSecondaire ? (
          <Pressable
            onPress={() => router.push(REC_ROUTES.appairage as never)}
            accessibilityRole="button"
            accessibilityLabel={actionSecondaire}
            hitSlop={12}
            style={styles.armSecondaire}
          >
            <Text style={styles.armSecondaireLabel}>{actionSecondaire}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
    paddingHorizontal: space.xl,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 16,
    letterSpacing: 2,
    color: colors.text.hi,
    textAlign: 'center',
    // Bande tampon sous le titre, comme `rec/index` en porte une. Son absence
    // ici était un oubli : le premier pixel qui débordait du corps atterrissait
    // directement dessus.
    marginBottom: space.lg,
  },
  body: {
    flex: 1,
  },
  // Le contenu respire quand il tient, et défile quand il ne tient plus.
  // `flexGrow` (et non `flex: 1`) : sans lui, un contenu court se collerait en
  // haut au lieu de rester centré comme avant la correction.
  bodyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: space.lg,
  },
  // Le circuit armé — la première affirmation de l'écran.
  circuitEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.text.mid,
    marginBottom: space.xs,
  },
  circuitName: {
    fontFamily: typo.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text.hi,
  },
  circuitSens: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  circuitOrigine: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 19,
    // `text.mid` et non `text.low` : plancher de contraste 7:1 sur les huit
    // écrans du flux REC (garde `contrasteFluxRec`), et cette ligne se lit de
    // nuit, au paddock — c'est elle qui dit sur quel tracé la séance part.
    color: colors.text.mid,
    marginTop: space.xs,
  },
  /**
   * `rowGap` SÉPARÉ, ET C'EST UNE CORRECTION DE ZONE TACTILE.
   *
   * `gap: space.sm` réglait l'écart des colonnes ET des lignes à 8 pt. Or
   * `Chip` porte `hitSlop={{ top: 6, bottom: 6 }}` : deux rangées distantes de
   * 8 pt ont donc 12 pt de débord cumulé, soit une bande de 4 pt où les deux
   * rectangles de test se superposent. iOS parcourt les sous-vues en ordre
   * INVERSE — c'est la rangée DU DESSOUS qui rafle le toucher.
   *
   * Cette bande n'existait pas avant le 12/08 : avec trois circuits la rangée
   * tenait sur une ligne. Le quatrième l'a créée, et avec elle
   * « l'interface n'est pas très fiable » — un appui sur le bas de
   * « Bouteville » sélectionnait « Ricardo Tormo ».
   *
   * Plancher : `rowGap >= 12` tant que `Chip` porte un hitSlop de 6.
   */
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: space.sm,
    rowGap: space.lg,
    marginBottom: space.xl,
  },
  trackCard: {
    // HAUTEUR STABLE. La carte passait par trois hauteurs au montage et à
    // chaque changement de circuit (212 → 32 → 229) : `setCenterline(null)`
    // remet le repli, puis `TraceCircuit` ne rend rien tant que son `onLayout`
    // n'a pas donné de largeur. Le corps étant centré, tout l'écran sautait.
    minHeight: 229,
    justifyContent: 'center',
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.hero,
    padding: space.lg,
    marginBottom: space.xxl,
  },
  trackFallback: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
  },
  trackFallbackName: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.mid,
  },
  headline: {
    fontFamily: typo.bodySemi,
    fontSize: 20,
    lineHeight: 27,
    color: colors.text.hi,
    marginBottom: space.md,
  },
  manifest: {
    fontFamily: typo.body,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 23,
    color: colors.text.mid,
  },
  // --- Prévol (M02) ---------------------------------------------------------
  prevolBloc: {
    marginTop: space.xl,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  prevolEyebrow: {
    fontFamily: typo.mono,
    fontSize: fs.eyebrow,
    letterSpacing: 2,
    color: colors.text.mid,
    marginBottom: space.sm,
  },
  prevolVerdict: {
    fontFamily: typo.bodyMedium,
    fontSize: fs.bodyLg,
    lineHeight: 21,
    color: colors.text.hi,
    marginBottom: space.md,
  },
  prevolLigne: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: 3,
  },
  /**
   * La case de pastille : largeur fixe pour l'alignement des faits, hauteur
   * calée sur la ligne du fait (lineHeight 21) pour centrer point et cercle.
   */
  pastilleCase: {
    width: 16,
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Point plein = prêt. Chrome neutre (text.hi), jamais un vert de sémaphore.
  pastillePleine: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.text.hi,
  },
  // Cercle = à vérifier : le même point, vidé.
  pastilleCerclee: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.text.hi,
  },
  // Croix discrète = bloquant ; tiret = non mesuré (le signe d'absence de l'app).
  pastilleGlyphe: {
    fontFamily: typo.mono,
    fontSize: fs.body,
    lineHeight: 21,
    color: colors.text.mid,
    textAlign: 'center',
  },
  prevolFait: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: fs.body,
    lineHeight: 21,
    color: colors.text.hi,
  },
  // L'absence se dit plus bas que le fait mesuré — text.mid tient le plancher
  // de contraste du flux REC (cf. les notes voisines).
  prevolFaitAbsent: {
    color: colors.text.mid,
  },
  prevolRappel: {
    fontFamily: typo.body,
    fontSize: fs.small,
    lineHeight: 18,
    color: colors.text.mid,
    marginTop: space.md,
  },
  vehicleNote: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    // `text.mid`, pas `text.low` : les huit écrans du flux REC tiennent un
    // plancher de contraste de 7:1 (garde `contrasteFluxRec`), et `text.low`
    // plafonne à 6,10. Une note lue au paddock, en plein soleil, avec des
    // gants — c'est le pire contexte de lecture de l'application.
    color: colors.text.mid,
    marginTop: space.sm,
  },
  error: {
    fontFamily: typo.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.hi,
    marginTop: space.lg,
  },
  footer: {
    paddingTop: space.md,
  },
  // Raison du refus d'armement — dite AVANT le geste. `text.hi` et non une
  // couleur faible : cet écran se lit en plein soleil, casque à la main.
  armRaison: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    lineHeight: 21,
    color: colors.text.hi,
    textAlign: 'center',
    marginBottom: space.md,
  },
  // Porte de sortie vers le diagnostic. Hauteur au-dessus du plancher de 44 pt
  // (cible gantée, sous vibration), sans concurrencer l'armement.
  armSecondaire: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
  },
  armSecondaireLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 15,
    color: colors.text.hi,
    textDecorationLine: 'underline',
  },
  // Bouton d'armement
  armBtn: {
    minHeight: 76,
    backgroundColor: colors.accent,
    borderRadius: radius.hero,
    // Jauge à gauche, textes à droite : plus aucun recouvrement (cf. le
    // commentaire au point d'insertion de la jauge).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  armTexts: {
    alignItems: 'flex-start',
  },
  armBtnDisabled: {
    opacity: 0.6,
  },
  // PAS de `position: 'absolute'` : un absolu sans inset dans un conteneur
  // plus petit que lui est le mécanisme même du recouvrement.
  gauge: {
    width: GAUGE_SIZE,
    height: GAUGE_SIZE,
  },
  armLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 1.5,
    color: colors.text.hi,
  },
  /**
   * « Maintenez pour armer » — SORTIE DU ROUGE le 13/08/2026, et l'affaire est
   * close.
   *
   * Historique de la mesure : `text.hi` à 70 % d'opacité sur `#C8102E` donnait
   * **2,90** (05/08). L'opacité retirée et le blanc pur l'ont portée à **5,88**,
   * le maximum atteignable sur le rouge de marque — mais le plancher de 7:1 y
   * reste hors de portée pour TOUTE couleur de texte.
   *
   * L'arbitrage tranche autrement que par la couleur : on sépare l'instruction
   * du bouton. Un libellé peut assumer 5,88, parce qu'il est doublé par la
   * forme, la position et le geste. Une INSTRUCTION n'est doublée par rien —
   * elle existe parce que la forme ne suffit pas.
   *
   * Sur le fond sombre, `text.hi` dépasse **12:1**. Le bouton garde sa masse
   * rouge, le plancher est tenu là où il protège.
   */
  armHint: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.text.hi,
    marginTop: space.sm,
    textAlign: 'center',
  },
});
