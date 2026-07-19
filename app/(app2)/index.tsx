/**
 * ACCUEIL MIROIR — porte d'entrée (app2), lot V2-L1 écran 1/3.
 *
 * Le présent du pilote, deux visages (décision fondateur 18/07) :
 *   - après-séance (< 7 j) : héros photo de la séance + ChronoHero, tap →
 *     HeroMorph vers le Bilan (morphId `bilan-{sessionId}`) ;
 *   - entre-journées : héros = SA voiture (cover garage) + cadran J-x, ou
 *     carte RÉSERVER si rien au calendrier (flag app_payments fail-closed).
 * Puis : bandeau rituel J-3 (B3 MINIMAL : journée réelle à ≤ 3 j, dismiss
 * swipe persisté par journée, deep link préparation — la préférence rituels
 * arrive au lot L4), signature compacte (RadarQdi s), UN fait (narrative ou
 * fait de saison), rangée stats hairline (RECORD · SAISON · HERITAGE/SÉANCES,
 * le compteur Heritage lu depuis heritage_packs — jamais un /4 codé en dur).
 *
 * Les modes capture v1 restent prioritaires : S5 approche ET S6 roulage =
 * silence en piste (Principe 3 — aucun écran de données pendant que le
 * véhicule bouge), S4 = countdown (decidePaddockAction importé, jamais
 * dupliqué).
 *
 * Données réelles câblées : tout vient de useMiroirHome (services existants) ;
 * absent = « — » ou section masquée, jamais une valeur inventée ; panne
 * totale des sources primaires = StateView erreur + Réessayer, jamais un
 * écran calme qui affirme un vide qu'il n'a pas lu.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { trackEvent } from '@/services/analyticsService';
import { decidePaddockAction } from '@/services/paddockHeroLogic';
import { useAppStateStore } from '@/store/useAppStateStore';
import { useAuthStore } from '@/store/useAuthStore';
import {
  ChronoHero,
  colors,
  CondensingHeaderBar,
  Dial,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  HeroPhoto,
  motionTokens,
  msToLapLabel,
  OxvIcon,
  Photo,
  PressScale,
  PullToRefreshDial,
  QDI_BRANCH_LABELS,
  QDI_BRANCHES,
  radius,
  RadarQdi,
  RollingCounter,
  Shimmer,
  space,
  Stagger,
  staggerEntering,
  StatCell,
  StateView,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
  useFirstViewport,
  useHeroMorphSource,
} from '@/ui/v2';

import {
  decideReserve,
  DIAL_COUNTDOWN_MAX_DAYS,
  ritualBannerText,
  shouldShowRitualBanner,
  zeroLike,
} from '@/features/miroir/miroirHomeLogic';
import { bilanHeroMorphId } from '@/features/miroir/bilanLogic';
import { useMiroirHome, type MiroirHome } from '@/features/miroir/useMiroirHome';

// ---------------------------------------------------------------------------
// Helpers de format (affichage uniquement — aucune décision de données ici)
// ---------------------------------------------------------------------------

/** « Vendredi 17 juillet » — date pleine de la dernière séance. */
function fullDayLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** « Sam. 19 juil. » — date courte de la prochaine journée (patron v1). */
function shortDayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return '';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function MiroirHomeScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const profile = useAuthStore((s) => s.profile);
  const pilotState = useAppStateStore((s) => s.state);
  const home = useMiroirHome(profile?.id ?? null);
  const header = useCondensingHeader();
  const [heroOffset, setHeroOffset] = useState(0);

  // Un seul scroll, deux consommateurs. Les worklets du kit (headerStyle /
  // condensedStyle / titleStyle, parallaxe HeroPhoto) lisent header.scrollY
  // sur l'UI thread : on l'alimente par useAnimatedScrollHandler (worklet),
  // jamais démoté au rythme du thread JS. Le PullToRefreshDial, lui, expose
  // un onScroll JS (contrat actuel du kit) qui ne lit QUE
  // nativeEvent.contentOffset.y (signature lue) — on le lui forwarde via
  // runOnJS avec un événement minimal. LIMITE KIT documentée : l'armement du
  // Pan du dial reste nourri au rythme JS (comme dans le kit seul) — la
  // composition 100 % worklet demanderait d'exposer une SharedValue côté
  // PullToRefreshDial, extension kit hors périmètre L1.
  const dialOnScroll = useRef<((e: NativeSyntheticEvent<NativeScrollEvent>) => void) | null>(null);
  const forwardScrollToDial = useCallback((y: number) => {
    dialOnScroll.current?.({
      nativeEvent: { contentOffset: { y } },
    } as NativeSyntheticEvent<NativeScrollEvent>);
  }, []);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    header.scrollY.value = event.contentOffset.y;
    runOnJS(forwardScrollToDial)(event.contentOffset.y);
  });

  // Modes capture v1 — prioritaires sur tout (logique importée, pas dupliquée).
  // S5 approche ET S6 roulage : silence en piste (Principe 3 — « aucun écran
  // n'est affiché »). Un retour geste depuis le flux capture pendant le
  // roulage ne montre JAMAIS chrono/radar/stats ; textes S6 repris tels quels
  // du canon v1 (app/(app)/roulage.tsx).
  if (pilotState === 'S5_approche' || pilotState === 'S6_roulage') {
    const onTrack = pilotState === 'S6_roulage';
    return (
      <Animated.View style={[styles.root, styles.modeRoot, { paddingTop: insets.top }, door]}>
        <Text style={styles.eyebrowAccent}>{onTrack ? 'EN PISTE' : 'EN ROUTE'}</Text>
        <Text style={styles.modeTitle}>{onTrack ? "L'app s'efface." : 'Bon trajet.'}</Text>
        <Text style={styles.modeBody}>
          {onTrack ? 'Aucun écran. Aucun son. Conduisez.' : "Coupez l'app. Je conduis."}
        </Text>
      </Animated.View>
    );
  }

  if (pilotState === 'S4_anticipation') {
    const action = decidePaddockAction({
      state: pilotState,
      hasRecentSession: home.lastSession !== null,
      recentSessionId: home.lastSession?.id ?? null,
    });
    return (
      <Animated.View style={[styles.root, styles.modeRoot, { paddingTop: insets.top }, door]}>
        <Stagger>
          <Text style={styles.eyebrowAccent}>PROCHAINE SÉANCE</Text>
          <Text style={styles.modeTitle}>
            {profile?.first_name ? `À bientôt, ${profile.first_name}.` : 'À bientôt.'}
          </Text>
          <Text style={styles.modeBody}>L&apos;app vous tiendra au courant.</Text>
          {action !== null ? (
            <PressScale
              onPress={() => router.navigate(action.href as never)}
              accessibilityLabel={action.label}
              containerStyle={{ marginTop: space.xl }}
              style={styles.modePill}
            >
              <Text style={styles.modePillLabel}>{action.label}</Text>
            </PressScale>
          ) : null}
        </Stagger>
      </Animated.View>
    );
  }

  // Bandeau rituel J-3 (B3 minimal) : uniquement une journée RÉELLE à ≤ 3 j,
  // non écartée pour cette journée. Texte factuel assemblé en logique pure.
  const ritualText =
    home.status === 'ready' &&
    home.nextDay !== null &&
    home.daysToNextDay !== null &&
    shouldShowRitualBanner(home.daysToNextDay) &&
    !home.ritualDismissed
      ? ritualBannerText(home.daysToNextDay, home.nextDay.circuitName)
      : null;

  return (
    <Animated.View style={[styles.root, door]}>
      <PullToRefreshDial refreshing={home.refreshing} onRefresh={home.refresh}>
        {(scrollProps) => {
          // onScroll stable du dial (suivi d'offset pour l'armement du Pan) —
          // consommé par le worklet scrollHandler via runOnJS (voir plus haut).
          dialOnScroll.current = scrollProps.onScroll;
          return (
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={scrollProps.scrollEventThrottle}
              bounces={scrollProps.bounces}
              overScrollMode={scrollProps.overScrollMode}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: insets.top + space.md,
                paddingBottom: tabBarSpace(insets.bottom) + space.xl,
                paddingHorizontal: space.xl,
              }}
            >
              {/* Grand header — s'efface au scroll (barre condensée en relais).
                  L'avatar vit HORS du scroll (overlay fixe, zIndex 11) : la
                  CondensingHeaderBar (zIndex 10) recouvre cette bande et son
                  contenu interne capte les touches — un avatar posé ici serait
                  intappable (vérifié : opacity 0 ne désactive pas le hit-test). */}
              <Animated.View style={[styles.headerRow, header.headerStyle]}>
                <View>
                  <Text
                    style={[
                      styles.headerEyebrow,
                      home.heritage.isHeritage ? styles.eyebrowGold : styles.eyebrowRed,
                    ]}
                  >
                    {home.heritage.isHeritage ? 'HERITAGE' : 'PADDOCK'}
                  </Text>
                  <Animated.Text style={[styles.headerTitle, header.titleStyle]}>
                    MIROIR
                  </Animated.Text>
                </View>
              </Animated.View>

              {home.status === 'loading' ? (
                <HomeSkeleton />
              ) : home.status === 'error' ? (
                // Panne totale des sources primaires : état d'erreur honnête —
                // jamais « Aucune journée » / « 0 km » fabriqués hors ligne.
                <StateView
                  state="error"
                  errorMessage="Votre Miroir n'a pas pu se charger."
                  onRetry={home.refresh}
                />
              ) : (
                <>
                  {ritualText !== null ? (
                    <RitualBanner text={ritualText} onDismiss={home.dismissRitual} />
                  ) : null}

                  {/* HÉROS — la photo d'abord. Hors Stagger pour un parallax
                      à l'offset juste (mesuré au layout), entrée décalée n°0. */}
                  <Animated.View
                    entering={staggerEntering(0)}
                    onLayout={(e) => setHeroOffset(e.nativeEvent.layout.y)}
                  >
                    <Hero home={home} scrollY={header.scrollY} parallaxOffset={heroOffset} />
                  </Animated.View>

                  <Stagger step={45} initialDelay={45}>
                    <SignatureCard home={home} />
                    <Fact home={home} />
                    <StatsRow home={home} />
                  </Stagger>
                </>
              )}
            </Animated.ScrollView>
          );
        }}
      </PullToRefreshDial>

      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        <Text style={styles.condensedTitle}>MIROIR</Text>
      </CondensingHeaderBar>

      {/* Avatar — overlay FIXE au-dessus de la barre condensée (zIndex 11 >
          10, patron du header fixe du Bilan) : tappable aux DEUX états, au
          repos comme condensé (il se pose visuellement dans la barre). */}
      <PressScale
        onPress={() => router.navigate('/(app2)/vous' as never)}
        accessibilityLabel="Votre profil"
        containerStyle={[styles.avatarFixed, { top: insets.top + space.md }]}
        style={styles.avatar}
      >
        {home.avatarUrl !== null ? (
          <Photo uri={home.avatarUrl} style={styles.avatarPhoto} />
        ) : (
          <OxvIcon name="casque" size={18} color={colors.text.mid} />
        )}
      </PressScale>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Bandeau rituel J-3 — B3 MINIMAL (données réelles) : hairline, tap → écran
// préparation, dismiss par swipe horizontal (persisté MMKV par journée).
// La préférence rituels (opt-out par catégorie, câblage notifications
// complet) arrive au lot L4 — consigné au rapport de lot.
// ---------------------------------------------------------------------------

/** Course horizontale (px) au-delà de laquelle le swipe écarte le bandeau. */
const RITUAL_DISMISS_DISTANCE = 72;

function RitualBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  const tx = useSharedValue(0);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Horizontal uniquement : le scroll vertical de la liste reste natif.
        .activeOffsetX([-14, 14])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          tx.value = event.translationX;
        })
        .onEnd(() => {
          if (Math.abs(tx.value) >= RITUAL_DISMISS_DISTANCE) {
            tx.value = withTiming(Math.sign(tx.value) * 480, { duration: 160 });
            runOnJS(onDismiss)();
          }
        })
        .onFinalize(() => {
          // Fin OU annulation système sous le seuil : retour en place.
          if (Math.abs(tx.value) < RITUAL_DISMISS_DISTANCE) {
            tx.value = withSpring(0, motionTokens.spring);
          }
        }),
    [onDismiss, tx]
  );

  const swipeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: 1 - Math.min(Math.abs(tx.value) / 320, 0.7),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.ritualBanner, swipeStyle]}>
        <PressScale
          onPress={() => router.navigate('/(app)/preparation' as never)}
          accessibilityLabel={`${text} Ouvrir la préparation`}
          style={styles.ritualInner}
        >
          <Text style={styles.ritualText} numberOfLines={2}>
            {text}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </PressScale>
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Héros — 3 variantes exactes de la spec
// ---------------------------------------------------------------------------

function Hero({
  home,
  scrollY,
  parallaxOffset,
}: {
  home: MiroirHome;
  scrollY: ReturnType<typeof useCondensingHeader>['scrollY'];
  parallaxOffset: number;
}) {
  if (home.mode === 'apres_seance' && home.lastSession !== null) {
    return <HeroApresSeance home={home} scrollY={scrollY} parallaxOffset={parallaxOffset} />;
  }
  if (home.nextDay !== null) {
    return <HeroEntreJournees home={home} scrollY={scrollY} parallaxOffset={parallaxOffset} />;
  }
  return <HeroSansJournee home={home} />;
}

/** Fallback visuel du héros : tracé Skia GlowStroke sur bg.card (kit). */
function CircuitTraceFallback() {
  return (
    <Canvas style={styles.fallbackCanvas}>
      <GlowStroke path={EMPTY_CIRCUIT_PATH} strokeWidth={2} />
    </Canvas>
  );
}

function HeroApresSeance({
  home,
  scrollY,
  parallaxOffset,
}: {
  home: MiroirHome;
  scrollY: ReturnType<typeof useCondensingHeader>['scrollY'];
  parallaxOffset: number;
}) {
  const session = home.lastSession;
  // Contrat HeroMorph unifié : le morphId vient de bilanLogic (source unique) —
  // le Bilan consomme le MÊME id via useHeroMorphTarget(bilanHeroMorphId(id)).
  const morph = useHeroMorphSource(bilanHeroMorphId(session?.id ?? 'session'));
  if (session === null) return null;

  const chronoLabel = session.bestMs !== null ? msToLapLabel(session.bestMs) : null;
  const open = () => {
    // Fige la géométrie AVANT la navigation (contrat HeroMorph).
    morph.capture();
    router.push(`/(app2)/bilan/${session.id}` as never);
  };

  return (
    <PressScale
      onPress={open}
      accessibilityLabel={`Dernière séance${session.circuitName ? `, ${session.circuitName}` : ''}${
        chronoLabel !== null ? `, meilleur tour ${chronoLabel}` : ''
      }. Ouvrir le bilan`}
    >
      <View ref={morph.ref} collapsable={false}>
        <HeroPhoto
          uri={home.lastSessionPhotoUrl ?? undefined}
          height={200}
          scrollY={scrollY}
          parallaxOffset={parallaxOffset}
          fallback={<CircuitTraceFallback />}
        >
          <Text style={styles.heroEyebrow} numberOfLines={1}>
            DERNIÈRE SÉANCE
            {session.circuitName ? ` · ${session.circuitName.toUpperCase()}` : ''}
          </Text>
          {session.bestMs !== null ? (
            <ChronoHero
              chronoMs={session.bestMs}
              size="m"
              celebrate={home.celebrateRecord}
              onCelebrateDone={home.markRecordCelebrated}
            />
          ) : (
            <Text style={styles.heroNoChrono}>—</Text>
          )}
          <Text style={styles.heroDate}>{fullDayLabel(session.startedAt)}</Text>
        </HeroPhoto>
      </View>
    </PressScale>
  );
}

function HeroEntreJournees({
  home,
  scrollY,
  parallaxOffset,
}: {
  home: MiroirHome;
  scrollY: ReturnType<typeof useCondensingHeader>['scrollY'];
  parallaxOffset: number;
}) {
  const nextDay = home.nextDay;
  if (nextDay === null) return null;
  return (
    <HeroPhoto
      uri={home.vehiclePhotoUrl ?? undefined}
      height={200}
      scrollY={scrollY}
      parallaxOffset={parallaxOffset}
      fallback={<CircuitTraceFallback />}
    >
      <View style={styles.nextDayRow}>
        <Dial value={home.daysToNextDay} max={DIAL_COUNTDOWN_MAX_DAYS} size="m" label="jours" />
        <View style={styles.nextDayInfo}>
          {nextDay.circuitName !== null ? (
            <Text style={styles.nextDayCircuit} numberOfLines={1}>
              {nextDay.circuitName}
            </Text>
          ) : null}
          <Text style={styles.nextDayDate}>{shortDayLabel(nextDay.date)}</Text>
          {home.weather !== null ? (
            // Libellé HONNÊTE : c'est la météo ACTUELLE au circuit (Open-Meteo
            // `current`), pas une prévision du jour J — juxtaposée à la date
            // sans le dire, elle se lirait comme telle.
            <Text style={styles.nextDayWeather} numberOfLines={2}>
              {`Météo actuelle · ${Math.round(home.weather.temperatureC)}° · ${home.weather.label}`}
            </Text>
          ) : null}
          <PressScale
            onPress={() => router.navigate('/(app)/preparation' as never)}
            accessibilityLabel="Préparer la journée"
            containerStyle={styles.preparePillContainer}
            style={styles.preparePill}
          >
            <Text style={styles.preparePillLabel}>PRÉPARER</Text>
          </PressScale>
        </View>
      </View>
    </HeroPhoto>
  );
}

function HeroSansJournee({ home }: { home: MiroirHome }) {
  const onReserve = () => {
    const decision = decideReserve(home.paymentsEnabled);
    trackEvent(decision.analyticsEvent);
    router.navigate(decision.href as never);
  };
  return (
    <View style={styles.emptyCard}>
      <StateView state="empty" emptyMessage="Aucune journée au calendrier." />
      <PressScale
        onPress={onReserve}
        accessibilityLabel="Réserver une journée"
        containerStyle={styles.reserveContainer}
        style={styles.reservePill}
      >
        <Text style={styles.reserveLabel}>RÉSERVER</Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Signature compacte
// ---------------------------------------------------------------------------

function SignatureCard({ home }: { home: MiroirHome }) {
  const measured = Object.keys(home.qdiValues).length;
  if (measured === 0) return null; // pas de QDI → pas de radar inventé
  return (
    <PressScale
      onPress={() => router.navigate('/(app2)/signature' as never)}
      accessibilityLabel="Signature, vous vs vous. Ouvrir"
      containerStyle={styles.sectionGap}
      style={styles.signatureCard}
    >
      <View style={styles.signatureHeader}>
        <Text style={styles.signatureEyebrow}>SIGNATURE · VOUS VS VOUS</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <View style={styles.signatureBody}>
        <RadarQdi values={home.qdiValues} size="s" />
        <View style={styles.legend}>
          {QDI_BRANCHES.map((branch) => {
            const present = home.qdiValues[branch] !== undefined;
            return (
              <View key={branch} style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.qdi[branch], opacity: present ? 1 : 0.25 },
                  ]}
                />
                <Text
                  style={[
                    styles.legendLabel,
                    { color: present ? colors.text.mid : colors.text.dim },
                  ]}
                >
                  {QDI_BRANCH_LABELS[branch]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// Le fait — texte nu, l'espace autour EST le design
// ---------------------------------------------------------------------------

function Fact({ home }: { home: MiroirHome }) {
  if (home.fact === null) return null;
  return (
    <View style={styles.factBlock}>
      <Text style={home.fact.kind === 'narrative' ? styles.factNarrative : styles.factMono}>
        {home.fact.text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Rangée stats hairline — RECORD · SAISON · HERITAGE ou SÉANCES
// ---------------------------------------------------------------------------

function StatsRow({ home }: { home: MiroirHome }) {
  const fv = useFirstViewport(true);
  const stats = home.stats;

  const recordLabel =
    stats?.bestLapSeconds != null ? msToLapLabel(Math.round(stats.bestLapSeconds * 1000)) : null;
  const kmLabel = stats !== null ? String(Math.round(stats.totalDistanceKm)) : null;
  // Compteur Heritage : les VRAIES colonnes heritage_packs (sessions_used /
  // sessions_total du pack actif) — aucun pack actif → cellule SÉANCES.
  const pack = home.heritagePack;
  const sessionsLabel = stats !== null ? String(stats.totalSessions) : null;

  // Au premier viewport, chaque compteur ROULE du gabarit zéro vers sa valeur.
  const rolling = (label: string) => (fv.visible ? label : zeroLike(label));

  return (
    <Animated.View ref={fv.ref} style={styles.statsRow}>
      <StatCell
        label="Record"
        value={recordLabel === null ? '—' : undefined}
        style={styles.statCell}
      >
        {recordLabel !== null ? (
          <RollingCounter value={rolling(recordLabel)} fontSize={16} accentMillis />
        ) : undefined}
      </StatCell>
      <View style={styles.statDivider} />
      <StatCell label="Saison" value={kmLabel === null ? '—' : undefined} style={styles.statCell}>
        {kmLabel !== null ? (
          <View style={styles.statValueRow}>
            <RollingCounter value={rolling(kmLabel)} fontSize={16} />
            <Text style={styles.statUnit}>km</Text>
          </View>
        ) : undefined}
      </StatCell>
      <View style={styles.statDivider} />
      {pack !== null ? (
        <StatCell label="Heritage" style={styles.statCell}>
          <RollingCounter
            value={
              fv.visible
                ? `${pack.used}/${pack.total}`
                : `${zeroLike(String(pack.used))}/${pack.total}`
            }
            fontSize={16}
            color={colors.heritage.gold}
          />
        </StatCell>
      ) : (
        <StatCell
          label="Séances"
          value={sessionsLabel === null ? '—' : undefined}
          style={styles.statCell}
        >
          {sessionsLabel !== null ? (
            <RollingCounter value={rolling(sessionsLabel)} fontSize={16} />
          ) : undefined}
        </StatCell>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Squelette — les FORMES réelles de l'écran (héros 200, radar, fait, stats)
// ---------------------------------------------------------------------------

function HomeSkeleton() {
  return (
    <View
      style={styles.skeleton}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement de votre Miroir"
    >
      <Shimmer height={200} width="100%" radius={radius.hero} />
      <View style={styles.skeletonRadarRow}>
        <Shimmer height={140} width={140} radius={70} />
        <View style={styles.skeletonLegend}>
          <Shimmer height={10} width="80%" radius={radius.cell} />
          <Shimmer height={10} width="64%" radius={radius.cell} />
          <Shimmer height={10} width="72%" radius={radius.cell} />
        </View>
      </View>
      <Shimmer height={14} width="68%" radius={radius.cell} />
      <Shimmer height={56} width="100%" radius={radius.cell} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.base,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.xl,
  },
  headerEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  eyebrowRed: { color: colors.accent },
  eyebrowGold: { color: colors.heritage.gold },
  headerTitle: {
    fontFamily: typo.display,
    fontSize: 22,
    letterSpacing: 2,
    color: colors.text.hi,
    marginTop: space.xs,
  },
  condensedTitle: {
    fontFamily: typo.display,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.text.hi,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg.card2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: 34, height: 34, borderRadius: 17 },
  // Overlay fixe : AU-DESSUS de la CondensingHeaderBar (zIndex 10) pour
  // rester tappable au repos comme à l'état condensé (finding avatar V2-L1).
  avatarFixed: {
    position: 'absolute',
    right: space.xl,
    zIndex: 11,
  },

  // Héros
  fallbackCanvas: { width: 208, height: 116 },
  heroEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.text.hi,
    marginBottom: space.xs,
  },
  heroNoChrono: {
    fontFamily: typo.monoSemi,
    fontSize: 34,
    color: colors.text.hi,
  },
  heroDate: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: space.xs,
  },

  nextDayRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  nextDayInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: space.xs,
  },
  nextDayCircuit: {
    fontFamily: typo.bodySemi,
    fontSize: 14,
    color: colors.text.hi,
  },
  nextDayDate: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
  },
  nextDayWeather: {
    fontFamily: typo.mono,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text.mid,
    textAlign: 'right',
  },
  preparePillContainer: { marginTop: space.sm },
  preparePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text.mid,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  preparePillLabel: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },

  emptyCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.hero,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
  },
  reserveContainer: { marginTop: space.xs, marginBottom: space.md },
  reservePill: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.xxl,
    paddingVertical: space.md,
  },
  reserveLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.accent,
  },

  // Bandeau rituel J-3 (B3 minimal)
  ritualBanner: { marginBottom: space.lg },
  ritualInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.hairline,
    borderRadius: radius.cell,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  ritualText: {
    flex: 1,
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    lineHeight: 16,
    color: colors.text.mid,
  },

  // Signature compacte
  sectionGap: { marginTop: space.xl },
  signatureCard: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signatureEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.text.low,
  },
  chevron: {
    fontFamily: typo.body,
    fontSize: 18,
    color: colors.text.low,
  },
  signatureBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.md,
  },
  legend: {
    flex: 1,
    gap: space.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.6,
  },

  // Le fait
  factBlock: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.sm,
  },
  factNarrative: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text.mid,
  },
  factMono: {
    fontFamily: typo.mono,
    fontSize: 13,
    letterSpacing: 0.4,
    lineHeight: 22,
    color: colors.text.mid,
  },

  // Rangée stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.hairline,
    paddingVertical: space.lg,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.hairline,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.xs,
  },
  statUnit: {
    fontFamily: typo.mono,
    fontSize: 10,
    color: colors.text.low,
    marginBottom: 2,
  },

  // Squelette
  skeleton: { gap: space.lg },
  skeletonRadarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  skeletonLegend: { flex: 1, gap: space.sm },

  // Modes capture (S5 silence / S4 countdown)
  modeRoot: {
    paddingHorizontal: space.xl,
    justifyContent: 'center',
  },
  eyebrowAccent: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  modeTitle: {
    fontFamily: typo.display,
    fontSize: 24,
    letterSpacing: 0.5,
    lineHeight: 34,
    color: colors.text.hi,
    marginTop: space.md,
  },
  modeBody: {
    fontFamily: typo.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text.mid,
    marginTop: space.md,
  },
  modePill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text.mid,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    alignSelf: 'flex-start',
  },
  modePillLabel: {
    fontFamily: typo.bodyMedium,
    fontSize: 14,
    color: colors.text.hi,
  },
});
