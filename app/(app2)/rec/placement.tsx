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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Canvas, Path as SkPath } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bluetoothService } from '@/ble/bluetoothService';
import type { LatLon } from '@/circuit/circuitGenerator';
import { libelleAction, verdictArmement } from '@/features/rec/armementGateLogic';
import { ARM_HOLD_MS } from '@/features/rec/armementLogic';
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
  tabBarSpace,
  typo,
  useDoorTransition,
} from '@/ui/v2';
import { REC_ROUTES } from '@/features/rec/captureStepLogic';

/** Côté du canevas de la jauge circulaire d'armement. */
const GAUGE_SIZE = 96;

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
        <Text style={styles.armLabel}>ARMER LA CAPTURE</Text>
        <Text style={styles.armHint}>Maintenez pour armer</Text>
      </View>
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

  const verdict = verdictArmement(ble, starting);
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
      const def = await getDefaultCircuit();
      if (!cancelled) setSelectedId(def?.id ?? list[0]?.id ?? null);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = circuits.find((c) => c.id === selectedId) ?? null;

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
    if (!verdictArmement(bluetoothService.getStatus(), starting).peutArmer) return;
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

      <View style={styles.body}>
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

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: tabBarSpace(insets.bottom) + space.lg }]}>
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
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.xl,
  },
  trackCard: {
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
    minHeight: 72,
    backgroundColor: colors.accent,
    borderRadius: radius.hero,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
  },
  armBtnDisabled: {
    opacity: 0.6,
  },
  gauge: {
    position: 'absolute',
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
   * « Maintenez pour armer » — LE TEXTE LE MOINS LISIBLE DU FLUX, et c'était
   * la consigne qui explique comment armer la capture.
   *
   * Mesuré le 05/08/2026 : `text.hi` à 70 % d'opacité sur le rouge de marque
   * donne **2,90**. Sous le seuil AA ordinaire de 4,5, très loin du plancher de
   * 7:1 que le jalon impose aux huit écrans du flux — et en plein soleil, au
   * paddock, sur un bouton qu'il faut trouver avant de rouler.
   *
   * L'opacité est retirée et le blanc pur remplace le gris clair : 5,88, le
   * MAXIMUM atteignable sur `#C8102E`. Le plancher de 7:1 reste hors de portée
   * sur le rouge de marque — aucune couleur de texte ne l'atteint. C'est un
   * arbitrage qui vous revient : changer le rouge, ou passer ces boutons en
   * bord seul. Consigné au dossier de décisions.
   */
  armHint: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: '#FFFFFF',
    marginTop: 3,
  },
});
