/**
 * PRÉPARATION — porte REC, écran 2/8 (V2-L2). PEAU v2 sur les mêmes données
 * réelles que la v1 `app/(app)/preparation.tsx` : la state machine (S1..S9) et
 * les 4 fichiers cardinaux de capture ne sont JAMAIS touchés ici.
 *
 * Contenu (données réelles câblées, rien de fabriqué) :
 *   1. En-tête condensable « PRÉPARATION ».
 *   2. Héros journée : HeroPhoto 170 du circuit (fallback tracé Skia, patron
 *      L1), scrim, superposés Dial countdown OU badge « AUJOURD'HUI » pulsé +
 *      circuit + créneau (nextTrackDayService).
 *   3. Météo RÉELLE (weatherService) — ABSENTE = pas de ligne (A-WEATHER-1).
 *   4. Check-list cochable : coche = trait qui se dessine 200 ms + haptic tap,
 *      barre hairline x/N en tête, état persisté MMKV (mêmes items que la v1).
 *   5. QR Pass compact → plein écran clair (dismiss swipe) — source pass-oxv v1.
 *   6. C1 « Qui roule » : opt-in own-row + inscrits opt-in (RPC gaté), filtre
 *      « Mon groupe » si écurie.
 *   7. C2 Convoi (flag `convoys` fail-closed) : RDV, participants, rejoindre.
 *
 * Doctrine : vouvoiement, sans emoji, jamais prescriptif, un seul chiffre roi
 * (le cadran countdown), fail-closed sur flag/opt-in.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Canvas } from '@shopify/react-native-skia';
import { FlashList } from '@shopify/flash-list';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { storage } from '@/lib/mmkv';
import { getDefaultCircuit } from '@/services/circuitsService';
import { listMyRegistrations, type MyRegistration } from '@/services/eventsService';
import { getMyNextTrackDay, type NextTrackDay } from '@/services/nextTrackDayService';
import { isFlagEnabled } from '@/services/featureFlagsService';
import {
  fetchCurrentWeather,
  trackConditions,
  windDirectionCardinal,
  type WeatherData,
} from '@/services/weatherService';
import { getMyCrew, type MyCrew } from '@/services/v2/referralService';
import * as convoysService from '@/services/v2/convoysService';
import { useAuthStore } from '@/store/useAuthStore';
import {
  CondensingHeaderBar,
  Chip,
  colors,
  daysUntilTrackDay,
  Dial,
  EMPTY_CIRCUIT_PATH,
  GlowStroke,
  HeroPhoto,
  ListRow,
  motionTokens,
  OxvIcon,
  Photo,
  PressScale,
  SectionHeader,
  space,
  radius,
  StateView,
  tabBarSpace,
  typo,
  useCondensingHeader,
  useDoorTransition,
  useReduceMotion,
  haptic,
} from '@/ui/v2';

import {
  CHECKLIST_ITEMS,
  checklistProgress,
  checklistStorageKey,
  convoyGate,
  COUNTDOWN_MAX_DAYS,
  filterByCrew,
  heroCountdownKind,
  hydrateChecklist,
  longDayLabel,
  pickActivePass,
  qrCheckinPayload,
  serializeChecklist,
  startTimeLabel,
  toggleChecklistAt,
  type AttendanceMember,
} from '@/features/rec/preparationLogic';
import {
  getMyAttendanceOptIn,
  listAttendance,
  resolveDaySessionId,
  setMyAttendanceOptIn,
} from '@/features/rec/attendancePublicService';
import { REC_ROUTES } from '@/features/rec/captureStepLogic';

const HERO_HEIGHT = 170;
const AVATAR = 44;

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function PreparationScreen() {
  const insets = useSafeAreaInsets();
  const door = useDoorTransition();
  const header = useCondensingHeader();
  const profile = useAuthStore((s) => s.profile);
  const uid = profile?.id ?? null;

  // Météo — via circuit par défaut (mêmes coordonnées que la v1).
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Journée réelle (héros).
  const [nextDay, setNextDay] = useState<NextTrackDay | null>(null);
  const [dayLoading, setDayLoading] = useState(true);
  const [daySessionId, setDaySessionId] = useState<string | null>(null);

  // Check-list persistée (MMKV, mêmes items que la v1).
  const [checked, setChecked] = useState<boolean[]>(() =>
    hydrateChecklist(null, CHECKLIST_ITEMS.length)
  );

  // Pass OXV.
  const [pass, setPass] = useState<MyRegistration | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  // C1 « Qui roule ».
  const [members, setMembers] = useState<AttendanceMember[]>([]);
  const [myOptIn, setMyOptIn] = useState(false);
  const [myCrew, setMyCrew] = useState<MyCrew | null>(null);
  const [crewFilter, setCrewFilter] = useState(false);

  // C2 Convoi (flag fail-closed).
  const [convoysOn, setConvoysOn] = useState(false);
  const [convoys, setConvoys] = useState<convoysService.Convoy[]>([]);

  // --- Chargements best-effort ---------------------------------------------

  // Circuit + météo (indépendant de la journée).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getDefaultCircuit();
      if (cancelled) return;
      if (c && Number.isFinite(c.finishLineLat) && Number.isFinite(c.finishLineLon)) {
        const w = await fetchCurrentWeather(c.finishLineLat, c.finishLineLon);
        if (!cancelled) setWeather(w);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Check-list — hydratée depuis MMKV pour CE pilote.
  useEffect(() => {
    const raw = storage.getString(checklistStorageKey(uid));
    setChecked(hydrateChecklist(raw, CHECKLIST_ITEMS.length));
  }, [uid]);

  // Journée + dépendances (session id → attendance/convoi), écurie, opt-in.
  const loadDay = useCallback(async () => {
    if (!uid) {
      setDayLoading(false);
      return;
    }
    const day = await getMyNextTrackDay(uid).catch(() => null);
    setNextDay(day);
    setDayLoading(false);

    const [crew, optIn, flag] = await Promise.all([
      getMyCrew().catch(() => null),
      getMyAttendanceOptIn().catch(() => false),
      isFlagEnabled('convoys').catch(() => false),
    ]);
    setMyCrew(crew);
    setMyOptIn(optIn);
    setConvoysOn(convoyGate(flag));

    if (!day) {
      setDaySessionId(null);
      setMembers([]);
      setConvoys([]);
      return;
    }
    const sid = await resolveDaySessionId(uid, day.date).catch(() => null);
    setDaySessionId(sid);
    if (sid) {
      const mem = await listAttendance(sid, uid).catch(() => []);
      setMembers(mem);
      if (convoyGate(flag)) {
        const cv = await convoysService.getForSession(sid).catch(() => []);
        setConvoys(cv);
      }
    }
  }, [uid]);

  // Pass — inscription active (flux pass-oxv v1).
  const loadPass = useCallback(async () => {
    const regs = await listMyRegistrations().catch(() => [] as MyRegistration[]);
    setPass(pickActivePass(regs, Date.now()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDay();
      loadPass();
    }, [loadDay, loadPass])
  );

  // --- Actions --------------------------------------------------------------

  // haptic('tap') vient de PressScale (hapticOnPress par défaut) — ne pas le
  // redoubler ici. La coche « se dessine » (CheckRow) sur le même appui.
  const toggleCheck = useCallback(
    (index: number) => {
      setChecked((prev) => {
        const next = toggleChecklistAt(prev, index);
        storage.set(checklistStorageKey(uid), serializeChecklist(next));
        return next;
      });
    },
    [uid]
  );

  const onToggleOptIn = useCallback(
    async (next: boolean) => {
      haptic('tap');
      setMyOptIn(next); // optimiste
      const res = await setMyAttendanceOptIn(next);
      if (!res.ok) {
        setMyOptIn(!next); // rollback fail-closed
        return;
      }
      if (daySessionId) {
        const mem = await listAttendance(daySessionId, uid).catch(() => []);
        setMembers(mem);
      }
    },
    [daySessionId, uid]
  );

  const refreshConvoys = useCallback(async () => {
    if (!daySessionId) return;
    const cv = await convoysService.getForSession(daySessionId).catch(() => []);
    setConvoys(cv);
  }, [daySessionId]);

  // haptic('tap') fourni par le PressScale du bouton — pas de redoublement.
  const onJoin = useCallback(
    async (convoyId: string) => {
      await convoysService.join(convoyId);
      await refreshConvoys();
    },
    [refreshConvoys]
  );

  const onLeave = useCallback(
    async (convoyId: string) => {
      await convoysService.leave(convoyId);
      await refreshConvoys();
    },
    [refreshConvoys]
  );

  // --- Dérivés d'affichage --------------------------------------------------

  const conditions = weather ? trackConditions(weather) : null;
  // Météo réelle (doctrine Miroir A-WEATHER-1) : une mesure absente = null,
  // jamais 0. On omet le segment concerné et on affiche « — » pour la valeur.
  const weatherSublabel = weather
    ? [
        weather.windSpeedKmh != null ? `Vent ${Math.round(weather.windSpeedKmh)} km/h` : null,
        weather.windDirectionDeg != null ? windDirectionCardinal(weather.windDirectionDeg) : null,
        weather.precipitationProbabilityPct != null
          ? `Pluie ${Math.round(weather.precipitationProbabilityPct)} %`
          : null,
      ]
        .filter((segment): segment is string => segment != null)
        .join(' · ')
    : '';
  const weatherValue = weather?.temperatureC != null ? `${Math.round(weather.temperatureC)}°` : '—';
  const progress = checklistProgress(checked);
  const days = nextDay ? daysUntilTrackDay(nextDay.date, new Date()) : null;
  const countdown = heroCountdownKind(days);
  const shownMembers = crewFilter && myCrew ? filterByCrew(members, myCrew.crewId) : members;

  return (
    <Animated.View style={[styles.root, door]}>
      <Animated.ScrollView
        onScroll={header.scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + space.md,
          paddingBottom: tabBarSpace(insets.bottom) + space.xl,
          paddingHorizontal: space.xl,
        }}
      >
        {/* En-tête condensable */}
        <Animated.View style={[styles.headerRow, header.headerStyle]}>
          <View>
            <Text style={styles.headerEyebrow}>PORTE REC</Text>
            <Animated.Text
              style={[styles.headerTitle, header.titleStyle]}
              accessibilityRole="header"
            >
              PRÉPARATION
            </Animated.Text>
          </View>
        </Animated.View>

        {/* Héros journée */}
        <View style={styles.heroBlock}>
          {dayLoading ? (
            <View style={[styles.heroFallbackFrame, styles.heroLoading]}>
              <CircuitTraceFallback />
            </View>
          ) : nextDay ? (
            <HeroPhoto height={HERO_HEIGHT} fallback={<CircuitTraceFallback />}>
              <View style={styles.heroContent}>
                {countdown === 'countdown' ? (
                  <Dial value={days} max={COUNTDOWN_MAX_DAYS} size="m" label="jours" />
                ) : countdown === 'today' ? (
                  <TodayBadge />
                ) : null}
                <View style={styles.heroInfo}>
                  {nextDay.circuitName ? (
                    <Text style={styles.heroCircuit} numberOfLines={1}>
                      {nextDay.circuitName.toUpperCase()}
                    </Text>
                  ) : null}
                  <Text style={styles.heroDate} numberOfLines={1}>
                    {longDayLabel(nextDay.date)}
                  </Text>
                  {startTimeLabel(nextDay.startTime) ? (
                    <Text style={styles.heroSlot}>Début à {startTimeLabel(nextDay.startTime)}</Text>
                  ) : null}
                </View>
              </View>
            </HeroPhoto>
          ) : (
            <View style={styles.card}>
              <StateView state="empty" emptyMessage="Aucune journée au calendrier." />
            </View>
          )}
        </View>

        {/* Météo réelle — absente = pas de ligne (A-WEATHER-1) */}
        {weather && conditions ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="MÉTÉO PISTE" />
            <View style={styles.card}>
              <ListRow
                icon="meteo-piste"
                label={conditions.label}
                sublabel={weatherSublabel}
                value={weatherValue}
                divider={false}
              />
            </View>
          </View>
        ) : null}

        {/* Check-list */}
        <View style={styles.section}>
          <SectionHeader eyebrow="CHECK-LIST" />
          <View style={styles.card}>
            {/* La barre et le compteur disent LA MÊME chose : groupés, ils se
                lisent en une annonce. Séparés, la barre était annoncée
                « barre de progression » sans valeur. */}
            <View
              style={styles.progressHead}
              accessible
              accessibilityLabel={`Check-list : ${progress.done} sur ${progress.total}`}
            >
              <ProgressBar ratio={progress.ratio} />
              <Text style={styles.progressLabel}>
                {progress.done}/{progress.total}
              </Text>
            </View>
            {CHECKLIST_ITEMS.map((item, i) => (
              <CheckRow
                key={item}
                label={item}
                checked={checked[i] ?? false}
                divider={i < CHECKLIST_ITEMS.length - 1}
                onPress={() => toggleCheck(i)}
              />
            ))}
          </View>
        </View>

        {/* Pass OXV */}
        {pass && pass.event ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="PASS OXV" />
            <PressScale
              onPress={() => setQrOpen(true)}
              accessibilityLabel="Pass OXV. Agrandir votre code de présence."
              style={styles.passCard}
            >
              <View style={styles.passQrChip}>
                <QRCode
                  value={qrCheckinPayload(pass.registrationId)}
                  size={52}
                  color={colors.bg.base}
                  backgroundColor="#FFFFFF"
                />
              </View>
              <View style={styles.passInfo}>
                <Text style={styles.passTitle}>Votre code de présence</Text>
                <Text style={styles.passHint} numberOfLines={2}>
                  À présenter à l’accueil. Touchez pour agrandir.
                </Text>
              </View>
            </PressScale>
          </View>
        ) : null}

        {/* C1 « Qui roule » — uniquement si une journée (session) est résolue */}
        {daySessionId ? (
          <View style={styles.section}>
            <SectionHeader
              eyebrow="QUI ROULE"
              count={shownMembers.length > 0 ? shownMembers.length : undefined}
            />
            <View style={styles.card}>
              <ListRow
                icon="groupe"
                label="M’afficher aux autres"
                sublabel="Apparaître aux autres inscrits de cette journée"
                divider={false}
                right={
                  <Switch
                    value={myOptIn}
                    onValueChange={onToggleOptIn}
                    trackColor={{ false: colors.border.card, true: colors.accent }}
                    thumbColor={colors.text.hi}
                    accessibilityLabel="M’afficher aux autres inscrits de cette journée"
                  />
                }
              />
            </View>

            {myCrew ? (
              <View style={styles.chipRow}>
                <Chip
                  label="Mon groupe"
                  icon="convoi"
                  active={crewFilter}
                  onPress={() => setCrewFilter((v) => !v)}
                />
              </View>
            ) : null}

            {shownMembers.length > 0 ? (
              <View style={styles.avatarTrack}>
                <FlashList
                  horizontal
                  data={shownMembers}
                  keyExtractor={(m: AttendanceMember) => m.userId}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }: { item: AttendanceMember }) => (
                    <AvatarCell member={item} />
                  )}
                />
              </View>
            ) : (
              <Text style={styles.muted}>
                Personne n’apparaît pour l’instant sur cette journée.
              </Text>
            )}
          </View>
        ) : null}

        {/* C2 Convoi — flag fail-closed */}
        {convoysOn && daySessionId ? (
          <View style={styles.section}>
            <SectionHeader eyebrow="CONVOI" />
            {convoys.length > 0 ? (
              convoys.map((cv) => (
                <ConvoyCard
                  key={cv.id}
                  convoy={cv}
                  meIn={uid !== null && cv.participants.some((p) => p.userId === uid)}
                  onJoin={() => onJoin(cv.id)}
                  onLeave={() => onLeave(cv.id)}
                />
              ))
            ) : (
              <Text style={styles.muted}>Aucun convoi pour cette journée.</Text>
            )}
          </View>
        ) : null}

        {/*
          LA SORTIE — sans elle, cet écran est une impasse.

          `preparation` n'importait aucune primitive de navigation : ni `router`,
          ni `Link`, ni `Redirect`. Tous ses gestes étaient locaux — cocher,
          filtrer, ouvrir le QR. Et c'est la SEULE entrée du flux de capture
          (`paddockHeroLogic.ts:61`). La suite — appairage, placement, roulage —
          n'avait donc aucune porte : `equipement` était atteignable seulement
          depuis `placement`, lui-même atteignable seulement depuis `equipement`.

          L'aiguilleur ne comblait pas ce trou : l'état pilote ne quitte jamais
          `S1_decouverte`, faute d'appelant à `setUser`, et `captureStepLogic`
          rend alors `route: null`.

          Autrement dit : le flux de capture ne pouvait pas être entré. Ce lien
          l'ouvre — préparation, appairage, placement, roulage.

          Le geste va d'écran à écran, jamais par le hub : « une chaîne, pas une
          étoile ». Et `push`, non `replace` — revenir à la préparation doit
          rester possible, c'est consulter, pas rembobiner.
        */}
        <Pressable
          onPress={() => {
            haptic('tap');
            router.push(REC_ROUTES.appairage as never);
          }}
          accessibilityRole="button"
          accessibilityLabel="Passer à l’appairage du boîtier"
          style={({ pressed }) => [styles.suite, pressed && styles.suitePressed]}
        >
          <Text style={styles.suiteLabel}>APPAIRER LE BOÎTIER</Text>
          <Text style={styles.suiteHint}>Étape suivante</Text>
        </Pressable>
      </Animated.ScrollView>

      <CondensingHeaderBar
        condensedStyle={header.condensedStyle}
        height={52 + insets.top}
        style={{ paddingTop: insets.top }}
      >
        {/* Titre condensé ANNONCÉ (cf. app/(app2)/index.tsx) : sur iOS,
            VoiceOver ignore les vues d'opacité nulle, donc le grand titre fondu
            n'est plus lu — masquer celui-ci laisserait l'écran sans titre. */}
        <Text style={styles.condensedTitle} accessibilityRole="header">
          PRÉPARATION
        </Text>
      </CondensingHeaderBar>

      {pass && pass.event ? (
        <QrFullScreen
          visible={qrOpen}
          value={qrCheckinPayload(pass.registrationId)}
          onClose={() => setQrOpen(false)}
        />
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Héros — fallback tracé (patron L1) + badge « AUJOURD'HUI » pulsé
// ---------------------------------------------------------------------------

function CircuitTraceFallback() {
  return (
    <Canvas style={styles.fallbackCanvas}>
      <GlowStroke path={EMPTY_CIRCUIT_PATH} strokeWidth={2} />
    </Canvas>
  );
}

function TodayBadge() {
  const reduce = useReduceMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: motionTokens.pulse, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: motionTokens.pulse, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(pulse);
    };
  }, [reduce, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    // `accessible` : sans lui le label posé sur ce View était purement ignoré.
    <View style={styles.todayBadge} accessible accessibilityLabel="Aujourd’hui">
      <Animated.View style={[styles.todayDot, dotStyle]} />
      <Text style={styles.todayLabel}>AUJOURD’HUI</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Check-list — barre hairline + coche « trait qui se dessine »
// ---------------------------------------------------------------------------

function ProgressBar({ ratio }: { ratio: number }) {
  const pct = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%` as const;
  return (
    // Le rôle `progressbar` sans valeur n'annonçait rien : la valeur est
    // désormais portée par le groupe parent (barre + compteur x/N).
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: pct }]} />
    </View>
  );
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LEN = 22;

function CheckRow({
  label,
  checked,
  divider,
  onPress,
}: {
  label: string;
  checked: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const draw = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      draw.value = checked ? 1 : 0;
      return;
    }
    draw.value = withTiming(checked ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [checked, reduce, draw]);

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LEN * (1 - draw.value),
  }));

  return (
    // Le rôle `checkbox` est ce qui rend l'état `checked` audible : sur le rôle
    // `button` (défaut de PressScale), ni iOS ni Android ne l'annoncent.
    <PressScale
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkRow, divider && styles.checkDivider]}>
        <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
          <Svg width={14} height={14} viewBox="0 0 22 22">
            <AnimatedPath
              d="M4 11.5 L9 16.5 L18 6"
              stroke={colors.bg.base}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={`${CHECK_LEN} ${CHECK_LEN}`}
              animatedProps={checkProps}
            />
          </Svg>
        </View>
        <Text style={[styles.checkLabel, checked && styles.checkLabelOn]}>{label}</Text>
      </View>
    </PressScale>
  );
}

// ---------------------------------------------------------------------------
// C1 — cellule avatar + @handle
// ---------------------------------------------------------------------------

function AvatarCell({ member }: { member: AttendanceMember }) {
  return (
    <View style={styles.avatarCell}>
      <View style={[styles.avatarRing, member.isSelf && styles.avatarRingSelf]}>
        {member.avatarUrl ? (
          <Photo uri={member.avatarUrl} recyclingKey={member.userId} style={styles.avatarPhoto} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <OxvIcon name="casque" size={20} color={colors.text.mid} />
          </View>
        )}
      </View>
      <Text style={styles.avatarHandle} numberOfLines={1}>
        {member.handle ? `@${member.handle}` : member.isSelf ? 'Vous' : '—'}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// C2 — carte convoi (RDV, participants, rejoindre/quitter)
// ---------------------------------------------------------------------------

function formatRdv(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const txt = d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function ConvoyCard({
  convoy,
  meIn,
  onJoin,
  onLeave,
}: {
  convoy: convoysService.Convoy;
  meIn: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const rdv = formatRdv(convoy.rdvAt);
  const count = convoy.participants.length;
  return (
    <View style={styles.card}>
      <View style={styles.convoyHead}>
        {/* Mini-tracé : la géométrie des routes certifiées (scenic_routes)
            n'est pas câblée dans ce lot — repère d'icône honnête en attendant. */}
        <OxvIcon name="convoi" size={20} color={colors.text.mid} />
        <View style={styles.convoyInfo}>
          <Text style={styles.convoyTitle}>
            {convoy.routeId ? 'Route certifiée' : 'Convoi de la journée'}
          </Text>
          {rdv ? <Text style={styles.convoySub}>RDV {rdv}</Text> : null}
          {convoy.meetingPoint ? (
            <Text style={styles.convoySub} numberOfLines={2}>
              {convoy.meetingPoint}
            </Text>
          ) : null}
          <Text style={styles.convoyCount}>
            {count} {count > 1 ? 'participants' : 'participant'}
          </Text>
        </View>
      </View>
      <PressScale
        onPress={meIn ? onLeave : onJoin}
        accessibilityLabel={meIn ? 'Quitter le convoi' : 'Rejoindre le convoi'}
        style={[styles.convoyBtn, meIn ? styles.convoyBtnLeave : styles.convoyBtnJoin]}
      >
        <Text style={[styles.convoyBtnLabel, meIn && styles.convoyBtnLabelLeave]}>
          {meIn ? 'QUITTER' : 'REJOINDRE'}
        </Text>
      </PressScale>
    </View>
  );
}

// ---------------------------------------------------------------------------
// QR plein écran — fond clair (lecture optique), dismiss swipe
// ---------------------------------------------------------------------------

function QrFullScreen({
  visible,
  value,
  onClose,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const qrSize = Math.round(Math.min(width, height) * 0.7);
  const ty = useSharedValue(0);

  // Réarme la position à chaque ouverture (le composant reste monté).
  useEffect(() => {
    if (visible) ty.value = 0;
  }, [visible, ty]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([16, 9999])
        .onUpdate((e) => {
          ty.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (ty.value > 120 || e.velocityY > 800) {
            runOnJS(onClose)();
          } else {
            ty.value = withTiming(0, { duration: 160 });
          }
        }),
    [onClose, ty]
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.qrRoot}>
        <GestureDetector gesture={pan}>
          {/* Fond blanc plein : maximise la luminosité émise (expo-brightness
              n'est pas installé — impossible de forcer la luminosité système ;
              note honnête). Foreground QR sombre pour le contraste optique. */}
          <Animated.View
            style={[styles.qrScreen, sheetStyle]}
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
          >
            <QRCode value={value} size={qrSize} color={colors.bg.base} backgroundColor="#FFFFFF" />
            <Text style={styles.qrCaption}>Présentez ce code à l’accueil.</Text>
            <Text style={styles.qrDismiss}>Balayez vers le bas pour fermer</Text>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles — tokens V2 uniquement (exceptions QR fond clair, justifiées)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.base },

  // En-tête
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  headerEyebrow: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: colors.text.hi,
  },
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

  // Héros
  heroBlock: { marginBottom: space.sm },
  heroFallbackFrame: {
    height: HERO_HEIGHT,
    borderRadius: radius.hero,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLoading: { opacity: 0.6 },
  fallbackCanvas: { width: 208, height: 116 },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.lg,
  },
  heroInfo: { flex: 1, alignItems: 'flex-end', gap: 2 },
  heroCircuit: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  heroDate: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.text.hi,
    textAlign: 'right',
  },
  heroSlot: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
  },

  // Badge « AUJOURD'HUI »
  todayBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  todayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  todayLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },

  // Sections / cartes
  section: { marginTop: space.xl },
  card: {
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    marginTop: space.sm,
  },
  /**
   * Sortie vers l'appairage — l'action la plus importante de l'écran.
   *
   * 72 pt : les 44 pt d'Apple sont un plancher, et le dossier situe l'optimum
   * cockpit entre 18 et 21 mm. Le taux d'erreur passe de 10,3 % en statique à
   * 16,6 % sous vibration ; cet écran se touche gants aux mains, au paddock.
   *
   * En bas du contenu, jamais dans le tiers supérieur : aucune action critique
   * ne se place là où le pouce ne va pas.
   */
  suite: {
    minHeight: 72,
    marginTop: space.xl,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.text.hi,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  suitePressed: { opacity: 0.7 },
  suiteLabel: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    letterSpacing: 1.4,
    color: colors.text.hi,
  },
  suiteHint: {
    fontFamily: typo.body,
    fontSize: 12,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  muted: {
    fontFamily: typo.body,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.mid,
    marginTop: space.md,
    paddingHorizontal: space.xs,
  },

  // Check-list — barre + coches
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.border.hairline,
    overflow: 'hidden',
  },
  progressFill: { height: 2, borderRadius: radius.pill, backgroundColor: colors.accent },
  progressLabel: {
    fontFamily: typo.monoSemi,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.text.mid,
    fontVariant: ['tabular-nums'],
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.md,
  },
  checkDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.hairline,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.card2,
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkLabel: {
    flex: 1,
    fontFamily: typo.body,
    fontSize: 15,
    color: colors.text.hi,
  },
  checkLabelOn: { color: colors.text.mid, textDecorationLine: 'line-through' },

  // Pass OXV
  passCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    backgroundColor: colors.bg.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
    borderRadius: radius.card,
    padding: space.lg,
    marginTop: space.sm,
  },
  // Fond clair NÉCESSAIRE à la lecture optique du QR (même justification que
  // la v1 pass-oxv) — pas un décor, un code scannable.
  passQrChip: { backgroundColor: '#FFFFFF', borderRadius: radius.cell, padding: 6 },
  passInfo: { flex: 1 },
  passTitle: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.text.hi },
  passHint: {
    fontFamily: typo.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.mid,
    marginTop: 3,
  },

  // C1 — chip filtre + rail avatars
  chipRow: { flexDirection: 'row', marginTop: space.md },
  avatarTrack: { height: AVATAR + 26, marginTop: space.md },
  avatarCell: { width: AVATAR + space.md, alignItems: 'center', marginRight: space.sm },
  avatarRing: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
    backgroundColor: colors.bg.card2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.card,
  },
  avatarRingSelf: { borderWidth: 2, borderColor: colors.accent },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarHandle: {
    fontFamily: typo.mono,
    fontSize: 10,
    letterSpacing: 0.2,
    color: colors.text.mid,
    marginTop: space.xs,
    maxWidth: AVATAR + space.md,
  },

  // C2 — convoi
  convoyHead: { flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  convoyInfo: { flex: 1, gap: 2 },
  convoyTitle: { fontFamily: typo.bodySemi, fontSize: 15, color: colors.text.hi },
  convoySub: { fontFamily: typo.body, fontSize: 13, color: colors.text.mid },
  convoyCount: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.text.mid,
    marginTop: space.xs,
  },
  convoyBtn: {
    borderRadius: radius.pill,
    paddingVertical: space.md,
    alignItems: 'center',
    marginBottom: space.md,
  },
  convoyBtnJoin: { backgroundColor: colors.accent },
  convoyBtnLeave: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.strong,
  },
  convoyBtnLabel: {
    fontFamily: typo.mono,
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.text.hi,
  },
  convoyBtnLabelLeave: { color: colors.text.mid },

  // QR plein écran
  qrRoot: { flex: 1 },
  qrScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xl,
  },
  qrCaption: {
    fontFamily: typo.bodySemi,
    fontSize: 15,
    color: colors.bg.base,
  },
  qrDismiss: {
    fontFamily: typo.mono,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.text.mid,
  },
});
