/**
 * DEV-GALERIE — écran de validation fondateur du kit V2 (lot L0, Livrable 8).
 *
 * STRICTEMENT __DEV__ : en build de production la route redirige vers la
 * porte Miroir et ne rend RIEN. Toutes les valeurs affichées ici sont des
 * DONNÉES DE DÉMONSTRATION (constantes DEMO_*, locales à ce fichier) — rien
 * ne fuit hors de cet écran.
 *
 * Sections : composants du kit · les 20 icônes · primitives motion
 * déclenchables (« Rejouer » = re-mount par key) · haptics.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Canvas } from '@shopify/react-native-skia';

import { tabBarSpace } from '@/ui/v2';
import { BiometryStrip } from '@/ui/v2/BiometryStrip';
import { CentralButton } from '@/ui/v2/CentralButton';
import { Chip } from '@/ui/v2/Chip';
import { ChronoHero } from '@/ui/v2/ChronoHero';
import { Dial } from '@/ui/v2/Dial';
import { HeritageBand } from '@/ui/v2/HeritageBand';
import { ListRow } from '@/ui/v2/ListRow';
import { PillarBar } from '@/ui/v2/PillarBar';
import { RadarQdi } from '@/ui/v2/RadarQdi';
import { SectionHeader } from '@/ui/v2/SectionHeader';
import { SessionCard } from '@/ui/v2/SessionCard';
import { Sheet } from '@/ui/v2/Sheet';
import { StatCell } from '@/ui/v2/StatCell';
import { StateView } from '@/ui/v2/StateView';
import { TraceCircuit } from '@/ui/v2/TraceCircuit';
import { haptic, type HapticKind } from '@/ui/v2/haptics';
import { OXV_ICON_NAMES, OxvIcon } from '@/ui/v2/icons';
import { Photo, TITANE_BLURHASH } from '@/components/media';
import { HeroPhoto } from '@/ui/v2/media';
import {
  CondensingHeaderBar,
  GlowStroke,
  HeroMorphProvider,
  NeedleSweep,
  PressScale,
  PullToRefreshDial,
  RecordFlash,
  RollingCounter,
  Shimmer,
  Stagger,
  useCondensingHeader,
  useDoorTransition,
  useHeroMorphSource,
  useHeroMorphTarget,
} from '@/ui/v2/motion';
import { colors, radius, space, type as typo } from '@/ui/v2/tokens';
import { EMPTY_CIRCUIT_PATH, EMPTY_CIRCUIT_POINTS, msToLapLabel } from '@/ui/v2/uiLogic';

// ---------------------------------------------------------------------------
// Données de DÉMONSTRATION — locales à cet écran __DEV__, jamais exportées.
// ---------------------------------------------------------------------------

/** Visuel de démo : l'insigne OXV du bundle (jamais d'image stock). */
const DEMO_PHOTO_URI = Image.resolveAssetSource(require('../../assets/insignia-fill.png')).uri;

/** Chrono de démo (millisecondes). */
const DEMO_CHRONO_MS = 91724;

/** QDI de démo — 5 branches renseignées. */
const DEMO_QDI = {
  trajectoire: 72,
  fluidite: 64,
  freinage: 58,
  acceleration: 66,
  regularite: 80,
} as const;

/** Fréquence cardiaque de démo — sinusoïde autour de 96 bpm. */
const DEMO_BIOMETRY = Array.from({ length: 40 }, (_, i) => ({
  ts: i * 1000,
  hr: 96 + Math.round(14 * Math.sin(i / 5)),
}));

/** Tracé de démo : la polyligne maison de l'état vide, convertie en XY. */
const DEMO_TRACE = EMPTY_CIRCUIT_POINTS.map(([x, y]) => ({ x, y }));

/** Puces d'événements de démo sur le tracé (positions curvilignes). */
const DEMO_MARKERS = [{ t: 0.25 }, { t: 0.7 }];

// ---------------------------------------------------------------------------
// Petits blocs locaux de la galerie
// ---------------------------------------------------------------------------

function Bloc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DemoButton({
  label,
  onPress,
  hapticOnPress = true,
}: {
  label: string;
  onPress: () => void;
  hapticOnPress?: boolean;
}) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} hapticOnPress={hapticOnPress}>
      <View style={styles.demoButton}>
        <Text style={styles.demoButtonLabel}>{label}</Text>
      </View>
    </PressScale>
  );
}

/** Porte : carte qui rejoue son entrée à chaque re-mount. */
function DoorDemo() {
  const door = useDoorTransition();
  return (
    <Animated.View style={[styles.demoCard, door]}>
      <Text style={styles.demoCardText}>Entrée de porte — fondu + 12 px</Text>
    </Animated.View>
  );
}

/** HeroMorph : la carte tapée voyage vers un bloc cible, dans l'écran. */
function MorphDemo() {
  const [showTarget, setShowTarget] = useState(false);
  const source = useHeroMorphSource('galerie-morph');
  return (
    <View style={styles.morphZone}>
      {showTarget ? (
        <MorphTarget onClose={() => setShowTarget(false)} />
      ) : (
        <PressScale
          onPress={() => {
            source.capture();
            setShowTarget(true);
          }}
          accessibilityLabel="Déclencher le morph"
        >
          <View ref={source.ref} collapsable={false} style={styles.morphSource}>
            <Text style={styles.demoCardText}>{msToLapLabel(DEMO_CHRONO_MS)}</Text>
          </View>
        </PressScale>
      )}
    </View>
  );
}

function MorphTarget({ onClose }: { onClose: () => void }) {
  const target = useHeroMorphTarget('galerie-morph');
  return (
    <Animated.View style={target.style}>
      <View
        ref={target.ref}
        onLayout={target.onLayout}
        collapsable={false}
        style={styles.morphTarget}
      >
        <Text style={styles.morphTargetChrono}>{msToLapLabel(DEMO_CHRONO_MS)}</Text>
        <DemoButton label="Refermer" onPress={onClose} />
      </View>
    </Animated.View>
  );
}

/** PullToRefreshDial dans une vitrine à hauteur fixe (liste imbriquée). */
function PullDemo() {
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const onRefresh = () => {
    setRefreshing(true);
    timer.current = setTimeout(() => setRefreshing(false), 1500);
  };
  return (
    <View style={styles.vitrine}>
      <PullToRefreshDial refreshing={refreshing} onRefresh={onRefresh}>
        {(scrollProps) => (
          <ScrollView {...scrollProps} nestedScrollEnabled>
            {['Tour 1', 'Tour 2', 'Tour 3', 'Tour 4', 'Tour 5'].map((label, i) => (
              <ListRow key={label} label={label} value={msToLapLabel(DEMO_CHRONO_MS + i * 480)} />
            ))}
          </ScrollView>
        )}
      </PullToRefreshDial>
    </View>
  );
}

/** Header condensant dans une vitrine à hauteur fixe. */
function CondensingDemo() {
  const { scrollHandler, headerStyle, condensedStyle, titleStyle } = useCondensingHeader();
  return (
    <View style={styles.vitrine}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={styles.condensingContent}
      >
        <Animated.View style={headerStyle}>
          <Animated.Text style={[styles.condensingTitle, titleStyle]}>Vos journées</Animated.Text>
        </Animated.View>
        {Array.from({ length: 10 }, (_, i) => (
          <ListRow key={i} label={`Ligne ${i + 1}`} />
        ))}
      </Animated.ScrollView>
      <CondensingHeaderBar condensedStyle={condensedStyle} height={40}>
        <Text style={styles.condensedBarTitle}>Vos journées</Text>
      </CondensingHeaderBar>
    </View>
  );
}

// ---------------------------------------------------------------------------
// L'écran
// ---------------------------------------------------------------------------

const HAPTIC_DEMOS: { kind: HapticKind; label: string }[] = [
  { kind: 'tap', label: 'tap — sélection' },
  { kind: 'arm', label: 'arm — armer la capture' },
  { kind: 'record', label: 'record — record personnel' },
  { kind: 'doorSnap', label: 'doorSnap — cran franchi' },
  { kind: 'warn', label: 'warn — alerte' },
];

function DevGalerie() {
  const insets = useSafeAreaInsets();

  // États des démos interactives.
  const [activeChip, setActiveChip] = useState('Tous');
  const [celebrate, setCelebrate] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [dialValue, setDialValue] = useState(120);
  const [counterMs, setCounterMs] = useState(DEMO_CHRONO_MS);
  const [flashOn, setFlashOn] = useState(false);
  const [needleAngle, setNeedleAngle] = useState(45);
  const [pressCount, setPressCount] = useState(0);
  // Clés de re-mount des primitives « Rejouer ».
  const [doorKey, setDoorKey] = useState(0);
  const [staggerKey, setStaggerKey] = useState(0);
  const [radarKey, setRadarKey] = useState(0);
  const [pillarKey, setPillarKey] = useState(0);
  const [traceKey, setTraceKey] = useState(0);

  return (
    <HeroMorphProvider>
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + space.xl,
              paddingBottom: tabBarSpace(insets.bottom) + space.xxl,
            },
          ]}
        >
          <Text style={styles.title}>DEV-GALERIE</Text>
          <Text style={styles.subtitle}>
            Écran de validation du kit V2. Toutes les valeurs affichées sont des données de
            démonstration.
          </Text>

          {/* ─── Icônes ─────────────────────────────────────────────── */}
          <SectionHeader
            eyebrow="ICONOGRAPHIE"
            title="Les 20 icônes"
            count={OXV_ICON_NAMES.length}
          />
          <View style={styles.iconGrid}>
            {OXV_ICON_NAMES.map((name) => (
              <View key={name} style={styles.iconCell}>
                <OxvIcon name={name} size={24} color={colors.text.hi} />
                <Text style={styles.iconLabel}>{name}</Text>
              </View>
            ))}
          </View>

          {/* ─── Composants ─────────────────────────────────────────── */}
          <SectionHeader eyebrow="COMPOSANTS" title="Le kit" />

          <Bloc title="StateView — loading (formes de liste)">
            <StateView state="loading" shape="list" />
          </Bloc>
          <Bloc title="StateView — empty (tracé qui se dessine)">
            <StateView state="empty" />
          </Bloc>
          <Bloc title="StateView — error">
            <StateView state="error" onRetry={() => undefined} />
          </Bloc>
          <Bloc title="StateView — offline (dernier contenu dessous)">
            <StateView state="offline">
              <ListRow label="Dernier contenu connu" icon="circuit" divider={false} />
            </StateView>
          </Bloc>

          <Bloc title="SectionHeader — avec compteur">
            <SectionHeader eyebrow="SESSIONS" title="Vos journées" count={3} />
          </Bloc>

          <Bloc title="Chip — filtres">
            <View style={styles.row}>
              {(['Tous', 'Circuit', 'Route'] as const).map((label) => (
                <Chip
                  key={label}
                  label={label}
                  active={activeChip === label}
                  onPress={() => setActiveChip(label)}
                />
              ))}
            </View>
          </Bloc>

          <Bloc title="ListRow — lignes hairline">
            <View style={styles.card}>
              <ListRow
                icon="chrono"
                label="Meilleur tour"
                value={msToLapLabel(DEMO_CHRONO_MS)}
                onPress={() => undefined}
              />
              <ListRow
                icon="casque"
                label="Équipement"
                sublabel="RaceBox Mini S"
                onPress={() => undefined}
              />
              <ListRow icon="cle" label="Réglages" divider={false} onPress={() => undefined} />
            </View>
          </Bloc>

          <Bloc title="StatCell — dont slot RollingCounter">
            <View style={styles.row}>
              <StatCell label="Tours" value="12" style={styles.statFlex} />
              <StatCell label="Meilleur tour" style={styles.statFlex}>
                <RollingCounter value={msToLapLabel(DEMO_CHRONO_MS)} fontSize={22} />
              </StatCell>
            </View>
          </Bloc>

          <Bloc title="SessionCard — avec et sans photo">
            <SessionCard
              circuit="Circuit de Haute Saintonge"
              dateLabel="12 juillet 2026"
              chronoMs={DEMO_CHRONO_MS}
              photoUri={DEMO_PHOTO_URI}
              photoBlurhash={TITANE_BLURHASH}
              onPress={() => undefined}
            />
            <SessionCard
              circuit="Ricardo Tormo — Valencia"
              dateLabel="28 juillet 2026"
              chronoMs={DEMO_CHRONO_MS + 3210}
              onPress={() => undefined}
            />
          </Bloc>

          <Bloc title="ChronoHero — célébration RecordFlash">
            <ChronoHero
              chronoMs={DEMO_CHRONO_MS}
              size="l"
              celebrate={celebrate}
              onCelebrateDone={() => setCelebrate(false)}
            />
            <DemoButton label="Célébrer" onPress={() => setCelebrate(true)} />
          </Bloc>

          <Bloc title="RadarQdi — tracé progressif + points">
            <View key={radarKey} style={styles.centered}>
              <RadarQdi values={DEMO_QDI} size="l" animateOnViewport={false} />
            </View>
            <DemoButton label="Rejouer" onPress={() => setRadarKey((k) => k + 1)} />
          </Bloc>

          <Bloc title="PillarBar — remplissage animé (valeur absente = tiret)">
            <View key={pillarKey} style={styles.stack}>
              <PillarBar label="Trajectoire" value={72} animateOnViewport={false} />
              <PillarBar label="Fluidité" value={64} animateOnViewport={false} />
              <PillarBar label="Régularité" value={null} animateOnViewport={false} />
            </View>
            <DemoButton label="Rejouer" onPress={() => setPillarKey((k) => k + 1)} />
          </Bloc>

          <Bloc title="TraceCircuit — GlowStroke + puces">
            <View key={traceKey}>
              <TraceCircuitDemo />
            </View>
            <DemoButton label="Rejouer" onPress={() => setTraceKey((k) => k + 1)} />
          </Bloc>

          <Bloc title="BiometryStrip — dernier point pulsé au bpm moyen">
            <BiometryStrip samples={DEMO_BIOMETRY} source="montre" quality="haute" />
          </Bloc>

          <Bloc title="HeritageBand — trait or, ombre du trait">
            <HeritageBand>
              <Text style={styles.demoCardText}>Bande de démonstration</Text>
            </HeritageBand>
          </Bloc>

          <Bloc title="Dial — aiguille (instantané) + arc (cumul)">
            <View style={styles.centered}>
              <Dial value={dialValue} max={180} label="VITESSE" unit="km/h" size="m" />
            </View>
            <DemoButton
              label="Nouvelle valeur"
              onPress={() => setDialValue(Math.round(Math.random() * 180))}
            />
          </Bloc>

          <Bloc title="CentralButton — les 3 états">
            <View style={styles.centralRow}>
              <CentralButton mode="reserve" onPress={() => undefined} />
              <CentralButton mode="countdown" label="J-3" onPress={() => undefined} />
              <CentralButton mode="rec" onPress={() => undefined} />
            </View>
          </Bloc>

          <Bloc title="Sheet — fond carte, backdrop blur">
            <DemoButton label="Ouvrir le sheet" onPress={() => setSheetVisible(true)} />
          </Bloc>

          <Bloc title="Photo — blurhash titane + fade 220 ms">
            <Photo uri={DEMO_PHOTO_URI} blurhash={TITANE_BLURHASH} style={styles.photo} />
          </Bloc>

          <Bloc title="HeroPhoto — scrim bas + texte superposé, et repli sans photo">
            <HeroPhoto uri={DEMO_PHOTO_URI} height={180}>
              <View style={styles.heroCaption}>
                <Text style={styles.heroCaptionText}>Texte lisible sur le scrim</Text>
              </View>
            </HeroPhoto>
            <HeroPhoto
              height={120}
              fallback={
                <View style={styles.heroFallback}>
                  <OxvIcon name="circuit" size={32} color={colors.text.dim} />
                </View>
              }
            />
          </Bloc>

          {/* ─── Motion ─────────────────────────────────────────────── */}
          <SectionHeader eyebrow="MOTION" title="Les primitives" />

          <Bloc title="useDoorTransition — entrée d'écran">
            <DoorDemo key={doorKey} />
            <DemoButton label="Rejouer" onPress={() => setDoorKey((k) => k + 1)} />
          </Bloc>

          <Bloc title="Stagger — cascade 45 ms">
            <Stagger key={staggerKey} itemStyle={styles.staggerItem}>
              {['Trajectoire', 'Fluidité', 'Freinage', 'Régularité'].map((label) => (
                <View key={label} style={styles.demoCard}>
                  <Text style={styles.demoCardText}>{label}</Text>
                </View>
              ))}
            </Stagger>
            <DemoButton label="Rejouer" onPress={() => setStaggerKey((k) => k + 1)} />
          </Bloc>

          <Bloc title="RollingCounter — digits odomètre, millièmes en accent">
            <RollingCounter value={msToLapLabel(counterMs)} accentMillis />
            <DemoButton
              label="Nouvelle valeur"
              onPress={() => setCounterMs(85000 + Math.round(Math.random() * 20000))}
            />
          </Bloc>

          <Bloc title="RecordFlash — blanc vers or, 900 ms">
            <RecordFlash
              trigger={flashOn}
              text={msToLapLabel(DEMO_CHRONO_MS)}
              onDone={() => setFlashOn(false)}
            />
            <DemoButton label="Rejouer" onPress={() => setFlashOn(true)} />
          </Bloc>

          <Bloc title="NeedleSweep — spring mécanique">
            <View style={styles.centered}>
              <NeedleSweep angle={needleAngle} size={56} snapHaptic />
            </View>
            <DemoButton
              label="Nouvel angle"
              onPress={() => setNeedleAngle(Math.round(Math.random() * 270) - 135)}
            />
          </Bloc>

          <Bloc title="Shimmer — squelette froid, jamais de spinner">
            <View style={styles.stack}>
              <Shimmer height={56} />
              <Shimmer height={20} width="60%" />
            </View>
          </Bloc>

          <Bloc title="PressScale — scale 0.97 + haptic tap">
            <DemoButton
              label={`Appuis : ${pressCount}`}
              onPress={() => setPressCount((c) => c + 1)}
            />
          </Bloc>

          <Bloc title="GlowStroke — lumière du trait (Skia)">
            <View style={styles.centered}>
              <Canvas style={styles.glowCanvas}>
                <GlowStroke path={EMPTY_CIRCUIT_PATH} />
              </Canvas>
            </View>
          </Bloc>

          <Bloc title="HeroMorph — la carte voyage (taper la carte)">
            <MorphDemo />
          </Bloc>

          <Bloc title="PullToRefreshDial — tirer la liste, l'aiguille suit">
            <PullDemo />
          </Bloc>

          <Bloc title="useCondensingHeader — barre condensée au scroll">
            <CondensingDemo />
          </Bloc>

          {/* ─── Haptics ────────────────────────────────────────────── */}
          <SectionHeader
            eyebrow="HAPTICS"
            title="Le vocabulaire tactile"
            count={HAPTIC_DEMOS.length}
          />
          <View style={styles.stack}>
            {HAPTIC_DEMOS.map(({ kind, label }) => (
              <DemoButton
                key={kind}
                label={label}
                hapticOnPress={false}
                onPress={() => haptic(kind)}
              />
            ))}
          </View>
        </ScrollView>

        <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)}>
          <View style={styles.sheetContent}>
            <Text style={styles.blocTitle}>Sheet de démonstration</Text>
            <ListRow icon="circuit" label="Une ligne" value="valeur" divider={false} />
            <DemoButton label="Fermer" onPress={() => setSheetVisible(false)} />
          </View>
        </Sheet>
      </View>
    </HeroMorphProvider>
  );
}

/** TraceCircuit isolé pour que la key de re-mount rejoue le dessin auto. */
function TraceCircuitDemo() {
  return (
    <TraceCircuit
      centerline={DEMO_TRACE}
      height={160}
      markers={DEMO_MARKERS}
      animateOnViewport={false}
    />
  );
}

export default function DevGalerieRoute() {
  // Production : cet écran n'existe pas. Redirection sobre vers la racine —
  // le routeur racine renvoie chacun vers son espace selon son rôle.
  if (!__DEV__) return <Redirect href="/" />;
  return <DevGalerie />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  title: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  subtitle: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.mid,
  },
  bloc: {
    gap: space.md,
  },
  blocTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.low,
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  stack: {
    gap: space.sm,
  },
  centered: {
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    paddingHorizontal: space.md,
  },
  statFlex: {
    flex: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  iconCell: {
    width: 76,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    backgroundColor: colors.bg.card,
    borderRadius: radius.cell,
  },
  iconLabel: {
    fontFamily: typo.mono,
    fontSize: 9,
    color: colors.text.low,
  },
  demoButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border.strong,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  demoButtonLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 13,
    color: colors.text.hi,
  },
  demoCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.cell,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.md,
  },
  demoCardText: {
    fontFamily: typo.body,
    fontSize: 14,
    color: colors.text.hi,
  },
  staggerItem: {
    marginBottom: space.sm,
  },
  centralRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: space.lg,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radius.cell,
  },
  heroCaption: {
    position: 'absolute',
    left: space.lg,
    bottom: space.lg,
  },
  heroCaptionText: {
    fontFamily: typo.bodySemi,
    fontSize: 16,
    color: colors.text.hi,
  },
  heroFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card2,
  },
  vitrine: {
    height: 240,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    overflow: 'hidden',
    backgroundColor: colors.bg.base,
  },
  condensingContent: {
    paddingTop: space.xl,
    paddingHorizontal: space.md,
  },
  condensingTitle: {
    fontFamily: typo.display,
    color: colors.text.hi,
    marginBottom: space.md,
  },
  condensedBarTitle: {
    fontFamily: typo.bodyMedium,
    fontSize: 12,
    color: colors.text.hi,
  },
  glowCanvas: {
    width: 208,
    height: 116,
  },
  morphZone: {
    minHeight: 140,
    justifyContent: 'center',
  },
  morphSource: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg.card,
    borderRadius: radius.cell,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  morphTarget: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },
  morphTargetChrono: {
    fontFamily: typo.monoSemi,
    fontSize: 34,
    color: colors.text.hi,
  },
  sheetContent: {
    padding: space.xl,
    gap: space.md,
  },
});
